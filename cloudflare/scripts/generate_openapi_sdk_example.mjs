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

function operationName(httpMethod, path, operation) {
  if (typeof operation?.operationId === "string" && operation.operationId.trim()) {
    return operation.operationId.trim();
  }
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

function responseTypeName(operationNameValue) {
  return `${pascalCase(operationNameValue)}Response`;
}

function requestTypeName(operationNameValue) {
  return `${pascalCase(operationNameValue)}Request`;
}

function queryTypeName(operationNameValue) {
  return `${pascalCase(operationNameValue)}Query`;
}

function componentRefToName(ref) {
  const prefix = "#/components/schemas/";
  if (typeof ref !== "string" || !ref.startsWith(prefix)) {
    return "unknown";
  }
  return ref.slice(prefix.length);
}

function quoteKeyIfNeeded(key) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : JSON.stringify(key);
}

function schemaToTs(schema, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel);
  const childIndent = "  ".repeat(indentLevel + 1);

  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  if (schema.$ref) {
    return componentRefToName(schema.$ref);
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return schema.oneOf.map((item) => schemaToTs(item, indentLevel)).join(" | ");
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf.map((item) => schemaToTs(item, indentLevel)).join(" | ");
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.map((item) => schemaToTs(item, indentLevel)).join(" & ");
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  const type = schema.type;
  if (Array.isArray(type) && type.length > 0) {
    return type.map((value) => schemaToTs({ ...schema, type: value, enum: undefined }, indentLevel)).join(" | ");
  }

  if (type === "string") {
    return "string";
  }
  if (type === "integer" || type === "number") {
    return "number";
  }
  if (type === "boolean") {
    return "boolean";
  }
  if (type === "null") {
    return "null";
  }
  if (type === "array") {
    return `Array<${schemaToTs(schema.items, indentLevel)}>`;
  }

  const hasProperties = schema.properties && typeof schema.properties === "object";
  const hasAdditionalProperties = Object.prototype.hasOwnProperty.call(schema, "additionalProperties");
  if (type === "object" || hasProperties || hasAdditionalProperties) {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const lines = [];

    if (hasProperties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const optional = required.has(key) ? "" : "?";
        lines.push(`${childIndent}${quoteKeyIfNeeded(key)}${optional}: ${schemaToTs(value, indentLevel + 1)};`);
      }
    }

    if (schema.additionalProperties === true) {
      lines.push(`${childIndent}[key: string]: unknown;`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      lines.push(`${childIndent}[key: string]: ${schemaToTs(schema.additionalProperties, indentLevel + 1)};`);
    }

    if (lines.length === 0) {
      return "Record<string, unknown>";
    }

    return `{\n${lines.join("\n")}\n${indent}}`;
  }

  return "unknown";
}

function operationResponseType(operation, operationNameValue) {
  const responses = operation?.responses && typeof operation.responses === "object" ? operation.responses : {};
  const found = [];

  for (const response of Object.values(responses)) {
    const schema = response?.content?.["application/json"]?.schema;
    if (schema) {
      found.push(schemaToTs(schema));
    }
  }

  const unique = [...new Set(found)];
  if (unique.length === 0) {
    return { name: responseTypeName(operationNameValue), value: "unknown" };
  }
  return { name: responseTypeName(operationNameValue), value: unique.join(" | ") };
}

function operationRequestType(operation, operationNameValue) {
  const schema = operation?.requestBody?.content?.["application/json"]?.schema;
  if (!schema) {
    return null;
  }
  return { name: requestTypeName(operationNameValue), value: schemaToTs(schema) };
}

function operationQueryType(operation, operationNameValue) {
  const parameters = Array.isArray(operation?.parameters) ? operation.parameters : [];
  const queryParams = parameters.filter((parameter) => parameter?.in === "query");
  if (queryParams.length === 0) {
    return null;
  }

  const lines = [];
  for (const parameter of queryParams) {
    const name = parameter?.name;
    if (typeof name !== "string" || !name) {
      continue;
    }
    const required = parameter?.required === true;
    const optional = required ? "" : "?";
    const schema = parameter?.schema && typeof parameter.schema === "object" ? parameter.schema : { type: "string" };
    lines.push(`  ${quoteKeyIfNeeded(name)}${optional}: ${schemaToTs(schema, 1)};`);
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    name: queryTypeName(operationNameValue),
    value: `{\n${lines.join("\n")}\n}`
  };
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

      const opName = operationName(method, path, operation);
      operations.push({
        path,
        method,
        operation: operation || {},
        operationName: opName,
        pathParams
      });
    }
  }

  const generatedAt = new Date().toISOString();
  const componentSchemas = openApi?.components?.schemas && typeof openApi.components.schemas === "object"
    ? openApi.components.schemas
    : {};

  const componentLines = Object.entries(componentSchemas)
    .map(([schemaName, schema]) => `export type ${schemaName} = ${schemaToTs(schema)};`)
    .join("\n\n");

  const responseTypeLines = operations
    .map((item) => operationResponseType(item.operation, item.operationName))
    .map((item) => `export type ${item.name} = ${item.value};`)
    .join("\n");

  const requestAndQueryLines = operations
    .flatMap((item) => {
      const lines = [];
      const requestType = operationRequestType(item.operation, item.operationName);
      if (requestType) {
        lines.push(`export type ${requestType.name} = ${requestType.value};`);
      }
      const queryType = operationQueryType(item.operation, item.operationName);
      if (queryType) {
        lines.push(`export type ${queryType.name} = ${queryType.value};`);
      }
      return lines;
    })
    .join("\n");

  const methodLines = operations
    .map((item) => {
      const pathExpr = buildPathExpression(item.path, item.pathParams);
      const opName = item.operationName;
      const responseType = responseTypeName(opName);
      const requestType = operationRequestType(item.operation, opName);
      const queryType = operationQueryType(item.operation, opName);

      const args = [];
      for (const paramName of item.pathParams) {
        args.push(`${paramName}: string`);
      }
      if (queryType) {
        args.push(`query: ${queryType.name} = {}`);
      }
      if (requestType) {
        args.push(`body: ${requestType.name}`);
      }

      const requestArgs = [`"${item.method}"`];
      const pathExpressionWithQuery = queryType ? `\`${pathExpr.slice(1, -1)}\${this.toQueryString(query)}\`` : pathExpr;
      requestArgs.push(pathExpressionWithQuery);
      if (requestType) {
        requestArgs.push("body");
      }

      return `  async ${opName}(${args.join(", ")}): Promise<${responseType}> {
    return this.request<${responseType}>(${requestArgs.join(", ")});
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

${componentLines}

${responseTypeLines}
${requestAndQueryLines ? `\n${requestAndQueryLines}` : ""}

export class WorkerFlowClient {
  private baseUrl: string;
  private token: string;
  private fetchImpl: typeof fetch;

  constructor(options: WorkerFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\\/+$/, "");
    this.token = options.token?.trim() || "";
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private toQueryString(query: Record<string, string | number | boolean | null | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      params.set(key, String(value));
    }
    const encoded = params.toString();
    return encoded ? \`?\${encoded}\` : "";
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
