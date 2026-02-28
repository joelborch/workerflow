# Public Export Checklist

Use this checklist when exporting from private production code into the public OSS repo.

## 1. Start from a Tagged Private Baseline

- Create a private tag first:
  - `git tag private-freeze-YYYYMMDD`
  - `git push origin private-freeze-YYYYMMDD`

## 2. Copy Only Reusable Runtime Layers

Include:

- `cloudflare/workers/*` runtime plumbing
- `cloudflare/shared/*` generic runtime helpers
- `cloudflare/scripts/*` generic validation/bootstrap tooling
- docs/schemas/openapi for platform setup

Exclude:

- business-specific handlers and recipe data
- customer/brand domains and URLs
- account identifiers and deployment version metadata

## 3. Sanitize Configuration

- Ensure all public config files contain placeholders:
  - `REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID`
  - `REPLACE_WITH_D1_DATABASE_ID`
  - `REPLACE_WITH_SECRETS_STORE_ID`
- Keep real IDs only in private deploy config.

## 4. Remove Sensitive References

Search and scrub:

- personal emails
- internal webhook URLs
- private workspace names
- customer domains
- account IDs, D1 IDs, store IDs

## 5. Keep Compatibility Contracts

- Export/update:
  - `cloudflare/contracts/routes.v1.json`
  - `cloudflare/contracts/schedules.v1.json`
- Run:
  - `cd cloudflare && npm run test:compat-contract`

## 6. Validate Public Build

Run full suite:

```bash
cd cloudflare
npm run release:check
```

## 7. Publish Public Release

- Update changelog/release notes.
- Tag and push:
  - `git tag vX.Y.Z`
  - `git push origin vX.Y.Z`

## 8. Re-sync Private

- Pull the public release back into private.
- Re-apply private-only recipes/config/deploy overlays.
- Run private CI including deploy guard:
  - `cd cloudflare && npm run deploy:guard:strict`
