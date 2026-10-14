# Zero-Downtime Migration Plan: `price` to `price_vnd`

**Course:** CSC13114 — Advanced Web Application Development  
**Assignment:** IA#2 — Zero-downtime migration  
**Student ID:** 23120398  
**Repository Tags:** `v1`, `v2`, `v3`, `v4`  
**Migrations:** `001_init`, `002_add_price_vnd`, `003_drop_price`  

---

## 1. Migration Steps Table

| Step | Schema After Step | Code Version (Instance A, Instance B) | Exact Undo Command | Safe Compatible Earlier Versions |
| :--- | :--- | :--- | :--- | :--- |
| **0. Baseline** | `menu_items(id, name, price)` | A: `v1`<br/>B: `v1` | N/A (initial state) | `v1` |
| **1. Expand Schema** | `menu_items(id, name, price, price_vnd NULL)` | A: `v1`<br/>B: `v1` | `npm run migrate:down` | `v1`, `v2` |
| **2. Dual Write** | `menu_items(id, name, price, price_vnd NULL)` | A: `v2`<br/>B: `v2`<br/>*(after rolling restart)* | Rolling restart instances back to `v1`: `PORT=3001 npm start` with tag `v1` | `v1`, `v2` |
| **3. Backfill** | `menu_items(id, name, price, price_vnd NOT NULL)` | A: `v2`<br/>B: `v2` | `sqlite3 data/app.db "UPDATE menu_items SET price_vnd = NULL;"` | `v1`, `v2`, `v3` |
| **4. Read New Column** | `menu_items(id, name, price, price_vnd NOT NULL)` | A: `v3`<br/>B: `v3`<br/>*(after rolling restart)* | Rolling restart instances back to `v2`: `PORT=3001 npm start` with tag `v2` | `v2`, `v3` |
| **5. Rollback Validation** | `menu_items(id, name, price, price_vnd NOT NULL)` | A: `v2`, B: `v2`<br/>$\rightarrow$ then A: `v3`, B: `v3` | Rolling restart forward back to `v3` | `v2`, `v3` |
| **6. Contract Code** | `menu_items(id, name, price, price_vnd NOT NULL)` | A: `v4`<br/>B: `v4`<br/>*(neither reads nor writes price)* | Rolling restart instances back to `v3` | `v2`, `v3`, `v4` |
| **7. Contract Schema (Point of No Return)** | `menu_items(id, name, price_vnd)` | A: `v4`<br/>B: `v4` | **Point of No Return!** See detailed rationale below. | `v4` only |

---

## 2. Point of No Return

### Which step is the Point of No Return?
**Step 7: Applying Migration `003_drop_price.up.sql` (`ALTER TABLE menu_items DROP COLUMN price;`)** is the Point of No Return.

### Why can it not be undone?
1. **Permanent Data Loss of Column `price`:**
   When SQLite executes `ALTER TABLE menu_items DROP COLUMN price;`, the data and column schema for `price` are permanently removed from the database storage engine.
2. **Immediate Crash of Earlier Code Versions:**
   Any earlier version of the application code (`v1`, `v2`, or `v3`) contains SQL statements that explicitly query or write to `menu_items.price` (such as `SELECT id, name, price ...` or `INSERT INTO menu_items (name, price, ...)`). If any instance were rolled back to `v1`, `v2`, or `v3` after Step 7, all database queries referencing `price` would immediately fail with `ERR_SQLITE_ERROR: no such column: price`, causing HTTP 500 errors and immediate downtime.
3. **Reverting Migration Schema Is Not Enough:**
   Even though `003_drop_price.down.sql` can re-add the `price` column (`ALTER TABLE menu_items ADD COLUMN price REAL;`), SQLite cannot restore the lost historical values; the re-added column would contain only `NULL`s. Restoring older versions would require a complete reverse backfill script while serving live traffic.

---

## 3. Rollback Safety Analysis

### Why is Rollback in Step 5 (v3 $\rightarrow$ v2) safe?
- **Dual Write is active in both v2 and v3:** In `v3`, all write paths (`POST /menu` and `PATCH /menu/:id`) continue writing both `price` (thousands of VND) and `price_vnd` (VND).
- **No stale reads:** When instances roll back to `v2` (which reads from `price`), the data in `price` is 100% fresh, consistent, and up-to-date with all writes that occurred while `v3` was serving.
- **Contract compatibility:** `v2` still exposes `priceVnd` in responses and accepts both `price` and `priceVnd` from new and old clients, so no clients experience any contract break or stale data.

### Why is rollback after Step 7 unsafe?
- Once Step 7 drops `price`, the database column is gone. Any instance running `v1`, `v2`, or `v3` will immediately crash on any SQL read/write referencing `price`. Only `v4` (which exclusively uses `price_vnd`) can safely run against the final schema.
