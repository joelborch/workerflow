# OpenAPI SDK Example (TypeScript)

This directory demonstrates a minimal TypeScript client generated from `cloudflare/openapi.json`.

## Generate

```bash
cd cloudflare
npm run generate:sdk-example
```

Generated file:

- `examples/openapi-sdk-ts/src/generated/client.ts`

## Example Usage

```ts
import { WorkerFlowClient } from "./generated/client";

const client = new WorkerFlowClient({
  baseUrl: "https://your-api-domain",
  token: process.env.API_INGRESS_TOKEN
});

await client.getApiHealth();
await client.postApiRoutePath("webhook_echo", { hello: "workerflow" });
```

Run the included sample:

```bash
WORKERFLOW_API_BASE_URL=http://127.0.0.1:8787 \
API_INGRESS_TOKEN=REPLACE_WITH_TOKEN \
npx tsx examples/openapi-sdk-ts/src/example.ts
```
