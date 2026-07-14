#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${script_dir}/../../cloudflare/scripts/require-production-approval.sh" "deploy the WorkerFlow dashboard" "workerflow-dashboard production Pages project"

exec npx wrangler pages deploy dist --project-name workerflow-dashboard "$@"
