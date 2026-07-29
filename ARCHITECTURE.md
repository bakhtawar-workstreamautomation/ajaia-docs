# Architecture Note

## What I prioritized, and why

Given the 4-6 hour timebox, I made a deliberate call early on: **spend the budget on making the core loop (create → edit → save → reopen → share) solid and demonstrably correct, rather than spreading effort thin across every optional feature.**

Concretely, in priority order:

1. **A permission model that's actually enforced server-side, not just hidden in the UI.** Owner-vs-shared-vs-no-access is checked on every API call (`hasAccess()` in `lib/store.js`), not just used to decide what to render. This felt like the highest-signal thing to get right for a "collaborative document editor" — a sharing feature that only exists in the frontend isn't really a sharing feature.
2. **Persistence that survives a real restart, not just a page refresh.** I explicitly tested this (see README) by creating documents, sharing them, killing the Node process, and restarting it — data was intact. Trivial with a JSON file, but worth stating I verified it rather than assumed it.
3. **A genuinely usable rich-text editing experience** (Quill.js) over building a custom `contenteditable` implementation. Rolling a rich-text editor from scratch is a multi-day project on its own; wiring up a proven library correctly, with autosave, is the higher-judgment choice for this timebox.
4. **Zero-dependency backend.** This was a deliberate infrastructure bet: by using only Node's `http`, `fs`, and `crypto` builtins (no Express, no ORM), the entire app runs with `node server.js` — no `npm install` step that could fail on a reviewer's machine due to a registry hiccup, a lockfile mismatch, or a native-module build issue. It also meant I could actually run and test the whole stack myself while building it, rather than writing code I couldn't verify.

## Key decisions & tradeoffs

**Shared access = edit access, not read-only.**
The assignment says "a visible distinction between owned and shared documents," not "view-only sharing." I chose to make shared access full edit access because (a) it matches the actual product framing — a *collaborative* editor implies co-editing, not just viewing — and (b) implementing a separate read-only mode would have meant either disabling Quill's toolbar conditionally (fiddly, easy to get subtly wrong) or building two editor code paths. I judged that the ownership/shared distinction in the sidebar (which the assignment explicitly asks for) was the important signal to nail, and a granular permissions system was better left as documented future work than half-built under time pressure.

**Mocked auth (seeded username, no password).**
Explicitly allowed by the assignment. Building real auth (password hashing, sessions, CSRF handling) would have consumed hours that were better spent on the actual document/sharing/editing logic the assignment is evaluating. The token model (`X-User-Id` header, checked against a seeded user list server-side) is intentionally simple but not fake — the server does verify the header maps to a real seeded user on every request; it's a legitimate access-control-lite pattern, just without password verification.

**JSON file storage instead of SQLite/Postgres.**
For this document count and concurrency profile (single-reviewer demo), a JSON file read/write-on-every-mutation is simpler to reason about and inspect (you can literally open `data/db.json` and read it) than standing up a database. The tradeoff is real: this wouldn't scale past a handful of concurrent writers (no locking, last-write-wins), which I call out explicitly rather than pretend it's production-grade. For a real second iteration, SQLite would be the natural next step — same deployment simplicity, real transactional guarantees.

**File import limited to `.txt` and `.md`.**
`.docx` parsing needs a real dependency (e.g., `mammoth`), which conflicted with the zero-dependency approach. Given the assignment explicitly says "if you limit supported file types, state that clearly," I treated this as a legitimate, disclosed scope cut rather than a gap — both the UI and README say plainly what's supported.

**Autosave over an explicit "Save" button.**
Debounced (~700ms after the user stops typing) autosave matches the mental model people already have from Google Docs, and it's what "the editing flow should feel usable and coherent" pointed me toward. A visible save-status indicator ("Editing… / Saving… / Saved ✓") keeps it from feeling opaque.

## What I deliberately did NOT build

- **Real-time multi-user collaboration** (simultaneous cursors, live co-editing via WebSockets/CRDTs). This is the single biggest thing a "Google Docs-inspired" brief could balloon into, and the assignment explicitly lists it as an *optional stretch*, not core scope. Building it properly (operational transforms or CRDTs) is itself a multi-day effort; a half-working version would be worse than a clearly-scoped absence of it.
- **Granular/role-based permissions** (viewer vs. editor vs. commenter) — see tradeoff above.
- **Version history** — noted as the first thing I'd build with more time, since the data model (append-only snapshots) is a natural extension of the current update path.
- **`.docx` import** — disclosed limitation, not a silent gap.

## Data model

```
User { id, username, displayName }
Document {
  id, title, content (HTML string from Quill),
  ownerId,
  sharedWith: [userId, ...],
  createdAt, updatedAt
}
```

Access rule: `hasAccess(doc, userId) = doc.ownerId === userId || doc.sharedWith.includes(userId)`, checked on every read and write in `server.js` before touching a document.
