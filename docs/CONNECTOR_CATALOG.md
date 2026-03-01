# Connector Model

WorkerFlow uses a docs-first connector model.

Instead of maintaining a large placeholder connector code catalog, the project keeps:

- executable runtime connector primitives
- a shared connector registry used by runtime and ops checks
- a service API docs index for LLM/agent implementation workflows

## Source Of Truth

- Runtime secret requirements and route mapping:
  - `cloudflare/shared/connector_registry.ts`
- Service docs index:
  - `docs/SERVICE_API_INDEX.md`
  - `docs/SERVICE_API_INDEX.html`
  - `cloudflare/connector-registry/services.json`
- Implementation contract:
  - `docs/CONNECTOR_BUILD_SPEC.md`
- Agent execution path:
  - `docs/AI_CONNECTOR_ONRAMP.md`

## Runtime Connectors (Executable Baseline)

WorkerFlow currently ships executable connector-backed routes for:

- chat webhooks (`chat_notify`, `incident_create`)
- Slack (`slack_message`)
- GitHub (`github_issue_create`)
- OpenAI (`openai_chat`)
- Stripe (`stripe_payment_intent_create`, `stripe_customer_upsert`)
- Notion (`notion_database_item_create`, `notion_database_item_get`)
- HubSpot (`hubspot_contact_upsert`, `hubspot_deal_upsert`)
- lead normalization AI key requirements (`lead_normalizer`)

## Validation

```bash
cd cloudflare
npm run test:connector-registry
npm run test:service-registry
npm run test:connector-harness
```

Both checks are included in `npm run release:check`.

## Contributor Flow

1. add/update a service entry in `cloudflare/connector-registry/services.json`
2. optionally scaffold files with `cd cloudflare && npm run connector:new -- --service "<name>" --route <route_id>`
3. add/update runtime route secret mapping in `cloudflare/shared/connector_registry.ts` (if route behavior changes)
4. implement connector route/primitive using `docs/CONNECTOR_BUILD_SPEC.md`
5. run `npm run release:check`

## Why Docs-First

- lower maintenance than large scaffold catalogs
- easier for agents to generate connector implementations from official APIs
- clearer distinction between executable runtime behavior and future service coverage
