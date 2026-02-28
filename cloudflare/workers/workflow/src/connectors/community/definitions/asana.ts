import { createConnectorScaffold } from "../define";

export const asanaConnector = createConnectorScaffold({
  "id": "asana",
  "displayName": "Asana",
  "description": "Task and project automation for teams and operations.",
  "providerUrl": "https://asana.com",
  "docsUrl": "https://developers.asana.com",
  "categories": [
    "project-management"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "ASANA_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "task_completed",
      "title": "Task Completed",
      "summary": "Run when a task enters a completed state."
    }
  ],
  "actions": [
    {
      "key": "create_task",
      "title": "Create Task",
      "summary": "Create a task in a target project or workspace."
    }
  ]
});
