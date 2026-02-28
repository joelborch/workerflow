import type { QueueTask } from "./types";
import { resolveWorkspaceId } from "./workspace";

export async function recordRunStart(db: D1Database, task: QueueTask) {
  const workspaceId = resolveWorkspaceId(task.workspaceId);
  await db
    .prepare(
      `INSERT INTO runs (trace_id, workspace_id, kind, route_path, schedule_id, status, started_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'started', ?6)
       ON CONFLICT(trace_id) DO UPDATE SET
         workspace_id = COALESCE(excluded.workspace_id, runs.workspace_id),
         kind = excluded.kind,
         route_path = COALESCE(excluded.route_path, runs.route_path),
         schedule_id = COALESCE(excluded.schedule_id, runs.schedule_id),
         status = 'started',
         finished_at = NULL,
         output = NULL,
         error = NULL`
    )
    .bind(
      task.traceId,
      workspaceId,
      task.kind,
      task.routePath ?? null,
      task.scheduleId ?? null,
      new Date().toISOString()
    )
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

export async function writeDeadLetter(
  db: D1Database,
  traceId: string,
  payload: unknown,
  errorText: string,
  workspaceId?: string
) {
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
      `INSERT INTO dead_letters (trace_id, workspace_id, payload_json, error, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(
      traceId,
      resolveWorkspaceId(workspaceId),
      JSON.stringify(payload ?? {}),
      errorText,
      new Date().toISOString()
    )
    .run();
}

export async function recordAuditEvent(
  db: D1Database,
  input: {
    workspaceId?: string;
    actor: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  }
) {
  await db
    .prepare(
      `INSERT INTO audit_events (
         workspace_id,
         actor,
         action,
         resource_type,
         resource_id,
         details_json,
         created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(
      resolveWorkspaceId(input.workspaceId),
      input.actor.trim(),
      input.action.trim(),
      input.resourceType.trim(),
      input.resourceId?.trim() || null,
      JSON.stringify(input.details ?? {}),
      new Date().toISOString()
    )
    .run();
}
