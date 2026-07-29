# Submission Checklist

## Included in this folder

- [x] Source code (`server.js`, `lib/`, `public/`)
- [x] `README.md` — local setup/run instructions, feature summary, stated limitations
- [x] `ARCHITECTURE.md` — priorities, tradeoffs, what was deliberately cut
- [x] `AI_WORKFLOW.md` — how AI tools were used, what was changed/rejected, how correctness was verified
- [x] `SUBMISSION.md` — this file
- [x] Automated tests (`lib/store.test.js`, 12 passing tests, run via `npm test`)
- [ ] **Live deployment URL** — _add after deploying (see README "Deploying" section)_
- [ ] **Walkthrough video URL** — _add to `WALKTHROUGH_VIDEO.txt` after recording_
- [ ] Screenshots / demo GIF — _optional per the assignment ("if setup requires extra steps"); this project has no extra setup steps beyond `node server.js`, so I'm relying on the live URL + video instead. Add screenshots here if you'd still like them._

## What is working

- Document creation, renaming, rich-text editing (bold/italic/underline/headings/lists), autosave, reopen-after-refresh
- File import for `.txt` and `.md` (explicitly not `.docx` — stated limitation)
- Sharing: owner grants access by username; sidebar visibly separates "My Documents" vs. "Shared with Me"
- Persistence to a JSON file store, verified across a real process restart
- Server-side permission enforcement (403 on edit-without-access, 403 on share-without-ownership)
- Validation & error handling with correct HTTP status codes throughout the API
- 12 automated unit tests, all passing

## What is incomplete / explicitly out of scope

- Real-time multi-user collaboration (live cursors, concurrent co-editing) — optional stretch per the assignment, not attempted
- Read-only sharing mode (current model: shared = full edit access) — documented tradeoff in `ARCHITECTURE.md`
- `.docx` file import — disclosed limitation, `.txt`/`.md` only
- Version history — noted as the top priority for a follow-up iteration

## What I'd build next with another 2-4 hours

See the "What I'd Build Next" section of `README.md`: read/edit permission granularity, `.docx` import, version history, conflict-aware saving, real password auth.
