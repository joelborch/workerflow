import { createConnectorScaffold } from "../define";

export const todoistConnector = createConnectorScaffold({
  "id": "todoist",
  "displayName": "Todoist",
  "description": "Task capture and completion automations for personal productivity.",
  "providerUrl": "https://todoist.com",
  "docsUrl": "https://developer.todoist.com/rest/v2",
  "categories": [
    "productivity"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "TODOIST_API_TOKEN"
  ],
  "triggers": [
    {
      "key": "task_added",
      "title": "Task Added",
      "summary": "Run when a new task is created in a project."
    }
  ],
  "actions": [
    {
      "key": "create_task",
      "title": "Create Task",
      "summary": "Create a task with content, due date, and labels."
    }
  ]
});
