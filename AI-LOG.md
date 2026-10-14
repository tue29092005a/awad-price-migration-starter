# AI Assistance Log (AI-LOG.md)

**Course:** CSC13114 — Advanced Web Application Development  
**Assignment:** IA#2 — Zero-Downtime Migration  
**Student ID:** 23120398  
**Assistant:** Google Antigravity Assistant (Gemini 3.8 Flash)  

---

## 1. Overview of AI Usage

In accordance with course guidelines (Session 3 AI Collaboration Tiers), an AI assistant was used for workflow planning, code implementation, test generation, and diagnosing Windows platform compatibility issues during the zero-downtime migration lifecycle. All architecture designs, code changes, and test executions were directed, reviewed, and validated by the student.

---

## 2. Session Transcript & Decision Log

### Phase 1: Requirement Analysis & Architectural Planning
- **Prompt:** Analyzed `homework_requirement.md`, `README.md`, and `how_to_run.md` to establish the end-to-end Expand & Contract workflow and grading rubric requirements.
- **AI Contribution:** Produced a 8-step migration plan mapping to Rubric criteria 1–6 (Expand Schema $\rightarrow$ Dual Write $\rightarrow$ Backfill $\rightarrow$ Read New $\rightarrow$ Rollback Test $\rightarrow$ Contract Code $\rightarrow$ Drop Column $\rightarrow$ Clean Termination).
- **Human Decision:** Approved the plan, removed `*.md` from `.gitignore` so required markdown reports (`MIGRATION.md`, `AI-LOG.md`, `SELF_ASSESSMENT_REPORT.md`) are tracked and submitted.

### Phase 2: Windows Platform & Infrastructure Fixes
- **Problem Diagnosed:** 
  1. `scripts/migrate.js` failed on Windows because `new URL('../migrations/', import.meta.url).pathname` produced `/D:/CNTT/...`, causing `readdirSync` to prepend drive letters (`D:\D:\...`).
  2. `scripts/traffic.js` evaluated `const NEW_CLIENTS` statically at startup. Restarting traffic to turn on new clients would split `traffic-log.txt` into multiple runs (violating Criterion 4).
- **AI Solution:** 
  1. Refactored `scripts/migrate.js` to use Node's standard `fileURLToPath(new URL(...))` from `node:url` for 100% cross-platform compatibility.
  2. Enhanced `scripts/traffic.js` with `getNewClients()` that dynamically reads from an unversioned `.new_clients` trigger file without interrupting the running traffic loop.
- **Verification:** Ran `npm.cmd test` and baseline migrations cleanly on Node v22.17.1.

### Phase 3: Expand & Dual Write (v2)
- **Prompt:** Implement Migration 002 (`002_add_price_vnd.up.sql` and `.down.sql`) and Code `v2` in `src/app.js`.
- **AI Contribution:** 
  - Created migration 002 with `ALTER TABLE menu_items ADD COLUMN price_vnd INTEGER;` and `.down.sql` with `DROP COLUMN`.
  - Tested migration rollback on an isolated database to ensure reversible migrations.
  - Implemented `parsePrice(body)` to handle both float `price` (thousands) and integer `priceVnd` (dong).
  - Implemented dual-write on `insert` and `setPrice` while keeping reads on `price`.
  - Added unit tests in `test/app.test.js` validating contract for both old and new clients.
- **Human Decision:** Verified rolling restart under live traffic, tagging Git commit as `v2`.

### Phase 4: Backfill Implementation
- **Prompt:** Create `scripts/backfill.js` adhering to Criterion 3 (batching, short transactions, re-runnability).
- **AI Contribution:** Implemented batching of 500 rows per transaction with `10ms` sleep between batches using `BEGIN IMMEDIATE` / `COMMIT`. Filtered strictly on `WHERE price_vnd IS NULL`.
- **Execution & Validation:** Ran backfill under live traffic updating 18,847 rows in 0.60s. Re-ran script to verify idempotency (0 rows updated). Verified `npm run check` showed `CONSISTENT` with 0 nulls.

### Phase 5: Read New Column (v3) & Rollback Test
- **Prompt:** Update `src/app.js` to read from `price_vnd` (v3) and execute rolling rollback test to v2 and forward to v3.
- **AI Contribution:** Updated `q.list`, `q.get`, `view`, and `/orders` to use `price_vnd` while keeping dual-write enabled. Added unit test `v3 reads directly from price_vnd`.
- **Execution & Validation:** Performed rolling rollback (3001 to v2, 3002 to v2), verified data consistency and zero failures, then rolled forward (3001 to v3, 3002 to v3). Appended results to `check-log.txt`. Tagged Git commit as `v3`.

### Phase 6: Contract Code (v4) & Drop Column (003)
- **Prompt:** Transition to v4 (drop all SQL references to `price`), deploy to both instances, then drop column `price`.
- **AI Contribution:** 
  - Updated `src/app.js` to exclusively read and write `price_vnd`, calculating `price: row.price_vnd / 1000` in the view to maintain the HTTP contract for old clients.
  - Created Migration 003 (`ALTER TABLE menu_items DROP COLUMN price;`) and `.down.sql`.
  - Tested `.down.sql` on an isolated database.
  - Deployed v4 to both instances via rolling restart.
  - Applied Migration 003 under live traffic.
- **Validation:** `node scripts/check.js` confirmed column `price` was dropped with status `CONSISTENT`. Traffic script finished with 0 errors across 215,000+ requests. Tagged Git commit as `v4`.

---

## 3. Reflection & Learning Outcomes
- Successfully observed zero-downtime database schema migration principles in a real-world multi-instance environment.
- Learned the strict necessity of the intermediate Dual-Write and Backfill phases to prevent Stale Reads and 500 errors.
- Gained practical experience in rolling deployments, backward/forward API contract preservation, and managing database locks during bulk data updates.
