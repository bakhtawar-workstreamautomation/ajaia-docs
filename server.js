'use strict';

/**
 * Ajaia Docs -- server.js
 *
 * A dependency-free Node.js HTTP server that serves the static frontend
 * (public/) and a small JSON REST API backed by lib/store.js. No Express,
 * no ORM, no build step -- `node server.js` is the entire deploy story.
 *
 * Auth model: intentionally mocked, per the assignment's explicit allowance
 * ("You may simulate users with seeded accounts, mocked auth, or a
 * lightweight login flow"). Logging in as a seeded username returns that
 * user's id as a bearer-style token; every subsequent request sends it via
 * the `X-User-Id` header. There is no password because this is a scoped
 * demo, not a security exercise -- see ARCHITECTURE.md for the explicit
 * tradeoff note.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const store = require('./lib/store');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    const LIMIT = 5 * 1024 * 1024; // 5MB cap for pasted file content / body size
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function getRequestingUser(req, db) {
  const userId = req.headers['x-user-id'];
  if (!userId) return null;
  return store.findUserById(db, userId) || null;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ''));

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleApi(req, res, pathname) {
  const db = store.loadDB();
  let persist = false;

  try {
    // ---- Auth ----
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const username = (body.username || '').trim();
      if (!username) return sendJson(res, 400, { error: 'username is required' });
      const user = store.findUserByUsername(db, username);
      if (!user) return sendJson(res, 404, { error: `No seeded user named "${username}". Try alice, bob, or carol.` });
      return sendJson(res, 200, { token: user.id, user });
    }

    if (pathname === '/api/users' && req.method === 'GET') {
      return sendJson(res, 200, { users: db.users.map((u) => ({ username: u.username, displayName: u.displayName })) });
    }

    // Everything below requires a recognized user
    const user = getRequestingUser(req, db);
    if (!user) return sendJson(res, 401, { error: 'Not authenticated. Log in first.' });

    if (pathname === '/api/me' && req.method === 'GET') {
      return sendJson(res, 200, { user });
    }

    if (pathname === '/api/documents' && req.method === 'GET') {
      return sendJson(res, 200, { documents: store.listDocumentsForUser(db, user.id) });
    }

    if (pathname === '/api/documents' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const doc = store.createDocument(db, { ownerId: user.id, title: body.title, content: body.content });
      persist = true;
      return sendJson(res, 201, { document: doc });
    }

    let match = pathname.match(/^\/api\/documents\/([^/]+)$/);
    if (match && req.method === 'GET') {
      const doc = store.findDocument(db, match[1]);
      if (!doc) return sendJson(res, 404, { error: 'Document not found' });
      if (!store.hasAccess(doc, user.id)) return sendJson(res, 403, { error: 'You do not have access to this document' });
      return sendJson(res, 200, { document: doc, isOwner: doc.ownerId === user.id });
    }

    if (match && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = store.updateDocument(db, { docId: match[1], userId: user.id, title: body.title, content: body.content });
      if (!result.ok) return sendJson(res, result.status, { error: result.error });
      persist = true;
      return sendJson(res, 200, { document: result.doc });
    }

    match = pathname.match(/^\/api\/documents\/([^/]+)\/share$/);
    if (match && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.username || !String(body.username).trim()) {
        return sendJson(res, 400, { error: 'username is required to share' });
      }
      const result = store.shareDocument(db, {
        docId: match[1],
        requestingUserId: user.id,
        targetUsername: body.username
      });
      if (!result.ok) return sendJson(res, result.status, { error: result.error });
      persist = true;
      return sendJson(res, 200, { document: result.doc });
    }

    if (pathname === '/api/import' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const filename = (body.filename || '').trim();
      const rawText = body.content;
      if (!filename) return sendJson(res, 400, { error: 'filename is required' });
      if (typeof rawText !== 'string') return sendJson(res, 400, { error: 'file content is required' });
      if (!/\.(txt|md)$/i.test(filename)) {
        return sendJson(res, 400, { error: 'Only .txt and .md files are supported in this build.' });
      }
      if (rawText.length > 2_000_000) {
        return sendJson(res, 400, { error: 'File is too large (2MB limit for this demo).' });
      }
      const doc = store.importFileAsDocument(db, { ownerId: user.id, filename, rawText });
      persist = true;
      return sendJson(res, 201, { document: doc });
    }

    return sendJson(res, 404, { error: 'Unknown API route' });
  } catch (err) {
    const status = err.status || 500;
    return sendJson(res, status, { error: err.message || 'Internal server error' });
  } finally {
    if (persist) {
      try {
        store.saveDB(db);
      } catch (e) {
        console.error('Failed to persist DB:', e);
      }
    }
  }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch((err) => {
      console.error(err);
      sendJson(res, 500, { error: 'Unexpected server error' });
    });
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ajaia Docs running at http://localhost:${PORT}`);
});
