#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONFIG="workers/ops-dashboard/wrangler.smoke.jsonc"
PORT="${PORT:-8791}"
BASE_URL="http://127.0.0.1:${PORT}"
TOKEN="${OPS_DASHBOARD_TOKEN:-smoke-test-token}"
LOG_FILE="${TMPDIR:-/tmp}/ops-dashboard-dev.log"
RESPONSE_FILE="${TMPDIR:-/tmp}/ops-dashboard-response.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for smoke tests" >&2
  exit 1
fi

run_sql() {
  local sql="$1"
  npx wrangler d1 execute workerflow-runtime --local --config "$CONFIG" --command "$sql" >/dev/null
}

iso_minutes_ago() {
  node -e 'const minutes = Number(process.argv[1]); console.log(new Date(Date.now() - minutes * 60_000).toISOString())' "$1"
}

echo "Applying local D1 migrations for smoke test..."
npx wrangler d1 migrations apply workerflow-runtime --local --config "$CONFIG" >/dev/null

json_for_sql() {
  printf '%s' "$1" | sed "s/'/''/g"
}

wait_for_server() {
  local attempts=0
  while [[ $attempts -lt 40 ]]; do
    if curl -sS "$BASE_URL/health" >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 0.25
  done

  echo "ops-dashboard dev server did not become ready" >&2
  echo "----- wrangler log -----" >&2
  cat "$LOG_FILE" >&2 || true
  exit 1
}

assert_status() {
  local expected="$1"
  local actual="$2"
  if [[ "$expected" != "$actual" ]]; then
    echo "expected status $expected, got $actual" >&2
    cat "$RESPONSE_FILE" >&2 || true
    exit 1
  fi
}

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

run_sql "DELETE FROM runs; DELETE FROM dead_letters; DELETE FROM idempotency_keys; DELETE FROM cursor_state;"

SUCCESS_STARTED_AT="$(iso_minutes_ago 35)"
SUCCESS_FINISHED_AT="$(iso_minutes_ago 34)"
FAILED_STARTED_AT="$(iso_minutes_ago 25)"
FAILED_FINISHED_AT="$(iso_minutes_ago 24)"
STARTED_AT="$(iso_minutes_ago 15)"
ENQUEUED_AT="$(iso_minutes_ago 20)"
DEAD_LETTER_CREATED_AT="$(iso_minutes_ago 10)"

run_sql "
INSERT INTO runs (trace_id, kind, route_path, schedule_id, status, started_at, finished_at, output, error) VALUES
  ('trace-success-1', 'http_route', 'webhook_echo', NULL, 'succeeded', '${SUCCESS_STARTED_AT}', '${SUCCESS_FINISHED_AT}', '{"ok":true}', NULL),
  ('trace-failed-1', 'http_route', 'chat_notify', NULL, 'failed', '${FAILED_STARTED_AT}', '${FAILED_FINISHED_AT}', NULL, 'simulated failure'),
  ('trace-started-1', 'scheduled_job', NULL, 'heartbeat_hourly', 'started', '${STARTED_AT}', NULL, NULL, NULL);
"

DEAD_PAYLOAD=$(json_for_sql "{\"kind\":\"http_route\",\"traceId\":\"trace-dead-1\",\"routePath\":\"webhook_echo\",\"payload\":{\"body\":{\"smoke\":\"ok\"}},\"enqueuedAt\":\"${ENQUEUED_AT}\"}")
run_sql "
INSERT INTO dead_letters (trace_id, payload_json, error, created_at)
VALUES ('trace-dead-1', '${DEAD_PAYLOAD}', 'simulated dead letter', '${DEAD_LETTER_CREATED_AT}');
"

OPS_DASHBOARD_TOKEN="$TOKEN" npx wrangler dev --config "$CONFIG" --port "$PORT" --log-level error >"$LOG_FILE" 2>&1 &
DEV_PID=$!
wait_for_server

health_json="$(curl -fsS "$BASE_URL/health")"
echo "$health_json" | jq -e '.ok == true and .worker == "ops-dashboard"' >/dev/null

dashboard_html="$(curl -fsS "$BASE_URL/")"
printf '%s' "$dashboard_html" | rg -q "WorkerFlow Cloudflare Ops Deck"
printf '%s' "$dashboard_html" | rg -q "Summary"

unauth_status="$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" "$BASE_URL/api/summary")"
if [[ "$unauth_status" == "401" ]]; then
  cat "$RESPONSE_FILE" | jq -e '.error == "unauthorized"' >/dev/null
  echo "Auth mode: enabled"
elif [[ "$unauth_status" == "200" ]]; then
  cat "$RESPONSE_FILE" | jq -e '.totalRuns >= 0' >/dev/null
  echo "Auth mode: disabled (no OPS_DASHBOARD_TOKEN in worker env)"
else
  echo "unexpected status for unauthenticated /api/summary: $unauth_status" >&2
  cat "$RESPONSE_FILE" >&2 || true
  exit 1
fi

summary_json="$(curl -fsS -H "authorization: Bearer $TOKEN" "$BASE_URL/api/summary")"
echo "$summary_json" | jq -e '.totalRuns == 3 and .succeededRuns == 1 and .failedRuns == 1 and .startedRuns == 1 and .deadLetters == 1' >/dev/null

echo "$summary_json" | jq -e '.topRoutes | length >= 1' >/dev/null

runs_json="$(curl -fsS -H "authorization: Bearer $TOKEN" "$BASE_URL/api/runs?limit=2")"
echo "$runs_json" | jq -e '.limit == 2 and (.runs | length == 2)' >/dev/null

failed_runs_json="$(curl -fsS -H "authorization: Bearer $TOKEN" "$BASE_URL/api/runs?status=failed")"
echo "$failed_runs_json" | jq -e '.runs | length == 1' >/dev/null
echo "$failed_runs_json" | jq -e '.runs[0].status == "failed" and .runs[0].traceId == "trace-failed-1"' >/dev/null

schedule_runs_json="$(curl -fsS -H "authorization: Bearer $TOKEN" "$BASE_URL/api/runs?scheduleId=heartbeat_hourly")"
echo "$schedule_runs_json" | jq -e '.runs | length == 1' >/dev/null
echo "$schedule_runs_json" | jq -e '.runs[0].scheduleId == "heartbeat_hourly" and .runs[0].kind == "scheduled_job"' >/dev/null

dead_letters_json="$(curl -fsS -H "authorization: Bearer $TOKEN" "$BASE_URL/api/dead-letters?limit=5")"
echo "$dead_letters_json" | jq -e '.limit == 5 and (.deadLetters | length == 1)' >/dev/null
echo "$dead_letters_json" | jq -e '.deadLetters[0].traceId == "trace-dead-1"' >/dev/null

retry_status="$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X POST -H "authorization: Bearer $TOKEN" "$BASE_URL/api/retry/trace-dead-1")"
assert_status "202" "$retry_status"
NEW_TRACE_ID="$(cat "$RESPONSE_FILE" | jq -r '.newTraceId')"
if [[ -z "$NEW_TRACE_ID" || "$NEW_TRACE_ID" == "null" ]]; then
  echo "retry route did not return a new trace id" >&2
  cat "$RESPONSE_FILE" >&2
  exit 1
fi

missing_retry_status="$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X POST -H "authorization: Bearer $TOKEN" "$BASE_URL/api/retry/not-real")"
assert_status "404" "$missing_retry_status"
cat "$RESPONSE_FILE" | jq -e '.error == "dead letter not found"' >/dev/null

not_found_status="$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -H "authorization: Bearer $TOKEN" "$BASE_URL/api/not-a-real-route")"
assert_status "404" "$not_found_status"
cat "$RESPONSE_FILE" | jq -e '.error == "not found"' >/dev/null

echo "ops-dashboard smoke test passed"
