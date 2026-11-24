import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Env } from "../shared/types";
import { createGithubIssue } from "../workers/workflow/src/connectors/github";
import { upsertHubspotContact, upsertHubspotDeal } from "../workers/workflow/src/connectors/hubspot";
import { createNotionDatabaseItem, getNotionDatabaseItem } from "../workers/workflow/src/connectors/notion";
import { createOpenAiChatCompletion } from "../workers/workflow/src/connectors/openai";
import { postSlackMessage } from "../workers/workflow/src/connectors/slack";
import { createStripePaymentIntent, upsertStripeCustomer } from "../workers/workflow/src/connectors/stripe";
import { handle as chatNotify } from "../workers/workflow/src/handlers/http/chat_notify";
import { handle as githubIssueCreate } from "../workers/workflow/src/handlers/http/github_issue_create";
import { handle as hubspotContactUpsert } from "../workers/workflow/src/handlers/http/hubspot_contact_upsert";
import { handle as hubspotDealUpsert } from "../workers/workflow/src/handlers/http/hubspot_deal_upsert";
import { handle as incidentCreate } from "../workers/workflow/src/handlers/http/incident_create";
import { handle as jsonTransform } from "../workers/workflow/src/handlers/http/json_transform";
import { handle as leadNormalizer } from "../workers/workflow/src/handlers/http/lead_normalizer";
import { handle as notionDatabaseItemCreate } from "../workers/workflow/src/handlers/http/notion_database_item_create";
import { handle as notionDatabaseItemGet } from "../workers/workflow/src/handlers/http/notion_database_item_get";
import { handle as openAiChat } from "../workers/workflow/src/handlers/http/openai_chat";
import { handle as payloadHash } from "../workers/workflow/src/handlers/http/payload_hash";
import { handle as slackMessage } from "../workers/workflow/src/handlers/http/slack_message";
import { handle as stripeCustomerUpsert } from "../workers/workflow/src/handlers/http/stripe_customer_upsert";
import { handle as stripePaymentIntentCreate } from "../workers/workflow/src/handlers/http/stripe_payment_intent_create";
import { handle as templateRender } from "../workers/workflow/src/handlers/http/template_render";
import { handle as textExtract } from "../workers/workflow/src/handlers/http/text_extract";
import { handle as webhookEcho } from "../workers/workflow/src/handlers/http/webhook_echo";
import { handle as webhookFanout } from "../workers/workflow/src/handlers/http/webhook_fanout";
import { createConnectorTestHarness, type ConnectorMockRule } from "./helpers/connector_harness";
import { jsonResponse } from "./helpers/d1";

function buildConnectorRules(onTextPost?: (url: string, text: string) => void): ConnectorMockRule[] {
  return [
    {
      name: "chat.webhook",
      match: (req) => req.url.hostname === "chat.example" || req.url.hostname === "hooks.example",
      respond: (req) => {
        const body = JSON.parse(req.bodyText || "{}") as { text?: unknown };
        onTextPost?.(req.url.toString(), typeof body.text === "string" ? body.text : "");
        return jsonResponse({ ok: true });
      }
    },
    {
      name: "slack",
      match: (req) => req.url.hostname === "hooks.slack.com" && req.method === "POST",
      respond: (req) => {
        const body = JSON.parse(req.bodyText || "{}") as { text?: unknown };
        onTextPost?.(req.url.toString(), typeof body.text === "string" ? body.text : "");
        return new Response("ok", { status: 200 });
      }
    },
    {
      name: "github.issue.create",
      match: (req) => req.url.hostname === "api.github.com" && req.url.pathname.endsWith("/issues"),
      respond: () => jsonResponse({ number: 42, html_url: "https://github.com/workerflow/example/issues/42" }, 201)
    },
    {
      name: "openai.chat",
      match: (req) => req.url.hostname === "api.openai.com" && req.url.pathname === "/v1/chat/completions",
      respond: () => jsonResponse({ choices: [{ message: { content: "Completion output" } }] })
    },
    {
      name: "stripe.payment_intent.create",
      match: (req) => req.url.hostname === "api.stripe.com" && req.url.pathname === "/v1/payment_intents",
      respond: () =>
        jsonResponse({
          id: "pi_fixture_123",
          status: "requires_confirmation",
          client_secret: "pi_fixture_123_secret",
          amount: 9900,
          currency: "usd"
        })
    },
    {
      name: "stripe.customer.lookup",
      match: (req) =>
        req.url.hostname === "api.stripe.com" && req.url.pathname === "/v1/customers" && req.url.searchParams.has("email"),
      respond: () => jsonResponse({ data: [] })
    },
    {
      name: "stripe.customer.create",
      match: (req) => req.url.hostname === "api.stripe.com" && req.url.pathname === "/v1/customers" && req.method === "POST",
      respond: () => jsonResponse({ id: "cus_fixture_123", email: "fixture@example.com", name: "Fixture User" })
    },
    {
      name: "notion.page.create",
      match: (req) => req.url.hostname === "api.notion.com" && req.url.pathname === "/v1/pages" && req.method === "POST",
      respond: () =>
        jsonResponse({
          object: "page",
          id: "notion-page-1",
          url: "https://notion.so/notion-page-1",
          archived: false,
          created_time: "2026-02-28T00:00:00.000Z",
          last_edited_time: "2026-02-28T00:00:00.000Z",
          properties: { Name: { id: "title", type: "title" } }
        })
    },
    {
      name: "notion.page.get",
      match: (req) => req.url.hostname === "api.notion.com" && req.url.pathname === "/v1/pages/notion-page-1" && req.method === "GET",
      respond: () =>
        jsonResponse({
          object: "page",
          id: "notion-page-1",
          url: "https://notion.so/notion-page-1",
          archived: false,
          created_time: "2026-02-28T00:00:00.000Z",
          last_edited_time: "2026-02-28T01:00:00.000Z",
          properties: { Name: { id: "title", type: "title" }, Status: { id: "status", type: "status" } }
        })
    },
    {
      name: "hubspot.contact.search",
      match: (req) =>
        req.url.hostname === "api.hubapi.com" && req.url.pathname === "/crm/v3/objects/contacts/search" && req.method === "POST",
      respond: () => jsonResponse({ results: [] })
    },
    {
      name: "hubspot.contact.create",
      match: (req) =>
        req.url.hostname === "api.hubapi.com" && req.url.pathname === "/crm/v3/objects/contacts" && req.method === "POST",
      respond: () => jsonResponse({ id: "hubspot-contact-1", properties: { email: "ava@example.com" } }, 201)
    },
    {
      name: "hubspot.deal.search",
      match: (req) =>
        req.url.hostname === "api.hubapi.com" && req.url.pathname === "/crm/v3/objects/deals/search" && req.method === "POST",
      respond: () => jsonResponse({ results: [] })
    },
    {
      name: "hubspot.deal.create",
      match: (req) =>
        req.url.hostname === "api.hubapi.com" && req.url.pathname === "/crm/v3/objects/deals" && req.method === "POST",
      respond: () =>
        jsonResponse({ id: "hubspot-deal-1", properties: { workerflow_external_id: "deal-123" } }, 201)
    }
  ];
}

describe("workflow handlers and connector harness", () => {
  it("executes all built-in HTTP route handlers with fixture payloads", async () => {
    const chatMessages: Array<{ url: string; text: string }> = [];
    const harness = createConnectorTestHarness(
      buildConnectorRules((url, text) => chatMessages.push({ url, text }))
    );

    const env = {
      ENV_NAME: "test",
      CHAT_WEBHOOK_URL: "https://chat.example/incoming",
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T000/B000/fixture",
      FANOUT_SHARED_WEBHOOK_URL: "https://hooks.example/default",
      OPENAI_API_KEY: "fixture-openai",
      GITHUB_TOKEN: "fixture-github-token",
      STRIPE_API_KEY: "fixture-stripe",
      NOTION_TOKEN: "fixture-notion",
      HUBSPOT_ACCESS_TOKEN: "fixture-hubspot",
      GITHUB_REPO: "workerflow/example",
      GOOGLEAI_API_KEY: "fixture-google-ai"
    } as unknown as Env;
    const context = { env };

    await harness.withMockedFetch(async () => {
      const echoResult = webhookEcho({ hello: "world" });
      assert.equal(echoResult.ok, true);
      assert.equal(echoResult.route, "webhook_echo");
      assert.deepEqual(echoResult.received, { hello: "world" });

      const normalized = leadNormalizer({
        body: {
          firstName: "Ava",
          lastName: "Ng",
          email: "AVA@Example.COM",
          phone: "(555) 111-2222",
          source: "landing_page"
        }
      });
      assert.equal(normalized.normalized.fullName, "Ava Ng");
      assert.equal(normalized.normalized.email, "ava@example.com");
      assert.equal(normalized.normalized.phone, "5551112222");

      const transform = jsonTransform({
        body: {
          data: { first_name: "Ava", last_name: "Ng", source: "form" },
          pick: ["first_name", "last_name"],
          rename: { first_name: "firstName", last_name: "lastName" }
        }
      });
      assert.deepEqual(transform.transformed, { firstName: "Ava", lastName: "Ng" });

      const extract = textExtract({ body: { text: "alpha beta gamma", pattern: "[a-z]+" } });
      assert.equal(extract.matchCount, 3);

      const rendered = templateRender({
        body: { template: "Hello {{name}} from {{team}}", values: { name: "Ava", team: "WorkerFlow" } }
      });
      assert.equal(rendered.rendered, "Hello Ava from WorkerFlow");

      const hashed = await payloadHash({ body: { value: "hash-me" } });
      assert.equal(hashed.algorithm, "SHA-256");
      assert.equal(hashed.hash.length, 64);

      const fanout = await webhookFanout(
        { body: { webhooks: ["https://hooks.example/one", "https://hooks.example/two"], payload: { event: "fanout" } } },
        "fixture-fanout",
        context
      );
      assert.equal(fanout.attempted, 2);
      assert.equal(fanout.delivered, 2);

      const notify = await chatNotify({ body: { text: "New event received" } }, "fixture-chat-notify", context);
      assert.equal(notify.delivered, true);

      const slack = await slackMessage({ body: { text: "Slack route fixture" } }, "fixture-slack", context);
      assert.equal(slack.delivered, true);

      const issue = await githubIssueCreate(
        { body: { title: "Fixture-created issue", body: "Created by WorkerFlow fixture test", labels: ["automation"] } },
        "fixture-github",
        context
      );
      assert.equal(issue.issueNumber, 42);
      assert.equal(issue.repository, "workerflow/example");

      const ai = await openAiChat({ body: { prompt: "Say hello", model: "gpt-4o-mini" } }, "fixture-openai", context);
      assert.equal(ai.output, "Completion output");

      const intent = await stripePaymentIntentCreate(
        { body: { amount: 9900, currency: "usd", description: "Fixture order" } },
        "fixture-stripe-intent",
        context
      );
      assert.equal(intent.paymentIntentId, "pi_fixture_123");

      const customer = await stripeCustomerUpsert(
        { body: { email: "fixture@example.com", name: "Fixture User" } },
        "fixture-stripe-customer",
        context
      );
      assert.equal(customer.customerId, "cus_fixture_123");
      assert.equal(customer.created, true);

      const notionCreated = await notionDatabaseItemCreate(
        { body: { databaseId: "db_fixture", properties: { Name: { title: [{ text: { content: "Fixture row" } }] } } } },
        "fixture-notion-create",
        context
      );
      assert.equal(notionCreated.pageId, "notion-page-1");

      const notionGet = await notionDatabaseItemGet({ body: { pageId: "notion-page-1" } }, "fixture-notion-get", context);
      assert.equal(notionGet.propertyCount, 2);

      const hubspotContact = await hubspotContactUpsert(
        { body: { email: "ava@example.com", properties: { firstname: "Ava", lastname: "Ng" } } },
        "fixture-hubspot-contact",
        context
      );
      assert.equal(hubspotContact.id, "hubspot-contact-1");
      assert.equal(hubspotContact.created, true);

      const hubspotDeal = await hubspotDealUpsert(
        {
          body: {
            idProperty: "workerflow_external_id",
            idValue: "deal-123",
            properties: { dealname: "Fixture Deal", amount: "5000" }
          }
        },
        "fixture-hubspot-deal",
        context
      );
      assert.equal(hubspotDeal.id, "hubspot-deal-1");
      assert.equal(hubspotDeal.created, true);

      const incident = await incidentCreate(
        { body: { title: "Queue lag", severity: "high", details: "consumer lag exceeded threshold" } },
        "fixture-incident",
        context
      );
      assert.equal(incident.delivered, true);
    });

    assert.ok(chatMessages.some((item) => item.url === "https://chat.example/incoming"));
    assert.ok(chatMessages.some((item) => item.url.startsWith("https://hooks.slack.com/services/")));
    assert.ok(chatMessages.some((item) => item.url === "https://hooks.example/one"));
    assert.ok(chatMessages.some((item) => item.url === "https://hooks.example/two"));
  });

  it("records expected HTTP calls through connector harness primitives", async () => {
    const harness = createConnectorTestHarness(buildConnectorRules());

    await harness.withMockedFetch(async () => {
      const slack = await postSlackMessage({
        webhookUrl: "https://hooks.slack.com/services/T123/B123/fixture",
        text: "Harness hello"
      });
      assert.equal(slack.ok, true);

      const github = await createGithubIssue({
        token: "fixture-token",
        repo: "workerflow/example",
        title: "Harness issue"
      });
      assert.equal(github.issueNumber, 42);

      const openAi = await createOpenAiChatCompletion({
        apiKey: "fixture-openai",
        model: "gpt-4o-mini",
        prompt: "Hello"
      });
      assert.equal(openAi.output, "Completion output");

      const stripeIntent = await createStripePaymentIntent({
        apiKey: "fixture-stripe",
        amount: 9900,
        currency: "usd",
        description: "Harness payment"
      });
      assert.equal(stripeIntent.id, "pi_fixture_123");

      const stripeCustomer = await upsertStripeCustomer({
        apiKey: "fixture-stripe",
        email: "fixture@example.com",
        name: "Harness User"
      });
      assert.equal(stripeCustomer.id, "cus_fixture_123");
      assert.equal(stripeCustomer.created, true);

      const notionCreated = await createNotionDatabaseItem({
        token: "fixture-notion",
        databaseId: "db-harness",
        properties: { Name: { title: [{ text: { content: "Harness" } }] } }
      });
      assert.equal(notionCreated.id, "notion-page-1");

      const notionRead = await getNotionDatabaseItem({
        token: "fixture-notion",
        pageId: "notion-page-1"
      });
      assert.equal(Object.keys(notionRead.properties).length, 2);

      const hubspotContact = await upsertHubspotContact({
        accessToken: "fixture-hubspot",
        email: "harness@example.com",
        properties: { firstname: "Harness" }
      });
      assert.equal(hubspotContact.id, "hubspot-contact-1");

      const hubspotDeal = await upsertHubspotDeal({
        accessToken: "fixture-hubspot",
        idProperty: "workerflow_external_id",
        idValue: "deal-123",
        properties: { dealname: "Harness Deal" }
      });
      assert.equal(hubspotDeal.id, "hubspot-deal-1");
    });

    for (const ruleName of [
      "slack",
      "github.issue.create",
      "openai.chat",
      "stripe.payment_intent.create",
      "stripe.customer.lookup",
      "stripe.customer.create",
      "notion.page.create",
      "notion.page.get",
      "hubspot.contact.search",
      "hubspot.contact.create",
      "hubspot.deal.search",
      "hubspot.deal.create"
    ]) {
      assert.equal(harness.callsForRule(ruleName).length, 1, `expected 1 call for ${ruleName}`);
    }
  });
});
