# Connector Registry

Machine-readable service registry for docs-first connector development.

## Files

- `services.json`: canonical service docs index used for connector planning and agent workflows

## Current Dataset

- top-100 connector research import
- includes priority rank + official docs + best base link + source attribution

## Notes

- Keep links official (vendor-owned docs) wherever possible.
- Keep one canonical `bestBaseLink` per service.
- Use `null` for unknown fields.
- Prefer stable docs landing pages over marketing pages.

## Maintenance Commands

From `cloudflare/`:

- refresh/normalize registry links and sources: `npm run service-registry:refresh`
- validate schema guarantees: `npm run test:service-registry`
- validate URL health (`2xx/3xx`): `npm run test:service-registry-urls`
