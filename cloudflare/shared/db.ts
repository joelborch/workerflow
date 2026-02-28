import type { QueueTask } from "./types";

export async function recordRunStart(db: D1Database, task: QueueTask) {
  await db
    .prepare(
      `INSERT INTO runs (trace_id, kind, route_path, schedule_id, status, started_at)
       VALUES (?1, ?2, ?3, ?4, 'started', ?5)
       ON CONFLICT(trace_id) DO UPDATE SET
         kind = excluded.kind,
         route_path = COALESCE(excluded.route_path, runs.route_path),
         schedule_id = COALESCE(excluded.schedule_id, runs.schedule_id),
         status = 'started',
         finished_at = NULL,
         output = NULL,
         error = NULL`
    )
    .bind(task.traceId, task.kind, task.routePath ?? null, task.scheduleId ?? null, new Date().toISOString())
    .run();
}

export async function recordRunSuccess(db: D1Database, traceId: string, output?: string) {
  await db
    .prepare(
      `UPDATE runs
       SET status = 'succeeded',
           finished_at = ?2,
           output = ?3
       WHERE trace_id = ?1`
    )
    .bind(traceId, new Date().toISOString(), output ?? null)
    .run();
}

export async function recordRunFailure(db: D1Database, traceId: string, errorText: string) {
  await db
    .prepare(
      `UPDATE runs
       SET status = 'failed',
           finished_at = ?2,
           error = ?3
       WHERE trace_id = ?1`
    )
    .bind(traceId, new Date().toISOString(), errorText)
    .run();
}

export async function isDuplicateDelivery(db: D1Database, traceId: string) {
  const row = await db
    .prepare(`SELECT trace_id FROM idempotency_keys WHERE trace_id = ?1 LIMIT 1`)
    .bind(traceId)
    .first<{ trace_id: string }>();

  return Boolean(row?.trace_id);
}

export async function markIdempotent(db: D1Database, traceId: string) {
  await db
    .prepare(`INSERT OR IGNORE INTO idempotency_keys (trace_id, created_at) VALUES (?1, ?2)`)
    .bind(traceId, new Date().toISOString())
    .run();
}

export async function writeDeadLetter(db: D1Database, traceId: string, payload: unknown, errorText: string) {
  const existing = await db
    .prepare(
      `SELECT id
       FROM dead_letters
       WHERE trace_id = ?1
         AND error = ?2
       LIMIT 1`
    )
    .bind(traceId, errorText)
    .first<{ id: number }>();

  if (existing?.id) {
    return;
  }

  await db
    .prepare(
      `INSERT INTO dead_letters (trace_id, payload_json, error, created_at)
       VALUES (?1, ?2, ?3, ?4)`
    )
    .bind(traceId, JSON.stringify(payload ?? {}), errorText, new Date().toISOString())
    .run();
}
