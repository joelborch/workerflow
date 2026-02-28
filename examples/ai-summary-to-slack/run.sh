#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE_URL:?Set API_BASE_URL}"
: "${API_INGRESS_TOKEN:?Set API_INGRESS_TOKEN}"

summary=$(curl -sS -X POST "${API_BASE_URL}/api/openai_chat" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${API_INGRESS_TOKEN}" \
  -d '{
    "model": "gpt-4o-mini",
    "systemPrompt": "You summarize incidents in one sentence.",
    "prompt": "Queue consumer retried 27 dead letters in 10 minutes. 5 still failed due to upstream 429 responses."
  }' | jq -r '.output')

curl -sS -X POST "${API_BASE_URL}/api/slack_message" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${API_INGRESS_TOKEN}" \
  -d "{\"text\":\"AI incident summary: ${summary}\"}"

echo
