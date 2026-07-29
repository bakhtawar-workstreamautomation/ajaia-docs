# Ajaia Docs

A lightweight collaborative document editor, built for the Ajaia AI-Native Full Stack Developer assignment.

## Live Demo

- **Live URL:**  https://ajaia-docs-production-2e03.up.railway.app/
- **Seeded accounts (no password needed):** `alice`, `bob`, `carol`

Suggested reviewer flow:
1. Log in as **alice** → see her owned "Welcome to Ajaia Docs" document.
2. Log in as **bob** → the same document appears under "Shared with Me" (alice shared it with him in seed data).
3. Log in as **carol** → she has no access to it yet, demonstrating access control.
4. As alice, click **Share** on the welcome doc and share it with `carol` to see sharing happen live.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Server | Plain Node.js `http` module — **no Express, no npm install required** | Zero dependencies means `node server.js` just works on any machine with Node ≥18, no install step to fail during review |
| Frontend | Vanilla HTML/CSS/JS, no bundler | Same reasoning — nothing to build, just static files served by the same server |
| Rich text editor | [Quill.js](https://quilljs.com/) via CDN | Mature, small, gives headings/bold/italic/underline/lists out of the box |
| Storage | Single JSON file (`data/db.json`) | Explicitly allowed by the assignment ("a local file-based store if well documented"); simplest possible persistence for this scope |
| Auth | Mocked — pick a seeded username, no password | Explicitly allowed by the assignment; kept the timebox for actual product features |

**This project has zero npm dependencies.** There is nothing to `npm install`.

## Local Setup & Run

Requirements: Node.js ≥ 18 (no other dependencies).

```bash
git clone <this-repo>
cd ajaia-docs
node server.js
```

Then open **http://localhost:3000** in your browser. That's it — no build step, no `npm install`, no environment variables required.

To use a different port: `PORT=8080 node server.js`.

### Running the automated tests

```bash
npm test
# or directly:
node --test lib/*.test.js
```

This runs 12 tests against the core document/sharing/permission/import logic using Node's built-in test runner (`node:test` — no test framework dependency either).

## Features Implemented

- **Document creation & editing** — create, rename, edit rich text (bold, italic, underline, H1/H2/H3, bulleted & numbered lists), autosave ~700ms after you stop typing, reopen after refresh.
- **File upload / import** — upload a `.txt` or `.md` file and it becomes a new editable document. `.md` files get light heading/bold/italic/list conversion to HTML; `.txt` files are wrapped as paragraphs.
  - **Stated limitation:** only `.txt` and `.md` are supported. `.docx` is explicitly out of scope for this build (would require an additional parsing dependency) — this is called out both in the UI ("Supported import types: .txt, .md") and here.
- **Sharing** — any document owner can share with another seeded user by username. Shared users get full edit access (see "Product decisions" below for why). The sidebar visibly separates **My Documents** from **Shared with Me**.
- **Persistence** — all documents and sharing relationships are written to `data/db.json` after every mutation, so a server restart or browser refresh doesn't lose data (verified manually: create/share/import, restart the process, data is intact).
- **Validation & error handling** — the API returns proper HTTP status codes (400 for bad input, 401 unauthenticated, 403 for access-denied, 404 for missing resources) with descriptive JSON error messages, all rendered inline in the UI rather than failing silently.
- **Automated tests** — 12 unit tests covering document creation, permission checks (owner vs. shared vs. no-access), sharing rules (only owner can share, no duplicate shares, unknown username handling), and the markdown-to-HTML import conversion.

## Product Decisions & Scope Cuts

See `ARCHITECTURE.md` for the full reasoning. Short version:
- Shared access = edit access (no separate read-only mode) — matches the "collaborative editor" framing and kept scope tight.
- No password auth — seeded username login only.
- File import limited to `.txt`/`.md`, no `.docx`.
- No real-time multi-cursor collaboration (last-write-wins on save) — flagged as the top stretch item if given more time.

## What I'd Build Next (2-4 more hours)

1. Read-only vs. edit-access sharing distinction (a permission field on `sharedWith` instead of a flat array).
2. Basic `.docx` import via a lightweight parser.
3. A version history list (append-only log of saved snapshots) so edits aren't destructively overwritten.
4. Debounced conflict detection — currently last-write-wins if two people save near-simultaneously; a version counter would let the UI warn on conflict.
5. Real password-based auth (currently intentionally mocked per assignment allowance).

## Deploying

Because this has zero dependencies, deployment is simple on any Node host:
- **Railway:** point at this repo, start command `node server.js`, no build command needed.

