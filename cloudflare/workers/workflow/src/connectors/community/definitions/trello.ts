import { createConnectorScaffold } from "../define";

export const trelloConnector = createConnectorScaffold({
  "id": "trello",
  "displayName": "Trello",
  "description": "Card-based planning and board movement automations.",
  "providerUrl": "https://trello.com",
  "docsUrl": "https://developer.atlassian.com/cloud/trello",
  "categories": [
    "project-management"
  ],
  "authStrategy": "api_key",
  "requiredSecrets": [
    "TRELLO_API_KEY",
    "TRELLO_TOKEN"
  ],
  "triggers": [
    {
      "key": "card_moved",
      "title": "Card Moved",
      "summary": "Run when a card is moved between lists."
    }
  ],
  "actions": [
    {
      "key": "create_card",
      "title": "Create Card",
      "summary": "Create a card on a board list with metadata."
    }
  ]
});
