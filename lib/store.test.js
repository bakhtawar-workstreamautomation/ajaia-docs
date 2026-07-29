'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  seedDB,
  createDocument,
  updateDocument,
  shareDocument,
  listDocumentsForUser,
  hasAccess,
  textToHtml
} = require('./store');

function freshDB() {
  // Independent in-memory DB per test -- never touches disk.
  return seedDB();
}

test('createDocument adds a new owned document with defaults', () => {
  const db = freshDB();
  const doc = createDocument(db, { ownerId: 'u_alice', title: '  My Doc  ', content: '<p>hi</p>' });
  assert.equal(doc.title, 'My Doc');
  assert.equal(doc.ownerId, 'u_alice');
  assert.deepEqual(doc.sharedWith, []);
  assert.ok(db.documents.includes(doc));
});

test('untitled document falls back to a default title', () => {
  const db = freshDB();
  const doc = createDocument(db, { ownerId: 'u_alice', title: '', content: '' });
  assert.equal(doc.title, 'Untitled document');
});

test('owner can update their own document', () => {
  const db = freshDB();
  const result = updateDocument(db, {
    docId: 'd_welcome',
    userId: 'u_alice',
    title: 'Renamed',
    content: '<p>updated</p>'
  });
  assert.equal(result.ok, true);
  assert.equal(result.doc.title, 'Renamed');
  assert.equal(result.doc.content, '<p>updated</p>');
});

test('a user without access cannot update a document', () => {
  const db = freshDB();
  const result = updateDocument(db, {
    docId: 'd_welcome',
    userId: 'u_carol', // carol has no access in seed data
    title: 'Hacked title'
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('shared user CAN update the document (collaborative edit model)', () => {
  const db = freshDB();
  // bob is shared-with in seed data
  const result = updateDocument(db, { docId: 'd_welcome', userId: 'u_bob', title: 'Bob edited this' });
  assert.equal(result.ok, true);
  assert.equal(result.doc.title, 'Bob edited this');
});

test('only the owner can share a document', () => {
  const db = freshDB();
  const attempt = shareDocument(db, {
    docId: 'd_welcome',
    requestingUserId: 'u_bob', // bob is shared-with, not owner
    targetUsername: 'carol'
  });
  assert.equal(attempt.ok, false);
  assert.equal(attempt.status, 403);
});

test('owner can share with another valid user, and it is idempotent-safe', () => {
  const db = freshDB();
  const first = shareDocument(db, { docId: 'd_welcome', requestingUserId: 'u_alice', targetUsername: 'carol' });
  assert.equal(first.ok, true);
  assert.ok(first.doc.sharedWith.includes('u_carol'));

  const second = shareDocument(db, { docId: 'd_welcome', requestingUserId: 'u_alice', targetUsername: 'carol' });
  assert.equal(second.ok, false);
  assert.match(second.error, /Already shared/);
});

test('sharing with an unknown username fails clearly', () => {
  const db = freshDB();
  const result = shareDocument(db, { docId: 'd_welcome', requestingUserId: 'u_alice', targetUsername: 'nobody' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('listDocumentsForUser correctly tags ownership vs shared access', () => {
  const db = freshDB();
  const aliceDocs = listDocumentsForUser(db, 'u_alice');
  const bobDocs = listDocumentsForUser(db, 'u_bob');
  const carolDocs = listDocumentsForUser(db, 'u_carol');

  assert.equal(aliceDocs.length, 1);
  assert.equal(aliceDocs[0].isOwner, true);

  assert.equal(bobDocs.length, 1);
  assert.equal(bobDocs[0].isOwner, false);

  assert.equal(carolDocs.length, 0); // no access yet
});

test('hasAccess is true for owner and shared users, false otherwise', () => {
  const db = freshDB();
  const doc = db.documents[0];
  assert.equal(hasAccess(doc, 'u_alice'), true);
  assert.equal(hasAccess(doc, 'u_bob'), true);
  assert.equal(hasAccess(doc, 'u_carol'), false);
});

test('textToHtml converts basic markdown headings, bold, italic and lists', () => {
  const md = '# Title\nSome **bold** and *italic* text.\n- item one\n- item two\n';
  const html = textToHtml('notes.md', md);
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<ul><li>item one<\/li><li>item two<\/li><\/ul>/);
});

test('textToHtml escapes HTML-unsafe characters from plain .txt files', () => {
  const html = textToHtml('notes.txt', 'Use <script>alert(1)</script> carefully');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
