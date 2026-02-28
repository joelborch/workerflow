import { createConnectorScaffold } from "../define";

export const salesforceConnector = createConnectorScaffold({
  "id": "salesforce",
  "displayName": "Salesforce",
  "description": "CRM record sync and activity orchestration for sales pipelines.",
  "providerUrl": "https://www.salesforce.com",
  "docsUrl": "https://developer.salesforce.com",
  "categories": [
    "crm",
    "sales"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "SALESFORCE_CLIENT_ID",
    "SALESFORCE_CLIENT_SECRET",
    "SALESFORCE_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "record_created",
      "title": "Record Created",
      "summary": "Run when a configured Salesforce object is created."
    }
  ],
  "actions": [
    {
      "key": "upsert_record",
      "title": "Upsert Record",
      "summary": "Create or update a CRM record by external key."
    }
  ]
});
