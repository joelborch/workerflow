# Community Connector Catalog

WorkerFlow now ships a scaffolded community catalog of 30 high-demand connectors under:

- `cloudflare/workers/workflow/src/connectors/community/definitions/`

These are metadata-first scaffolds intended for rapid expansion into full trigger/action implementations.

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
```

Included in `npm run release:check`.

## How To Add A New Connector

1. Add a new file in `cloudflare/workers/workflow/src/connectors/community/definitions/<slug>.ts`.
2. Export it from `definitions/index.ts` and include it in `CONNECTOR_DEFINITIONS`.
3. Use explicit secret names in `requiredSecrets` for agent-friendly provisioning.
4. Run `npm run release:check`.

## Next Implementation Phase

To move a connector from scaffold to production-ready:

1. Add a transport client with retries/timeouts and error normalization.
2. Implement concrete trigger ingestion strategy (webhook or poll cursor).
3. Implement actions with idempotency-safe request keys where available.
4. Add fixture tests in `cloudflare/scripts/`.
