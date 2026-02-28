import { createConnectorScaffold } from "../define";

export const googleAnalyticsConnector = createConnectorScaffold({
  "id": "google_analytics",
  "displayName": "Google Analytics",
  "description": "Analytics and reporting automations for web properties.",
  "providerUrl": "https://analytics.google.com",
  "docsUrl": "https://developers.google.com/analytics",
  "categories": [
    "analytics",
    "marketing"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "GOOGLE_ANALYTICS_CLIENT_ID",
    "GOOGLE_ANALYTICS_CLIENT_SECRET",
    "GOOGLE_ANALYTICS_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "audience_threshold_met",
      "title": "Audience Threshold Met",
      "summary": "Run when a reporting threshold condition is met."
    }
  ],
  "actions": [
    {
      "key": "query_report",
      "title": "Query Report",
      "summary": "Run a report request for configured dimensions and metrics."
    }
  ]
});
