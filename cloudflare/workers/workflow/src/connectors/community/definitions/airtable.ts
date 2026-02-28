import { createConnectorScaffold } from "../define";

export const airtableConnector = createConnectorScaffold({
  "id": "airtable",
  "displayName": "Airtable",
  "description": "No-code table workflow automation for records and views.",
  "providerUrl": "https://airtable.com",
  "docsUrl": "https://airtable.com/developers/web/api/introduction",
  "categories": [
    "database",
    "productivity"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "AIRTABLE_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "record_updated",
      "title": "Record Updated",
      "summary": "Run when a table record is modified."
    }
  ],
  "actions": [
    {
      "key": "create_record",
      "title": "Create Record",
      "summary": "Create a record in a target table."
    }
  ]
});
