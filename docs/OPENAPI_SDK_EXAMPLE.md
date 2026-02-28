# OpenAPI SDK Example

WorkerFlow includes a TypeScript SDK example generated from `cloudflare/openapi.json`.

The generated client now emits typed request/response models from OpenAPI component schemas (instead of `unknown` placeholders).

## Generate the Client

```bash
cd cloudflare
npm run generate:sdk-example
```

Output:

- `examples/openapi-sdk-ts/src/generated/client.ts`

## Regeneration Workflow

1. Update `cloudflare/openapi.json`:
   - add or update `components.schemas`
   - wire endpoint responses/request bodies to those schemas
2. Regenerate:
   - `cd cloudflare && npm run generate:sdk-example`
3. Review generated diff:
   - `examples/openapi-sdk-ts/src/generated/client.ts`
4. Update example usage/docs if method signatures changed.

## Typed Coverage Included

Key endpoint models are typed in the generated client:

- `/api/health`
- `/api/{routePath}`
- `/api/ops/summary`
- `/api/ops/runs`
- `/api/ops/dead-letters`
- `/api/ops/replay/{traceId}`

## Use the Generated Client

See:

- `examples/openapi-sdk-ts/README.md`
- `examples/openapi-sdk-ts/src/example.ts`
