import { createConnectorScaffold } from "../define";

export const gmailConnector = createConnectorScaffold({
  "id": "gmail",
  "displayName": "Gmail",
  "description": "Mailbox automation for inbound and outbound email events.",
  "providerUrl": "https://mail.google.com",
  "docsUrl": "https://developers.google.com/gmail/api",
  "categories": [
    "email",
    "communication"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "email_received",
      "title": "Email Received",
      "summary": "Run when a new email matches search criteria."
    }
  ],
  "actions": [
    {
      "key": "send_email",
      "title": "Send Email",
      "summary": "Send an email with subject, body, and recipients."
    }
  ]
});
