import { createConnectorScaffold } from "../define";

export const googleCalendarConnector = createConnectorScaffold({
  "id": "google_calendar",
  "displayName": "Google Calendar",
  "description": "Calendar event sync and scheduling automation.",
  "providerUrl": "https://calendar.google.com",
  "docsUrl": "https://developers.google.com/calendar/api",
  "categories": [
    "calendar",
    "productivity"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "GOOGLE_CALENDAR_CLIENT_ID",
    "GOOGLE_CALENDAR_CLIENT_SECRET",
    "GOOGLE_CALENDAR_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "event_started",
      "title": "Event Started",
      "summary": "Run when a calendar event starts."
    }
  ],
  "actions": [
    {
      "key": "create_event",
      "title": "Create Event",
      "summary": "Create an event in a selected calendar."
    }
  ]
});
