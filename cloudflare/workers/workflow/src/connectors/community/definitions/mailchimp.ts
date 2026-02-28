import { createConnectorScaffold } from "../define";

export const mailchimpConnector = createConnectorScaffold({
  "id": "mailchimp",
  "displayName": "Mailchimp",
  "description": "Email campaign and audience sync automation.",
  "providerUrl": "https://mailchimp.com",
  "docsUrl": "https://mailchimp.com/developer/marketing/api",
  "categories": [
    "email",
    "marketing"
  ],
  "authStrategy": "api_key",
  "requiredSecrets": [
    "MAILCHIMP_API_KEY",
    "MAILCHIMP_SERVER_PREFIX"
  ],
  "triggers": [
    {
      "key": "subscriber_added",
      "title": "Subscriber Added",
      "summary": "Run when a contact is added to an audience."
    }
  ],
  "actions": [
    {
      "key": "add_subscriber",
      "title": "Add Subscriber",
      "summary": "Upsert a contact in a list with merge fields."
    }
  ]
});
