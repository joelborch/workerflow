#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE_URL:?Set API_BASE_URL}"
: "${API_INGRESS_TOKEN:?Set API_INGRESS_TOKEN}"
: "${TARGET_REPO:?Set TARGET_REPO (owner/repo)}"

curl -sS -X POST "${API_BASE_URL}/api/github_issue_create" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${API_INGRESS_TOKEN}" \
  -d "{
    \"repo\": \"${TARGET_REPO}\",
    \"title\": \"Webhook ingestion failure\",
    \"body\": \"Created automatically by WorkerFlow example.\",
    \"labels\": [\"automation\", \"workerflow\"]
  }"

echo
