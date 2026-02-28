# Community Connector Catalog

WorkerFlow ships a scaffolded community connector catalog so contributors can quickly expand real-world integrations.

Definitions live in:

- `cloudflare/workers/workflow/src/connectors/community/definitions/`

These are metadata-first scaffolds designed for rapid progression into production trigger/action implementations.

## Implemented Connector Routes (Production-Ready Baseline)

WorkerFlow currently ships nine executable connector-backed routes in the public runtime:

- `slack_message`
- `github_issue_create`
- `openai_chat`
- `stripe_payment_intent_create`
- `stripe_customer_upsert`
- `notion_database_item_create`
- `notion_database_item_get`
- `hubspot_contact_upsert`
- `hubspot_deal_upsert`

## Current Seed Connectors (30)

- `slack`
- `salesforce`
- `hubspot`
- `paypal`
- `asana`
- `stripe`
- `github`
- `trello`
- `todoist`
- `xero`
- `jira`
- `pipedrive`
- `zendesk`
- `google_analytics`
- `notion`
- `mailchimp`
- `shopify`
- `intercom`
- `gitlab`
- `woocommerce`
- `dropbox`
- `google_sheets`
- `gmail`
- `google_calendar`
- `airtable`
- `microsoft_teams`
- `twilio`
- `openai`
- `discord`
- `typeform`

## Connector Module Shape

Each connector module exports a typed `ConnectorDefinition` with:

- provider metadata (`id`, `displayName`, docs URL, categories)
- auth strategy and required secrets
- at least one trigger scaffold
- at least one action scaffold

## Validation

Connector quality checks run via:

```bash
cd cloudflare
npm run test:connector-catalog
npm run test:connector-harness
```

This is included in `npm run release:check`.

## How to Add a New Connector

1. add a new file in `cloudflare/workers/workflow/src/connectors/community/definitions/<slug>.ts`
2. export it from `definitions/index.ts` and include it in `CONNECTOR_DEFINITIONS`
3. use explicit secret names in `requiredSecrets` for agent-friendly provisioning
4. run `npm run release:check`

## Maturity Path: Scaffold -> Production

1. add a transport client with retries/timeouts and normalized errors
2. implement trigger ingestion strategy (webhook or poll cursor)
3. implement actions with idempotency-safe request keys where available
4. add fixture tests in `cloudflare/scripts/`
