import { createConnectorScaffold } from "../define";

export const stripeConnector = createConnectorScaffold({
  "id": "stripe",
  "displayName": "Stripe",
  "description": "Billing and payment automation for subscriptions and checkouts.",
  "providerUrl": "https://stripe.com",
  "docsUrl": "https://docs.stripe.com/api",
  "categories": [
    "payments",
    "finance"
  ],
  "authStrategy": "api_key",
  "requiredSecrets": [
    "STRIPE_API_KEY"
  ],
  "triggers": [
    {
      "key": "payment_succeeded",
      "title": "Payment Succeeded",
      "summary": "Run when a successful payment event is emitted."
    }
  ],
  "actions": [
    {
      "key": "create_customer",
      "title": "Create Customer",
      "summary": "Create a customer and optional metadata tags."
    }
  ]
});
