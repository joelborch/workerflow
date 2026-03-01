# Service API Index

This file is the LLM/agent entrypoint for connector implementation.

It intentionally points to official vendor API docs and auth references instead of maintaining large placeholder connector code in-repo.

## Current Runtime Baseline (Executable)

| Service | Runtime Routes | Auth | Base Docs Link |
| --- | --- | --- | --- |
| Generic Chat Webhook | `chat_notify`, `incident_create` | webhook | <https://developers.google.com/workspace/chat/quickstart/webhooks> |
| Slack | `slack_message` | webhook/token | <https://api.slack.com/messaging/webhooks> |
| GitHub | `github_issue_create` | token | <https://docs.github.com/en/rest/issues/issues> |
| OpenAI | `openai_chat` | api_key | <https://platform.openai.com/docs/api-reference/chat> |
| Stripe | `stripe_payment_intent_create`, `stripe_customer_upsert` | api_key | <https://docs.stripe.com/api> |
| Notion | `notion_database_item_create`, `notion_database_item_get` | token/oauth2 | <https://developers.notion.com/reference/intro> |
| HubSpot | `hubspot_contact_upsert`, `hubspot_deal_upsert` | oauth2/token | <https://developers.hubspot.com/docs/api-reference/overview> |
| Google AI (lead normalizer key path) | `lead_normalizer` | api_key | <https://ai.google.dev/gemini-api/docs/text-generation> |

## Top 100 Service Links (Imported)

The Zapier Top-100 research dataset has been imported into:

- `cloudflare/connector-registry/services.json`

Current snapshot:

- rows: `100`
- rank range: `1..100`
- includes Zapier app links/evidence, official docs, base links, auth type, and source URLs

Quick examples from the imported set:

- `1` Google Sheets
- `2` Gmail
- `3` Slack
- `4` Google Calendar
- `5` Google Drive

Use this file as the canonical machine-readable source for connector discovery and agent prompts.

## Update Rules

1. Prefer official vendor docs over secondary tutorials.
2. Keep one canonical `best_base_link` per service.
3. Include source URLs for every row.
4. Use `null` for unknowns instead of guesses.
5. Keep links copy/paste-safe for agent prompts.
