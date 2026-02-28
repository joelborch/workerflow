import { createConnectorScaffold } from "../define";

export const xeroConnector = createConnectorScaffold({
  "id": "xero",
  "displayName": "Xero",
  "description": "Accounting sync for invoices, contacts, and reconciliations.",
  "providerUrl": "https://www.xero.com",
  "docsUrl": "https://developer.xero.com",
  "categories": [
    "accounting",
    "finance"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "XERO_CLIENT_ID",
    "XERO_CLIENT_SECRET",
    "XERO_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "invoice_authorized",
      "title": "Invoice Authorized",
      "summary": "Run when an invoice transitions to authorized."
    }
  ],
  "actions": [
    {
      "key": "create_contact",
      "title": "Create Contact",
      "summary": "Create a contact in a selected Xero tenant."
    }
  ]
});
