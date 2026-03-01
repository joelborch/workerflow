#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) {
      continue;
    }

    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function splitWords(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function toSnakeCase(value) {
  return splitWords(value).join("_");
}

function toUpperSnake(value) {
  return splitWords(value).join("_").toUpperCase();
}

function toPascalCase(value) {
  return splitWords(value)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join("");
}

function ensureRouteId(routeId) {
  if (!/^[a-z][a-z0-9_]*$/.test(routeId)) {
    throw new Error("--route must use lowercase snake_case (example: acme_contact_upsert)");
  }
}

function ensureNonEmpty(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
}

function maybeWrite(filePath, content, options) {
  if (!options.force && existsSync(filePath)) {
    return { wrote: false, reason: "exists" };
  }
  if (options.dryRun) {
    return { wrote: false, reason: "dry-run" };
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return { wrote: true };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const serviceName = args.service;
  const routeId = args.route;
  const options = {
    force: args.force === "true",
    dryRun: args["dry-run"] === "true"
  };

  ensureNonEmpty(serviceName, "--service");
  ensureNonEmpty(routeId, "--route");
  ensureRouteId(routeId);

  const serviceSlug = toSnakeCase(args.slug ?? serviceName);
  const servicePascal = toPascalCase(serviceName);
  const routePascal = toPascalCase(routeId);
  const authType = args.auth ?? "api_key";
  const docsUrl = args.docs ?? "https://example.com/docs";
  const secretName = args.secret ?? `${toUpperSnake(serviceName)}_API_KEY`;
  const endpointEnvName = args.endpointEnv ?? `${toUpperSnake(serviceName)}_API_BASE_URL`;

  const connectorFile = join(process.cwd(), "workers", "workflow", "src", "connectors", `${serviceSlug}.ts`);
  const handlerFile = join(process.cwd(), "workers", "workflow", "src", "handlers", "http", `${routeId}.ts`);
  const scaffoldDocFile = join(process.cwd(), "connector-registry", "scaffolds", `${routeId}.md`);

  const connectorContent = `import { fetchWithRetry } from "./http_retry";

type Invoke${servicePascal}ApiArgs = {
  apiBaseUrl: string;
  apiToken: string;
  endpointPath: string;
  payload: Record<string, unknown>;
};

export async function invoke${servicePascal}Api(args: Invoke${servicePascal}ApiArgs) {
  const response = await fetchWithRetry(new URL(args.endpointPath, args.apiBaseUrl), {
    method: "POST",
    headers: {
      authorization: ` + "`Bearer ${args.apiToken}`" + `,
      "content-type": "application/json"
    },
    body: JSON.stringify(args.payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("${serviceName} API call failed: " + response.status + " " + response.statusText + " " + errorText);
  }

  return (await response.json()) as Record<string, unknown>;
}
`;

  const handlerContent = `import type { Env } from "../../../../../shared/types";
import { invoke${servicePascal}Api } from "../../connectors/${serviceSlug}";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type ${routePascal}Result = {
  ok: true;
  route: "${routeId}";
  provider: "${serviceName}";
  data: Record<string, unknown>;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function handle(requestPayload: unknown, _traceId: string, context?: HandlerContext): Promise<${routePascal}Result> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const endpointPath = typeof body.endpointPath === "string" && body.endpointPath.startsWith("/")
    ? body.endpointPath
    : "/v1/resource";

  const apiBaseUrl = envString(env, "${endpointEnvName}");
  const apiToken = envString(env, "${secretName}");

  if (!apiBaseUrl) {
    throw new Error("${endpointEnvName} is required");
  }

  if (!apiToken) {
    throw new Error("${secretName} is required");
  }

  const data = await invoke${servicePascal}Api({
    apiBaseUrl,
    apiToken,
    endpointPath,
    payload: body
  });

  return {
    ok: true,
    route: "${routeId}",
    provider: "${serviceName}",
    data
  };
}
`;

  const scaffoldDocContent = `# Connector Scaffold: ${routeId}

Generated by:

\`npm run connector:new -- --service "${serviceName}" --route ${routeId}\`

## Metadata

- service: ${serviceName}
- routeId: ${routeId}
- authType: ${authType}
- docs: ${docsUrl}
- required secrets:
  - ${secretName}
  - ${endpointEnvName}

## Files Created

- workers/workflow/src/connectors/${serviceSlug}.ts
- workers/workflow/src/handlers/http/${routeId}.ts

## Manual Wiring Required

1. Add route contract in \`cloudflare/shared/routes.ts\` and \`docs/ENTRYPOINTS.md\`.
2. Register handler import + map entry in \`workers/workflow/src/handlers/http/index.ts\`.
3. Add secret mapping in \`cloudflare/shared/connector_registry.ts\`.
4. Add fixture coverage in \`cloudflare/scripts/test_handler_fixtures.ts\`.
5. Add connector harness coverage in \`cloudflare/scripts/test_connector_harness.ts\`.
6. Add service docs row in \`cloudflare/connector-registry/services.json\` if missing.
7. Run \`npm run release:check\`.
`;

  if (!options.dryRun) {
    mkdirSync(join(process.cwd(), "connector-registry", "scaffolds"), { recursive: true });
  }
  const writes = [
    { path: connectorFile, result: maybeWrite(connectorFile, connectorContent, options) },
    { path: handlerFile, result: maybeWrite(handlerFile, handlerContent, options) },
    { path: scaffoldDocFile, result: maybeWrite(scaffoldDocFile, scaffoldDocContent, options) }
  ];

  console.log("connector scaffold generation complete");
  for (const item of writes) {
    const label = item.result.wrote ? "created" : `skipped (${item.result.reason})`;
    const relative = item.path.replace(`${process.cwd()}/`, "");
    console.log(`- ${label}: ${relative}`);
  }

  console.log("next steps:");
  console.log("1) wire route + handler index + connector registry");
  console.log("2) add tests and docs");
  console.log("3) run npm run release:check");
}

try {
  main();
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(reason);
  console.error(
    "usage: npm run connector:new -- --service \"<service name>\" --route <route_id> [--auth <auth>] [--secret <ENV_KEY>] [--endpointEnv <ENV_KEY>] [--docs <url>] [--dry-run]"
  );
  process.exit(1);
}
