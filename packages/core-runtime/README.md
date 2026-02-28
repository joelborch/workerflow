# core-runtime

`core-runtime` now contains extracted manifest and route/schedule enablement primitives that are consumed by the Cloudflare runtime.

Current extracted modules:

- manifest resolution (`legacy` / `config` mode)
- route allow/deny parsing
- replay enablement checks for route/schedule tasks

Next extraction targets:

- queue dispatch/retry primitives
- D1 run/dead-letter helpers
- ops API query adapters
