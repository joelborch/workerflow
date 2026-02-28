import assert from "node:assert/strict";

import type { Env } from "../shared/types";
import { handle as chatNotify } from "../workers/workflow/src/handlers/http/chat_notify";
import { handle as leadNormalizer } from "../workers/workflow/src/handlers/http/lead_normalizer";
import { handle as webhookEcho } from "../workers/workflow/src/handlers/http/webhook_echo";

type ChatMessage = {
  url: string;
  text: string;
};

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ENV_NAME: "test",
    CHAT_WEBHOOK_URL: "https://chat.example/incoming",
    GOOGLEAI_API_KEY: "fixture-google-ai",
    ...overrides
  } as unknown as Env;
}

function mockFetch(chatMessages: ChatMessage[]) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl);

    if (url.hostname === "chat.example") {
      const bodyText = String(init?.body ?? "{}");
      const bodyJson = JSON.parse(bodyText) as { text?: unknown };
      chatMessages.push({
        url: requestUrl,
        text: typeof bodyJson.text === "string" ? bodyJson.text : ""
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
}

async function run() {
  const originalFetch = globalThis.fetch;
  const chatMessages: ChatMessage[] = [];
  globalThis.fetch = mockFetch(chatMessages);

  try {
    const env = makeEnv();
    const context = { env };

    const echoResult = webhookEcho({ hello: "world" });
    assert.equal(echoResult.ok, true);
    assert.equal(echoResult.route, "webhook_echo");
    assert.deepEqual(echoResult.received, { hello: "world" });

    const normalizedResult = leadNormalizer({
      body: {
        firstName: "Ava",
        lastName: "Ng",
        email: "AVA@Example.COM",
        phone: "(555) 111-2222",
        source: "landing_page"
      }
    });

    assert.equal(normalizedResult.ok, true);
    assert.equal(normalizedResult.route, "lead_normalizer");
    assert.equal(normalizedResult.normalized.fullName, "Ava Ng");
    assert.equal(normalizedResult.normalized.email, "ava@example.com");
    assert.equal(normalizedResult.normalized.phone, "5551112222");
    assert.equal(normalizedResult.normalized.source, "landing_page");

    const notifyResult = await chatNotify(
      {
        body: {
          text: "New event received"
        }
      },
      "fixture-chat-notify",
      context
    );

    assert.equal(notifyResult.ok, true);
    assert.equal(notifyResult.route, "chat_notify");
    assert.equal(notifyResult.delivered, true);
    assert.equal(notifyResult.endpointHost, "chat.example");

    assert.equal(chatMessages.length, 1, "expected one chat message");
    assert.equal(chatMessages[0]?.url, "https://chat.example/incoming");
    assert.match(chatMessages[0]?.text ?? "", /WorkerFlow:fixture-chat-notify/);

    console.log(`handler fixture tests passed: postedMessages=${chatMessages.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error("handler fixture tests failed", error);
  process.exitCode = 1;
});
