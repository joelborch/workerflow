export type ConnectorMockRequest = {
  url: URL;
  method: string;
  headers: Headers;
  bodyText: string;
};

export type ConnectorMockRule = {
  name: string;
  match: (request: ConnectorMockRequest) => boolean;
  respond: (request: ConnectorMockRequest) => Response | Promise<Response>;
};

export type ConnectorMockCall = {
  rule: string;
  request: ConnectorMockRequest;
};

function normalizeRequest(input: RequestInfo | URL, init?: RequestInit): ConnectorMockRequest {
  const urlString = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const fromRequest = typeof input !== "string" && !(input instanceof URL) ? input : null;
  const method = init?.method ?? fromRequest?.method ?? "GET";
  const headers = new Headers(init?.headers ?? fromRequest?.headers ?? {});
  const bodyText = typeof init?.body === "string" ? init.body : "";

  return {
    url: new URL(urlString),
    method: method.toUpperCase(),
    headers,
    bodyText
  };
}

export function createConnectorTestHarness(rules: ConnectorMockRule[]) {
  const calls: ConnectorMockCall[] = [];

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = normalizeRequest(input, init);
    const matchedRule = rules.find((rule) => rule.match(request));
    if (!matchedRule) {
      throw new Error(`No connector mock rule matched: ${request.method} ${request.url.toString()}`);
    }

    calls.push({
      rule: matchedRule.name,
      request
    });

    return matchedRule.respond(request);
  };

  async function withMockedFetch<T>(run: () => Promise<T>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      return await run();
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  function callsForRule(ruleName: string) {
    return calls.filter((call) => call.rule === ruleName);
  }

  return {
    calls,
    callsForRule,
    withMockedFetch
  };
}
