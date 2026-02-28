#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE_URL:?Set API_BASE_URL}"
: "${API_INGRESS_TOKEN:?Set API_INGRESS_TOKEN}"

curl -sS -X POST "${API_BASE_URL}/api/slack_message" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${API_INGRESS_TOKEN}" \
  -d '{
    "text": "WorkerFlow alert: queue lag threshold exceeded"
  }'

echo
