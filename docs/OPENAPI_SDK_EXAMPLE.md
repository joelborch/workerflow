# OpenAPI SDK Example

WorkerFlow includes a minimal TypeScript client generated from `cloudflare/openapi.json`.

## Generate the Client

```bash
cd cloudflare
npm run generate:sdk-example
```

Output:

- `examples/openapi-sdk-ts/src/generated/client.ts`

## Use the Generated Client

See:

- `examples/openapi-sdk-ts/README.md`
- `examples/openapi-sdk-ts/src/example.ts`

This example is intentionally minimal: it demonstrates generation + usage flow, and is a baseline for adding strongly-typed schemas later as the OpenAPI spec expands.
