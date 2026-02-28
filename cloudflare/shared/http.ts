export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

export function readTraceId(request: Request) {
  const headerTraceId = request.headers.get("x-trace-id");
  if (headerTraceId && headerTraceId.trim().length > 0) {
    return headerTraceId.trim();
  }
  return crypto.randomUUID();
}

