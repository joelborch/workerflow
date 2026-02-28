import { createConnectorScaffold } from "../define";

export const microsoftTeamsConnector = createConnectorScaffold({
  "id": "microsoft_teams",
  "displayName": "Microsoft Teams",
  "description": "Team collaboration automation for channels and chats.",
  "providerUrl": "https://www.microsoft.com/microsoft-teams",
  "docsUrl": "https://learn.microsoft.com/graph/teams-concept-overview",
  "categories": [
    "communication",
    "team-chat"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "MICROSOFT_TEAMS_CLIENT_ID",
    "MICROSOFT_TEAMS_CLIENT_SECRET",
    "MICROSOFT_TEAMS_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "channel_message_posted",
      "title": "Channel Message Posted",
      "summary": "Run when a new channel message is posted."
    }
  ],
  "actions": [
    {
      "key": "send_channel_message",
      "title": "Send Channel Message",
      "summary": "Post a message into a Teams channel."
    }
  ]
});
