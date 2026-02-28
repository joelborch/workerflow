import { createConnectorScaffold } from "../define";

export const githubConnector = createConnectorScaffold({
  "id": "github",
  "displayName": "GitHub",
  "description": "Source control and CI/CD automations for engineering workflows.",
  "providerUrl": "https://github.com",
  "docsUrl": "https://docs.github.com/en/rest",
  "categories": [
    "developer-tools",
    "source-control"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "GITHUB_TOKEN"
  ],
  "triggers": [
    {
      "key": "pull_request_opened",
      "title": "Pull Request Opened",
      "summary": "Run when a new pull request is opened."
    }
  ],
  "actions": [
    {
      "key": "create_issue",
      "title": "Create Issue",
      "summary": "Create an issue in a repository with labels."
    }
  ]
});
