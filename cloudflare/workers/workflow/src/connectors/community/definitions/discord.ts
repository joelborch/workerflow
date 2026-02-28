import { createConnectorScaffold } from "../define";

export const discordConnector = createConnectorScaffold({
  "id": "discord",
  "displayName": "Discord",
  "description": "Community messaging automation for servers and channels.",
  "providerUrl": "https://discord.com",
  "docsUrl": "https://discord.com/developers/docs/intro",
  "categories": [
    "communication",
    "community"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "DISCORD_BOT_TOKEN"
  ],
  "triggers": [
    {
      "key": "message_created",
      "title": "Message Created",
      "summary": "Run when a message is created in a channel."
    }
  ],
  "actions": [
    {
      "key": "send_channel_message",
      "title": "Send Channel Message",
      "summary": "Send a message to a configured channel."
    }
  ]
});
