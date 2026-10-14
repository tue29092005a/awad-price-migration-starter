# Self-Assessment Report (SELF_ASSESSMENT_REPORT.md)

**Student ID:** 23120398  
**Claimed Total:** 100 / 100  
**Submission Zip Name:** `23120398_100.zip`  
**Course:** CSC13114 — Advanced Web Application Development  
**Assignment:** IA#2 — Zero-Downtime Migration  

---

## 1. Rubric Self-Assessment Table

| Criterion | Max Points | Claimed Points | Evidence (File, Tag, Migration, or Log Line Range) |
| :--- | :---: | :---: | :--- |
| **1. The plan** | 20 | **20** | - [MIGRATION.md](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/MIGRATION.md): All 8 steps documented with Schema, Code version on instances, Exact undo command, and Safe compatible earlier versions.<br/>- Section 2 names Step 7 (`003_drop_price`) as the **Point of No Return** with technical rationale.<br/>- Table strictly matches Git tags (`v1`, `v2`, `v3`, `v4`) and migrations (`001`, `002`, `003`). |
| **2. Expand and dual write** | 20 | **20** | - [migrations/002_add_price_vnd.up.sql](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/migrations/002_add_price_vnd.up.sql) and [002_add_price_vnd.down.sql](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/migrations/002_add_price_vnd.down.sql).<br/>- Git tag `v2` ([src/app.js](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/src/app.js)): Writes both `price` and `price_vnd` on both write paths (`insert` and `setPrice`).<br/>- API offers `priceVnd` and returns `price`.<br/>- `npm run migrate:down` tested on isolated database with output recorded in [check-log.txt](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/check-log.txt#L5-L16). |
| **3. Backfill** | 15 | **15** | - [scripts/backfill.js](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/scripts/backfill.js): Runs in small batches (500 items/batch), each in its own short transaction (`BEGIN IMMEDIATE` / `COMMIT`) with 10ms sleep between batches while traffic runs.<br/>- Idempotent and re-runnable (`WHERE price_vnd IS NULL`), tested re-run produces 0 updates.<br/>- Ran only when both instances were on v2.<br/>- [check-log.txt](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/check-log.txt#L22-L24): Shows `CONSISTENT` right after it with `price_vnd_null: 0`. |
| **4. Zero failed requests** | 20 | **20** | - [traffic-log.txt](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/traffic-log.txt): Covers every deploy and migration with **215,412 requests** processed.<br/>- Ends with `RESULT: zero failed requests` with `error=0, contract=0, stale=0, unavailable=0`.<br/>- Rolling restarts visible as `down` / `back` lines for one instance at a time (e.g. lines 17–22, lines 100–115, lines 280–292).<br/>- `NEW_CLIENTS=0.3` was turned on dynamically after API offered `priceVnd` without breaking the continuous log run. |
| **5. The way back** | 15 | **15** | - Under live traffic, instances running `v3` (reading `price_vnd`) were rolled back to `v2` (reading `price`), then forward back to `v3`.<br/>- [traffic-log.txt](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/traffic-log.txt): Zero failures in the log throughout rollback and roll-forward (`error=0, contract=0, stale=0`).<br/>- [check-log.txt](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/check-log.txt#L29-L38): Shows `CONSISTENT` before, during, and after rollback.<br/>- [MIGRATION.md](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/MIGRATION.md) Section 3 explains why v3 $\rightarrow$ v2 rollback is safe and why later rollback after Step 7 would not be. |
| **6. Contract** | 10 | **10** | - Git tag `v4`: `price` is dropped only after code v4 (which neither reads nor writes `price`) was deployed on both instances.<br/>- [migrations/003_drop_price.up.sql](file:///d:/CNTT/2026-2027/PTUDW/BTVN_migration_without_downtime/awad-price-migration-starter/migrations/003_drop_price.up.sql) applied under live traffic.<br/>- After drop, old clients still get numeric `price` (thousands) dynamically in every response (`price: row.price_vnd / 1000`).<br/>- Log stayed clean with 0 contract errors. |
| **Total** | **100** | **100** | **All 6 criteria fully satisfied with concrete evidence.** |

---

## 2. What I Did Not Manage
- **None.** All 6 rubric criteria were completed in full. Zero failed requests were achieved across all deploys and schema changes, with 100% data consistency confirmed after every step.
