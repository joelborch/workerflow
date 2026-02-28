import { createConnectorScaffold } from "../define";

export const gitlabConnector = createConnectorScaffold({
  "id": "gitlab",
  "displayName": "GitLab",
  "description": "Code hosting, merge request, and CI workflow automation.",
  "providerUrl": "https://gitlab.com",
  "docsUrl": "https://docs.gitlab.com/ee/api",
  "categories": [
    "developer-tools",
    "source-control"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "GITLAB_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "merge_request_opened",
      "title": "Merge Request Opened",
      "summary": "Run when a merge request is opened."
    }
  ],
  "actions": [
    {
      "key": "create_issue",
      "title": "Create Issue",
      "summary": "Create a project issue with labels and assignees."
    }
  ]
});
