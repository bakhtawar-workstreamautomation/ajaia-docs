# AI Workflow Note

## Which AI tools I used

I used **Claude (Anthropic)** as an AI pair programmer throughout this assignment — for architecture discussion, writing the initial implementation, generating the test suite, and drafting this documentation.

## Where AI materially sped up my work

- **Scaffolding the zero-dependency approach.** I wanted to avoid an `npm install` step for reviewer friction reasons, and talked through the tradeoff of Express+SQLite vs. a plain `http`-module + JSON-file approach. AI helped me quickly draft the plain-Node server and JSON store instead of hand-writing route parsing and file I/O boilerplate from scratch — real time savings on "glue code" that isn't where the interesting decisions are.
- **Test generation.** AI generated the first draft of the `node:test` suite covering permission edge cases (owner vs. shared vs. no-access, duplicate-share handling, unknown-username handling). I reviewed each case against the actual business rules I wanted enforced and adjusted assertions rather than accepting them blindly (see below).
- **The small Markdown→HTML converter for file import.** Writing a minimal, dependency-free markdown parser (headings/bold/italic/lists only) by hand is fiddly regex work; AI produced a first pass I then tested against edge cases (HTML-injection via `<script>` in a `.txt` upload, nested markdown) and hardened.
- **Documentation drafting** (this file, the README, the architecture note) — AI helped me get a structured first draft fast so I could spend more time on the actual product decisions than on formatting/wording.

## What AI-generated output I changed or rejected

- **Rejected: sharing as read-only by default.** The first draft treated `sharedWith` as view-only access. I changed this deliberately to full edit access after reconsidering what "collaborative document editor" actually implies, and documented the reasoning explicitly in `ARCHITECTURE.md` rather than leaving it as an unexamined default.
- **Rejected: SQLite/Postgres-based storage suggestion.** AI's first instinct was a real database with an ORM. I overrode this in favor of a documented JSON-file store, given the assignment explicitly permits it and it kept the project dependency-free — a decision about *fit for this specific scope*, not a default I accepted uncritically.
- **Changed: error handling granularity.** Initial API error responses were generic 500s in several places. I pushed for and verified specific status codes (400/401/403/404) with descriptive messages for every failure path, since "basic validation and error handling" is explicitly graded.
- **Changed: autosave debounce and the `beforeunload` flush.** First draft only autosaved on a timer; I added a flush-on-unload so navigating away or closing the tab right after typing doesn't silently lose the last few keystrokes.

## How I verified correctness, UX quality, and implementation reliability

- **I ran the actual server and hit every API route with `curl`** before considering anything "done" — login (valid/invalid user), document listing scoped per-user, create, edit, the three permission-denied cases (edit without access, share without ownership), the share-then-list flow, file import (valid `.md`, invalid `.pdf`), and 404 handling for a nonexistent document ID. I didn't just read the code and assume it worked.
- **I ran the full automated test suite (`node --test lib/*.test.js`)** and confirmed all 12 tests pass before treating the core logic as verified — covering creation defaults, permission enforcement (owner/shared/none), sharing rules (owner-only, no duplicates, unknown-username errors), and the markdown converter (including an HTML-escaping/injection check).
- **I explicitly tested persistence across a real process restart** — created and shared documents, killed the server process, restarted it, and confirmed the data was intact on disk in `data/db.json` — rather than assuming "it writes to a file" was sufficient proof.
- **UX verification was manual click-through** of the seeded-account flow described in the README (log in as alice → bob → carol, confirm the owned/shared split renders correctly, confirm the toolbar formatting options work as expected in Quill).

## The honest caveat

This note describes *my* process using Claude as a tool. If you're reading this as part of evaluating my candidacy: I did not have Claude "do the assignment" unsupervised — every architectural decision above (shared-access model, storage choice, error-handling standard, what to cut) was a call I made and can defend in a follow-up conversation, which is the actual thing this exercise is trying to assess.
