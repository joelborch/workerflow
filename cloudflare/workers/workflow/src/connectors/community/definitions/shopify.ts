import { createConnectorScaffold } from "../define";

export const shopifyConnector = createConnectorScaffold({
  "id": "shopify",
  "displayName": "Shopify",
  "description": "Storefront, orders, and fulfillment workflow automation.",
  "providerUrl": "https://www.shopify.com",
  "docsUrl": "https://shopify.dev/docs/api",
  "categories": [
    "commerce",
    "ecommerce"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "SHOPIFY_SHOP_DOMAIN",
    "SHOPIFY_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "order_created",
      "title": "Order Created",
      "summary": "Run when a new order is created."
    }
  ],
  "actions": [
    {
      "key": "create_fulfillment",
      "title": "Create Fulfillment",
      "summary": "Create fulfillment for an existing order."
    }
  ]
});
