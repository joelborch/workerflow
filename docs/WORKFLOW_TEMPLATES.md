# Workflow Templates

WorkerFlow exposes a starter template gallery from ops API:

- `GET /api/templates`

Templates are metadata-only seeds for common automation patterns and are intended to be copied into private overlays.

Included template families:

- Incident + Chat/Slack alerting
- Lead normalize and CRM sync
- GitHub issue escalation
- OpenAI summary fan-out
- Stripe payment/customer automations
- Notion database ingestion
- HubSpot contact/deal upserts

Use these templates to bootstrap route/schedule combinations, then replace placeholders with your own workflow logic.
