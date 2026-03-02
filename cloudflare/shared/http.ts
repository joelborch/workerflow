export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data, sanitizeJsonReplacer), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

function sanitizeJsonReplacer(key: string, value: unknown) {
  if (key === "stack") {
    return undefined;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message
    };
  }
  return value;
}

export function readTraceId(request: Request) {
  const headerTraceId = request.headers.get("x-trace-id");
  if (headerTraceId && headerTraceId.trim().length > 0) {
    return headerTraceId.trim();
  }
  return crypto.randomUUID();
}
