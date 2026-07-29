// Ajaia Docs -- frontend app logic (vanilla JS, no build step).
// Talks to the JSON API in server.js. Auth token is just the seeded user's id,
// stored in localStorage and sent back as the X-User-Id header.

const state = {
  token: localStorage.getItem('ajaia_token') || null,
  user: null,
  documents: [],
  activeDocId: null,
  quill: null,
  saveTimer: null
};

const el = (id) => document.getElementById(id);

async function api(pathname, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['X-User-Id'] = state.token;
  const res = await fetch(pathname, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- Auth ----------

function showLogin() {
  el('login-screen').style.display = 'flex';
  el('app-screen').style.display = 'none';
}

function showApp() {
  el('login-screen').style.display = 'none';
  el('app-screen').style.display = 'block';
}

async function login(username) {
  el('login-error').textContent = '';
  try {
    const data = await api('/api/login', { method: 'POST', body: { username } });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('ajaia_token', state.token);
    el('current-user-label').textContent = `${data.user.displayName}`;
    showApp();
    await refreshDocuments();
  } catch (err) {
    el('login-error').textContent = err.message;
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.activeDocId = null;
  localStorage.removeItem('ajaia_token');
  showLogin();
}

async function tryResumeSession() {
  if (!state.token) return showLogin();
  try {
    const data = await api('/api/me');
    state.user = data.user;
    el('current-user-label').textContent = data.user.displayName;
    showApp();
    await refreshDocuments();
  } catch {
    logout();
  }
}

// ---------- Document list ----------

async function refreshDocuments() {
  const data = await api('/api/documents');
  state.documents = data.documents;
  renderDocList();
}

function renderDocList() {
  const owned = state.documents.filter((d) => d.isOwner);
  const shared = state.documents.filter((d) => !d.isOwner);

  renderListInto('owned-list', owned, 'No documents yet — create one!');
  renderListInto('shared-list', shared, 'Nothing shared with you yet.');
}

function renderListInto(listId, docs, emptyText) {
  const listEl = el(listId);
  listEl.innerHTML = '';
  if (docs.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.textContent = emptyText;
    listEl.appendChild(li);
    return;
  }
  for (const doc of docs) {
    const li = document.createElement('li');
    li.className = doc.id === state.activeDocId ? 'active' : '';
    const updated = new Date(doc.updatedAt).toLocaleString();
    li.innerHTML = `${escapeHtml(doc.title)}<span class="doc-meta">${doc.isOwner ? `Shared with ${doc.sharedWithCount}` : `Owned by ${escapeHtml(doc.ownerName)}`} · ${updated}</span>`;
    li.addEventListener('click', () => openDocument(doc.id));
    listEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Editor ----------

function ensureQuill() {
  if (state.quill) return state.quill;
  state.quill = new Quill('#quill-editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean']
      ]
    }
  });
  state.quill.on('text-change', () => scheduleAutosave());
  return state.quill;
}

async function openDocument(docId) {
  const data = await api(`/api/documents/${docId}`);
  state.activeDocId = docId;
  state.isOwner = data.isOwner;

  el('empty-state').style.display = 'none';
  el('doc-view').style.display = 'flex';
  el('doc-title-input').value = data.document.title;
  el('doc-title-input').disabled = false;

  const quill = ensureQuill();
  quill.root.innerHTML = data.document.content || '';
  setSaveStatus('');
  renderDocList();
}

async function createNewDocument() {
  const data = await api('/api/documents', { method: 'POST', body: { title: 'Untitled document', content: '' } });
  await refreshDocuments();
  await openDocument(data.document.id);
  el('doc-title-input').focus();
  el('doc-title-input').select();
}

function scheduleAutosave() {
  setSaveStatus('Editing…');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveActiveDocument, 700);
}

async function saveActiveDocument() {
  if (!state.activeDocId) return;
  setSaveStatus('Saving…');
  try {
    const content = state.quill.root.innerHTML;
    const title = el('doc-title-input').value;
    await api(`/api/documents/${state.activeDocId}`, { method: 'PUT', body: { title, content } });
    setSaveStatus('Saved ✓');
    await refreshDocuments();
  } catch (err) {
    setSaveStatus('Save failed');
    console.error(err);
  }
}

function setSaveStatus(text) {
  el('save-status').textContent = text;
}

// ---------- Sharing ----------

function openShareModal() {
  if (!state.activeDocId) return;
  const doc = state.documents.find((d) => d.id === state.activeDocId);
  el('share-modal-doc-title').textContent = doc ? `"${doc.title}"` : '';
  el('share-username-input').value = '';
  el('share-error').textContent = '';
  el('share-success').textContent = '';
  el('share-modal').style.display = 'flex';
  el('share-username-input').focus();
}

function closeShareModal() {
  el('share-modal').style.display = 'none';
}

async function submitShare(e) {
  e.preventDefault();
  const username = el('share-username-input').value.trim();
  el('share-error').textContent = '';
  el('share-success').textContent = '';
  try {
    await api(`/api/documents/${state.activeDocId}/share`, { method: 'POST', body: { username } });
    el('share-success').textContent = `Shared with ${username}.`;
    el('share-username-input').value = '';
    await refreshDocuments();
  } catch (err) {
    el('share-error').textContent = err.message;
  }
}

// ---------- File import ----------

async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const allowed = /\.(txt|md)$/i;
  if (!allowed.test(file.name)) {
    alert('Only .txt and .md files are supported in this build.');
    e.target.value = '';
    return;
  }
  const text = await file.text();
  try {
    const data = await api('/api/import', { method: 'POST', body: { filename: file.name, content: text } });
    await refreshDocuments();
    await openDocument(data.document.id);
  } catch (err) {
    alert('Import failed: ' + err.message);
  } finally {
    e.target.value = '';
  }
}

// ---------- Wire up events ----------

el('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = el('username-input').value.trim();
  if (username) login(username);
});
document.querySelectorAll('.user-chip').forEach((btn) => {
  btn.addEventListener('click', () => login(btn.dataset.user));
});
el('logout-btn').addEventListener('click', logout);
el('new-doc-btn').addEventListener('click', createNewDocument);
el('doc-title-input').addEventListener('input', scheduleAutosave);
el('share-btn').addEventListener('click', openShareModal);
el('share-cancel-btn').addEventListener('click', closeShareModal);
el('share-form').addEventListener('submit', submitShare);
el('import-input').addEventListener('change', handleFileImport);

window.addEventListener('beforeunload', () => {
  if (state.saveTimer) saveActiveDocument();
});

tryResumeSession();
