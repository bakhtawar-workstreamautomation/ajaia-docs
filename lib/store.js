'use strict';

/**
 * Persistence + domain logic layer.
 *
 * Storage approach: a single JSON file acting as a lightweight document store.
 * This is intentionally simple (explicitly allowed by the assignment: "a local
 * file-based store if well documented"). All read/modify/write operations go
 * through loadDB()/saveDB() so there is one place that touches disk, and all
 * the actual business logic (permissions, creation, sharing) is implemented
 * as plain functions that take/return a DB object. That separation is what
 * makes the logic unit-testable without spinning up the HTTP server or
 * touching the filesystem (see store.test.js).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function seedDB() {
  return {
    users: [
      { id: 'u_alice', username: 'alice', displayName: 'Alice (Owner demo)' },
      { id: 'u_bob', username: 'bob', displayName: 'Bob (Shared-with demo)' },
      { id: 'u_carol', username: 'carol', displayName: 'Carol (No access demo)' }
    ],
    documents: [
      {
        id: 'd_welcome',
        title: 'Welcome to Ajaia Docs',
        content:
          '<h1>Welcome!</h1><p>This is a <strong>sample document</strong> owned by <em>alice</em>.</p>' +
          '<ul><li>Try editing this text</li><li>Use the toolbar for formatting</li></ul>' +
          '<p>Log in as <strong>bob</strong> to see this shared document appear in his "Shared with me" list.</p>',
        ownerId: 'u_alice',
        sharedWith: ['u_bob'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };
}

function loadDB(dbPath = DB_PATH) {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // No DB file yet (first deploy, or fresh Railway volume). Seed one.
      console.log(`[store] No DB at ${dbPath}, seeding fresh database.`);
      const fresh = seedDB();
      saveDB(fresh, dbPath);
      return fresh;
    }
    console.error(`[store] Failed to load DB at ${dbPath}:`, err.message);
    throw err;
  }
}

function saveDB(db, dbPath = DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function findUserByUsername(db, username) {
  return db.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
}

function findUserById(db, id) {
  return db.users.find((u) => u.id === id);
}

function findDocument(db, docId) {
  return db.documents.find((d) => d.id === docId);
}

/** Returns true if a user may view/edit a document (owner or shared). */
function hasAccess(doc, userId) {
  if (!doc) return false;
  return doc.ownerId === userId || doc.sharedWith.includes(userId);
}

/**
 * List documents visible to a user, tagged with whether they own it or it
 * was shared with them (frontend uses this to render the two sections).
 */
function listDocumentsForUser(db, userId) {
  return db.documents
    .filter((d) => hasAccess(d, userId))
    .map((d) => ({
      id: d.id,
      title: d.title,
      ownerId: d.ownerId,
      ownerName: findUserById(db, d.ownerId)?.displayName || 'Unknown',
      isOwner: d.ownerId === userId,
      sharedWithCount: d.sharedWith.length,
      updatedAt: d.updatedAt
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function createDocument(db, { ownerId, title, content }) {
  const now = new Date().toISOString();
  const doc = {
    id: 'd_' + crypto.randomUUID(),
    title: (title && title.trim()) || 'Untitled document',
    content: content || '',
    ownerId,
    sharedWith: [],
    createdAt: now,
    updatedAt: now
  };
  db.documents.push(doc);
  return doc;
}

/**
 * Update title/content of a document. Returns { ok, doc } or { ok:false, error }.
 * Only the owner or a user the doc has been shared with may edit.
 */
function updateDocument(db, { docId, userId, title, content }) {
  const doc = findDocument(db, docId);
  if (!doc) return { ok: false, status: 404, error: 'Document not found' };
  if (!hasAccess(doc, userId)) return { ok: false, status: 403, error: 'You do not have access to this document' };

  if (typeof title === 'string') {
    const trimmed = title.trim();
    doc.title = trimmed.length ? trimmed : doc.title;
  }
  if (typeof content === 'string') {
    doc.content = content;
  }
  doc.updatedAt = new Date().toISOString();
  return { ok: true, doc };
}

/**
 * Grant another user (by username) access to a document. Only the owner
 * may share. Returns { ok, doc } or { ok:false, status, error }.
 */
function shareDocument(db, { docId, requestingUserId, targetUsername }) {
  const doc = findDocument(db, docId);
  if (!doc) return { ok: false, status: 404, error: 'Document not found' };
  if (doc.ownerId !== requestingUserId) {
    return { ok: false, status: 403, error: 'Only the document owner can share it' };
  }
  const target = findUserByUsername(db, targetUsername);
  if (!target) return { ok: false, status: 404, error: `No user named "${targetUsername}"` };
  if (target.id === doc.ownerId) return { ok: false, status: 400, error: 'Document owner already has access' };
  if (doc.sharedWith.includes(target.id)) {
    return { ok: false, status: 400, error: `Already shared with ${targetUsername}` };
  }
  doc.sharedWith.push(target.id);
  doc.updatedAt = new Date().toISOString();
  return { ok: true, doc };
}

/**
 * Very small, dependency-free Markdown-ish -> HTML conversion used for file
 * import. Intentionally limited: headings (#, ##), bold (**x**), italic (*x*),
 * and "- " bullet lists. This is NOT a full Markdown parser -- documented as
 * a stated scope limitation in the README.
 */
function textToHtml(filename, rawText) {
  const isMarkdown = /\.md$/i.test(filename);
  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (!isMarkdown) {
    // Plain .txt: preserve line breaks as paragraphs.
    return rawText
      .split(/\r?\n\r?\n/)
      .map((para) => `<p>${escapeHtml(para).replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
  }

  const lines = rawText.split(/\r?\n/);
  let html = '';
  let inList = false;

  const inline = (line) =>
    escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);

    if (heading) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
    } else if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(bullet[1])}</li>`;
    } else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html || '<p></p>';
}

function importFileAsDocument(db, { ownerId, filename, rawText }) {
  const content = textToHtml(filename, rawText);
  const title = filename.replace(/\.(txt|md)$/i, '') || 'Imported document';
  return createDocument(db, { ownerId, title, content });
}

module.exports = {
  DB_PATH,
  seedDB,
  loadDB,
  saveDB,
  findUserByUsername,
  findUserById,
  findDocument,
  hasAccess,
  listDocumentsForUser,
  createDocument,
  updateDocument,
  shareDocument,
  textToHtml,
  importFileAsDocument
};
