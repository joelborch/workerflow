import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(process.cwd(), "..");
const openApiPath = resolve(process.cwd(), "openapi.json");
const outPath = resolve(root, "examples/openapi-sdk-ts/src/generated/client.ts");

function pascalCase(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join("");
}

function methodName(httpMethod, path) {
  const normalizedPath = path.replace(/[{}]/g, "").replace(/\//g, " ");
  return `${httpMethod.toLowerCase()}${pascalCase(normalizedPath)}`;
}

function buildPathExpression(path, pathParams) {
  let rendered = path;
  for (const paramName of pathParams) {
    rendered = rendered.replace(`{${paramName}}`, `\${encodeURIComponent(${paramName})}`);
  }
  return `\`${rendered}\``;
}

function responseTypeName(httpMethod, path) {
  return `${pascalCase(httpMethod.toLowerCase())}${pascalCase(path.replace(/[{}]/g, ""))}Response`;
}

function run() {
  const openApiRaw = readFileSync(openApiPath, "utf8");
  const openApi = JSON.parse(openApiRaw);
  const operations = [];

  for (const [path, pathItem] of Object.entries(openApi.paths || {})) {
    for (const [httpMethod, operation] of Object.entries(pathItem || {})) {
      const method = httpMethod.toUpperCase();
      if (method !== "GET" && method !== "POST") {
        continue;
      }

      const parameters = Array.isArray(operation?.parameters) ? operation.parameters : [];
      const pathParams = parameters
        .filter((parameter) => parameter?.in === "path" && typeof parameter?.name === "string")
        .map((parameter) => parameter.name);

      operations.push({
        path,
        method,
        pathParams
      });
    }
  }

  const generatedAt = new Date().toISOString();
  const responseTypeLines = operations
    .map((operation) => `export type ${responseTypeName(operation.method, operation.path)} = unknown;`)
    .join("\n");

  const methodLines = operations
    .map((operation) => {
      const mName = methodName(operation.method, operation.path);
      const rType = responseTypeName(operation.method, operation.path);
      const pathArgs = operation.pathParams.map((name) => `${name}: string`);
      const maybeBodyArg = operation.method === "POST" ? ["body: unknown"] : [];
      const args = [...pathArgs, ...maybeBodyArg];

      const pathExpr = buildPathExpression(operation.path, operation.pathParams);
      const requestBodyArg = operation.method === "POST" ? ", body" : "";

      return `  async ${mName}(${args.join(", ")}): Promise<${rType}> {
    return this.request<${rType}>("${operation.method}", ${pathExpr}${requestBodyArg});
  }`;
    })
    .join("\n\n");

  const file = `/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT DIRECTLY
 * Source: cloudflare/openapi.json
 * Generated: ${generatedAt}
 */

export type WorkerFlowClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

${responseTypeLines}

export class WorkerFlowClient {
  private baseUrl: string;
  private token: string;
  private fetchImpl: typeof fetch;

  constructor(options: WorkerFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\\/+$/, "");
    this.token = options.token?.trim() || "";
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: HeadersInit = {
      "content-type": "application/json"
    };

    if (this.token) {
      headers.authorization = \`Bearer \${this.token}\`;
    }

    const response = await this.fetchImpl(\`\${this.baseUrl}\${path}\`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : \`WorkerFlow API request failed (\${response.status})\`;
      throw new Error(errorMessage);
    }

    return payload as T;
  }

${methodLines}
}
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, file);
  console.log(`generated SDK example client: ${outPath}`);
}

run();
