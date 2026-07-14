#!/usr/bin/env bash
set -euo pipefail

component="${1:-}"
if [[ -z "${component}" ]]; then
  echo "Usage: $0 <api|ops|scheduler|queue|workflow> [wrangler arguments]" >&2
  exit 2
fi
shift

case "${component}" in
  api) config="workers/api/wrangler.jsonc" ;;
  ops) config="workers/ops-dashboard/wrangler.jsonc" ;;
  scheduler) config="workers/scheduler/wrangler.jsonc" ;;
  queue) config="workers/queue-consumer/wrangler.jsonc" ;;
  workflow) config="workers/workflow/wrangler.jsonc" ;;
  *) echo "Unknown WorkerFlow component: ${component}" >&2; exit 2 ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${script_dir}/require-production-approval.sh" "deploy the WorkerFlow ${component} Worker" "Cloudflare production"

exec npx wrangler deploy --config "${config}" "$@"
