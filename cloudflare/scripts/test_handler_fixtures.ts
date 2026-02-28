import assert from "node:assert/strict";

import type { Env } from "../shared/types";
import { handle as chatNotify } from "../workers/workflow/src/handlers/http/chat_notify";
import { handle as githubIssueCreate } from "../workers/workflow/src/handlers/http/github_issue_create";
import { handle as incidentCreate } from "../workers/workflow/src/handlers/http/incident_create";
import { handle as jsonTransform } from "../workers/workflow/src/handlers/http/json_transform";
import { handle as leadNormalizer } from "../workers/workflow/src/handlers/http/lead_normalizer";
import { handle as payloadHash } from "../workers/workflow/src/handlers/http/payload_hash";
import { handle as openAiChat } from "../workers/workflow/src/handlers/http/openai_chat";
import { handle as slackMessage } from "../workers/workflow/src/handlers/http/slack_message";
import { handle as templateRender } from "../workers/workflow/src/handlers/http/template_render";
import { handle as textExtract } from "../workers/workflow/src/handlers/http/text_extract";
import { handle as webhookEcho } from "../workers/workflow/src/handlers/http/webhook_echo";
import { handle as webhookFanout } from "../workers/workflow/src/handlers/http/webhook_fanout";

type ChatMessage = {
  url: string;
  text: string;
};

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ENV_NAME: "test",
    CHAT_WEBHOOK_URL: "https://chat.example/incoming",
    SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T000/B000/fixture",
    FANOUT_SHARED_WEBHOOK_URL: "https://hooks.example/default",
    OPENAI_API_KEY: "fixture-openai",
    GITHUB_TOKEN: "fixture-github-token",
    GITHUB_REPO: "workerflow/example",
    GOOGLEAI_API_KEY: "fixture-google-ai",
    ...overrides
  } as unknown as Env;
}

function mockFetch(chatMessages: ChatMessage[]) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl);

    if (url.hostname === "chat.example" || url.hostname === "hooks.example") {
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

    if (url.hostname === "hooks.slack.com") {
      const bodyText = String(init?.body ?? "{}");
      const bodyJson = JSON.parse(bodyText) as { text?: unknown };
      chatMessages.push({
        url: requestUrl,
        text: typeof bodyJson.text === "string" ? bodyJson.text : ""
      });
      return new Response("ok", { status: 200 });
    }

    if (url.hostname === "api.github.com" && url.pathname.endsWith("/issues")) {
      return new Response(
        JSON.stringify({
          number: 42,
          html_url: "https://github.com/workerflow/example/issues/42"
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.hostname === "api.openai.com" && url.pathname === "/v1/chat/completions") {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Fixture completion output" } }]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
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

    const transform = jsonTransform({
      body: {
        data: { first_name: "Ava", last_name: "Ng", source: "form" },
        pick: ["first_name", "last_name"],
        rename: { first_name: "firstName", last_name: "lastName" }
      }
    });
    assert.deepEqual(transform.transformed, { firstName: "Ava", lastName: "Ng" });

    const extract = textExtract({
      body: {
        text: "alpha beta gamma",
        pattern: "[a-z]+"
      }
    });
    assert.equal(extract.matchCount, 3);

    const rendered = templateRender({
      body: {
        template: "Hello {{name}} from {{team}}",
        values: { name: "Ava", team: "WorkerFlow" }
      }
    });
    assert.equal(rendered.rendered, "Hello Ava from WorkerFlow");

    const hashed = await payloadHash({
      body: {
        value: "hash-me"
      }
    });
    assert.equal(hashed.algorithm, "SHA-256");
    assert.equal(typeof hashed.hash, "string");
    assert.equal(hashed.hash.length, 64);

    const fanout = await webhookFanout(
      {
        body: {
          webhooks: ["https://hooks.example/one", "https://hooks.example/two"],
          payload: { event: "fanout" }
        }
      },
      "fixture-fanout",
      context
    );
    assert.equal(fanout.attempted, 2);
    assert.equal(fanout.delivered, 2);

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

    const slackResult = await slackMessage(
      {
        body: {
          text: "Slack route fixture"
        }
      },
      "fixture-slack",
      context
    );
    assert.equal(slackResult.route, "slack_message");
    assert.equal(slackResult.delivered, true);

    const githubIssueResult = await githubIssueCreate(
      {
        body: {
          title: "Fixture-created issue",
          body: "Created by WorkerFlow fixture test",
          labels: ["automation", "test"]
        }
      },
      "fixture-github",
      context
    );
    assert.equal(githubIssueResult.route, "github_issue_create");
    assert.equal(githubIssueResult.issueNumber, 42);
    assert.equal(githubIssueResult.repository, "workerflow/example");

    const openAiResult = await openAiChat(
      {
        body: {
          prompt: "Say hello",
          model: "gpt-4o-mini"
        }
      },
      "fixture-openai",
      context
    );
    assert.equal(openAiResult.route, "openai_chat");
    assert.equal(openAiResult.output, "Fixture completion output");

    const incidentResult = await incidentCreate(
      {
        body: {
          title: "Queue lag",
          severity: "high",
          details: "consumer lag exceeded threshold"
        }
      },
      "fixture-incident",
      context
    );
    assert.equal(incidentResult.route, "incident_create");
    assert.equal(incidentResult.delivered, true);

    assert.ok(chatMessages.some((item) => item.url === "https://chat.example/incoming"));
    assert.ok(chatMessages.some((item) => item.url.startsWith("https://hooks.slack.com/services/")));
    assert.ok(chatMessages.some((item) => item.url === "https://hooks.example/one"));
    assert.ok(chatMessages.some((item) => item.url === "https://hooks.example/two"));

    console.log(`handler fixture tests passed: postedMessages=${chatMessages.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error("handler fixture tests failed", error);
  process.exitCode = 1;
});
