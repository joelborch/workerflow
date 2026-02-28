import { createConnectorScaffold } from "../define";

export const woocommerceConnector = createConnectorScaffold({
  "id": "woocommerce",
  "displayName": "WooCommerce",
  "description": "Store order and product automation for WordPress commerce.",
  "providerUrl": "https://woocommerce.com",
  "docsUrl": "https://woocommerce.github.io/woocommerce-rest-api-docs",
  "categories": [
    "commerce",
    "ecommerce"
  ],
  "authStrategy": "basic",
  "requiredSecrets": [
    "WOOCOMMERCE_BASE_URL",
    "WOOCOMMERCE_CONSUMER_KEY",
    "WOOCOMMERCE_CONSUMER_SECRET"
  ],
  "triggers": [
    {
      "key": "order_status_changed",
      "title": "Order Status Changed",
      "summary": "Run when an order changes status."
    }
  ],
  "actions": [
    {
      "key": "create_coupon",
      "title": "Create Coupon",
      "summary": "Create a coupon for discount campaigns."
    }
  ]
});
