import { createConnectorScaffold } from "../define";

export const slackConnector = createConnectorScaffold({
  "id": "slack",
  "displayName": "Slack",
  "description": "Team messaging automation for channels, users, and mentions.",
  "providerUrl": "https://slack.com",
  "docsUrl": "https://api.slack.com",
  "categories": [
    "communication",
    "team-chat"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "SLACK_BOT_TOKEN"
  ],
  "triggers": [
    {
      "key": "message_posted",
      "title": "Message Posted",
      "summary": "Run when a channel message matches configured filters."
    }
  ],
  "actions": [
    {
      "key": "send_channel_message",
      "title": "Send Channel Message",
      "summary": "Post a message into a channel thread or root."
    }
  ]
});
