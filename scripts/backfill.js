import { open, DB_PATH } from '../src/db.js';

// Backfills menu_items.price_vnd from menu_items.price in small batches.
// Runs while live traffic is actively serving.
// Each batch is a separate, short transaction to avoid holding locks.
// Re-runnable / idempotent: only updates rows where price_vnd IS NULL.

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 500);
const SLEEP_MS = Number(process.env.SLEEP_MS ?? 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const db = open();

const findNulls = db.prepare('SELECT id, price FROM menu_items WHERE price_vnd IS NULL LIMIT ?');
const updateItem = db.prepare('UPDATE menu_items SET price_vnd = CAST(round(? * 1000) AS INTEGER) WHERE id = ? AND price_vnd IS NULL');

console.log(`[Backfill] Starting backfill on ${DB_PATH}`);
console.log(`[Backfill] Batch size: ${BATCH_SIZE}, sleep between batches: ${SLEEP_MS}ms`);

const totalNullBefore = db.prepare('SELECT count(*) n FROM menu_items WHERE price_vnd IS NULL').get().n;
console.log(`[Backfill] Rows requiring backfill: ${totalNullBefore}`);

if (totalNullBefore === 0) {
  console.log('[Backfill] All rows already have price_vnd. Nothing to do.');
  process.exit(0);
}

let totalUpdated = 0;
let batchCount = 0;
const t0 = Date.now();

while (true) {
  const rows = findNulls.all(BATCH_SIZE);
  if (rows.length === 0) break;

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      updateItem.run(row.price, row.id);
      totalUpdated++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(`[Backfill] Error in batch ${batchCount + 1}: ${err.message}`);
    throw err;
  }

  batchCount++;
  if (batchCount % 5 === 0 || rows.length < BATCH_SIZE) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[Backfill] Batch ${batchCount.toString().padStart(3)}: updated ${totalUpdated.toString().padStart(5)} / ${totalNullBefore} (${elapsed}s)`);
  }

  if (SLEEP_MS > 0) {
    await sleep(SLEEP_MS);
  }
}

const elapsedTotal = ((Date.now() - t0) / 1000).toFixed(2);
const remainingNulls = db.prepare('SELECT count(*) n FROM menu_items WHERE price_vnd IS NULL').get().n;
console.log(`[Backfill] Completed! Updated ${totalUpdated} rows across ${batchCount} batches in ${elapsedTotal}s.`);
console.log(`[Backfill] Remaining NULL price_vnd rows: ${remainingNulls}`);
