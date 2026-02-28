import { createConnectorScaffold } from "../define";

export const paypalConnector = createConnectorScaffold({
  "id": "paypal",
  "displayName": "PayPal",
  "description": "Payment and order lifecycle automation for commerce workflows.",
  "providerUrl": "https://www.paypal.com",
  "docsUrl": "https://developer.paypal.com",
  "categories": [
    "payments",
    "commerce"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET"
  ],
  "triggers": [
    {
      "key": "payment_captured",
      "title": "Payment Captured",
      "summary": "Run when a payment capture event is received."
    }
  ],
  "actions": [
    {
      "key": "create_invoice",
      "title": "Create Invoice",
      "summary": "Create a draft invoice for a customer and amount."
    }
  ]
});
