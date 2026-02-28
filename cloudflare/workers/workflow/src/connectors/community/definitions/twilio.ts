import { createConnectorScaffold } from "../define";

export const twilioConnector = createConnectorScaffold({
  "id": "twilio",
  "displayName": "Twilio",
  "description": "SMS and voice communication automation.",
  "providerUrl": "https://www.twilio.com",
  "docsUrl": "https://www.twilio.com/docs",
  "categories": [
    "communication",
    "sms"
  ],
  "authStrategy": "basic",
  "requiredSecrets": [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN"
  ],
  "triggers": [
    {
      "key": "sms_received",
      "title": "SMS Received",
      "summary": "Run when an inbound SMS is received."
    }
  ],
  "actions": [
    {
      "key": "send_sms",
      "title": "Send SMS",
      "summary": "Send an outbound SMS from a configured number."
    }
  ]
});
