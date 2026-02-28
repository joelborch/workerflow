import assert from "node:assert/strict";

import { createGithubIssue } from "../workers/workflow/src/connectors/github";
import { upsertHubspotContact, upsertHubspotDeal } from "../workers/workflow/src/connectors/hubspot";
import { createNotionDatabaseItem, getNotionDatabaseItem } from "../workers/workflow/src/connectors/notion";
import { createOpenAiChatCompletion } from "../workers/workflow/src/connectors/openai";
import { postSlackMessage } from "../workers/workflow/src/connectors/slack";
import { createStripePaymentIntent, upsertStripeCustomer } from "../workers/workflow/src/connectors/stripe";
import { createConnectorTestHarness } from "./lib/connector_test_harness";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function run() {
  const harness = createConnectorTestHarness([
    {
      name: "slack",
      match: (request) => request.url.hostname === "hooks.slack.com" && request.method === "POST",
      respond: () => new Response("ok", { status: 200 })
    },
    {
      name: "github.issue.create",
      match: (request) => request.url.hostname === "api.github.com" && request.url.pathname.endsWith("/issues"),
      respond: () =>
        json(
          {
            number: 77,
            html_url: "https://github.com/workerflow/example/issues/77"
          },
          201
        )
    },
    {
      name: "openai.chat",
      match: (request) => request.url.hostname === "api.openai.com" && request.url.pathname === "/v1/chat/completions",
      respond: () =>
        json({
          choices: [
            {
              message: {
                content: "Harness completion"
              }
            }
          ]
        })
    },
    {
      name: "stripe.payment_intent.create",
      match: (request) => request.url.hostname === "api.stripe.com" && request.url.pathname === "/v1/payment_intents",
      respond: () =>
        json({
          id: "pi_harness_1",
          status: "requires_confirmation",
          client_secret: "pi_harness_1_secret",
          amount: 1200,
          currency: "usd"
        })
    },
    {
      name: "stripe.customer.lookup",
      match: (request) =>
        request.url.hostname === "api.stripe.com" &&
        request.url.pathname === "/v1/customers" &&
        request.url.searchParams.has("email"),
      respond: () => json({ data: [] })
    },
    {
      name: "stripe.customer.create",
      match: (request) =>
        request.url.hostname === "api.stripe.com" && request.url.pathname === "/v1/customers" && request.method === "POST",
      respond: () =>
        json({
          id: "cus_harness_1",
          email: "harness@example.com",
          name: "Harness User"
        })
    },
    {
      name: "notion.page.create",
      match: (request) => request.url.hostname === "api.notion.com" && request.url.pathname === "/v1/pages" && request.method === "POST",
      respond: () =>
        json({
          object: "page",
          id: "notion-harness-page",
          url: "https://notion.so/notion-harness-page",
          archived: false,
          created_time: "2026-02-28T00:00:00.000Z",
          last_edited_time: "2026-02-28T00:05:00.000Z",
          properties: {
            Name: { type: "title" }
          }
        })
    },
    {
      name: "notion.page.get",
      match: (request) =>
        request.url.hostname === "api.notion.com" && request.url.pathname === "/v1/pages/notion-harness-page" && request.method === "GET",
      respond: () =>
        json({
          object: "page",
          id: "notion-harness-page",
          url: "https://notion.so/notion-harness-page",
          archived: false,
          created_time: "2026-02-28T00:00:00.000Z",
          last_edited_time: "2026-02-28T00:06:00.000Z",
          properties: {
            Name: { type: "title" },
            Status: { type: "status" }
          }
        })
    },
    {
      name: "hubspot.contact.search",
      match: (request) =>
        request.url.hostname === "api.hubapi.com" &&
        request.url.pathname === "/crm/v3/objects/contacts/search" &&
        request.method === "POST",
      respond: () => json({ results: [] })
    },
    {
      name: "hubspot.contact.create",
      match: (request) =>
        request.url.hostname === "api.hubapi.com" && request.url.pathname === "/crm/v3/objects/contacts" && request.method === "POST",
      respond: () =>
        json(
          {
            id: "contact-harness-1",
            properties: {
              email: "harness@example.com"
            }
          },
          201
        )
    },
    {
      name: "hubspot.deal.search",
      match: (request) =>
        request.url.hostname === "api.hubapi.com" &&
        request.url.pathname === "/crm/v3/objects/deals/search" &&
        request.method === "POST",
      respond: () => json({ results: [] })
    },
    {
      name: "hubspot.deal.create",
      match: (request) =>
        request.url.hostname === "api.hubapi.com" && request.url.pathname === "/crm/v3/objects/deals" && request.method === "POST",
      respond: () =>
        json(
          {
            id: "deal-harness-1",
            properties: {
              workerflow_external_id: "deal-harness-42"
            }
          },
          201
        )
    }
  ]);

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
    assert.equal(github.issueNumber, 77);

    const openAi = await createOpenAiChatCompletion({
      apiKey: "fixture-openai",
      model: "gpt-4o-mini",
      prompt: "Hello"
    });
    assert.equal(openAi.output, "Harness completion");

    const stripeIntent = await createStripePaymentIntent({
      apiKey: "fixture-stripe",
      amount: 1200,
      currency: "usd",
      description: "Harness payment"
    });
    assert.equal(stripeIntent.id, "pi_harness_1");

    const stripeCustomer = await upsertStripeCustomer({
      apiKey: "fixture-stripe",
      email: "harness@example.com",
      name: "Harness User"
    });
    assert.equal(stripeCustomer.id, "cus_harness_1");
    assert.equal(stripeCustomer.created, true);

    const notionCreated = await createNotionDatabaseItem({
      token: "fixture-notion",
      databaseId: "db-harness",
      properties: {
        Name: {
          title: [{ text: { content: "Harness" } }]
        }
      }
    });
    assert.equal(notionCreated.id, "notion-harness-page");

    const notionRead = await getNotionDatabaseItem({
      token: "fixture-notion",
      pageId: "notion-harness-page"
    });
    assert.equal(Object.keys(notionRead.properties).length, 2);

    const hubspotContact = await upsertHubspotContact({
      accessToken: "fixture-hubspot",
      email: "harness@example.com",
      properties: {
        firstname: "Harness"
      }
    });
    assert.equal(hubspotContact.id, "contact-harness-1");

    const hubspotDeal = await upsertHubspotDeal({
      accessToken: "fixture-hubspot",
      idProperty: "workerflow_external_id",
      idValue: "deal-harness-42",
      properties: {
        dealname: "Harness Deal"
      }
    });
    assert.equal(hubspotDeal.id, "deal-harness-1");
  });

  assert.equal(harness.callsForRule("slack").length, 1);
  assert.equal(harness.callsForRule("github.issue.create").length, 1);
  assert.equal(harness.callsForRule("openai.chat").length, 1);
  assert.equal(harness.callsForRule("stripe.payment_intent.create").length, 1);
  assert.equal(harness.callsForRule("stripe.customer.lookup").length, 1);
  assert.equal(harness.callsForRule("stripe.customer.create").length, 1);
  assert.equal(harness.callsForRule("notion.page.create").length, 1);
  assert.equal(harness.callsForRule("notion.page.get").length, 1);
  assert.equal(harness.callsForRule("hubspot.contact.search").length, 1);
  assert.equal(harness.callsForRule("hubspot.contact.create").length, 1);
  assert.equal(harness.callsForRule("hubspot.deal.search").length, 1);
  assert.equal(harness.callsForRule("hubspot.deal.create").length, 1);

  console.log(`connector harness tests passed: calls=${harness.calls.length}`);
}

run().catch((error) => {
  console.error("connector harness tests failed", error);
  process.exitCode = 1;
});
