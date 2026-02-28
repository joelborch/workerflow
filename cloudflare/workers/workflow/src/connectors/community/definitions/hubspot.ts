import { createConnectorScaffold } from "../define";

export const hubspotConnector = createConnectorScaffold({
  "id": "hubspot",
  "displayName": "HubSpot",
  "description": "Marketing and CRM workflows for contacts, deals, and tickets.",
  "providerUrl": "https://www.hubspot.com",
  "docsUrl": "https://developers.hubspot.com",
  "categories": [
    "crm",
    "marketing"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "HUBSPOT_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "contact_updated",
      "title": "Contact Updated",
      "summary": "Run when contact properties change."
    }
  ],
  "actions": [
    {
      "key": "create_contact",
      "title": "Create Contact",
      "summary": "Create a contact with mapped profile fields."
    }
  ]
});
