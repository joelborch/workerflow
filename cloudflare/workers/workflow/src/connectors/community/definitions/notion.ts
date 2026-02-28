import { createConnectorScaffold } from "../define";

export const notionConnector = createConnectorScaffold({
  "id": "notion",
  "displayName": "Notion",
  "description": "Workspace and knowledge-base automation for docs and databases.",
  "providerUrl": "https://www.notion.com",
  "docsUrl": "https://developers.notion.com/reference/intro",
  "categories": [
    "knowledge-base",
    "productivity"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "NOTION_TOKEN"
  ],
  "triggers": [
    {
      "key": "database_item_created",
      "title": "Database Item Created",
      "summary": "Run when a page is created in a database."
    }
  ],
  "actions": [
    {
      "key": "create_database_item",
      "title": "Create Database Item",
      "summary": "Create a page in a target database."
    }
  ]
});
