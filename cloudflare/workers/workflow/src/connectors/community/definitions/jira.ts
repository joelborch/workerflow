import { createConnectorScaffold } from "../define";

export const jiraConnector = createConnectorScaffold({
  "id": "jira",
  "displayName": "Jira Software Cloud",
  "description": "Issue tracking and sprint orchestration for software teams.",
  "providerUrl": "https://www.atlassian.com/software/jira",
  "docsUrl": "https://developer.atlassian.com/cloud/jira/platform/rest/v3",
  "categories": [
    "developer-tools",
    "project-management"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "JIRA_CLIENT_ID",
    "JIRA_CLIENT_SECRET",
    "JIRA_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "issue_created",
      "title": "Issue Created",
      "summary": "Run when a new issue is created in a project."
    }
  ],
  "actions": [
    {
      "key": "transition_issue",
      "title": "Transition Issue",
      "summary": "Move an issue to a new workflow state."
    }
  ]
});
