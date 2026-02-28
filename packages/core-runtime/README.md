# core-runtime (Scaffold)

This package is the extraction target for the runtime currently implemented in `cloudflare/workers/*` and `cloudflare/shared/*`.

Planned contents:

- ingress API primitives
- queue dispatch/retry/dead-letter primitives
- manifest resolution
- ops API primitives
- D1 state utilities

During migration, runtime behavior remains sourced from `cloudflare/` to avoid breaking existing automations.
