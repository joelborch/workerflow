import { createConnectorScaffold } from "../define";

export const googleSheetsConnector = createConnectorScaffold({
  "id": "google_sheets",
  "displayName": "Google Sheets",
  "description": "Spreadsheet automation for row-level data operations.",
  "providerUrl": "https://workspace.google.com/products/sheets",
  "docsUrl": "https://developers.google.com/sheets/api",
  "categories": [
    "productivity",
    "data"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "GOOGLE_SHEETS_CLIENT_ID",
    "GOOGLE_SHEETS_CLIENT_SECRET",
    "GOOGLE_SHEETS_REFRESH_TOKEN"
  ],
  "triggers": [
    {
      "key": "new_row",
      "title": "New Row",
      "summary": "Run when a new row is appended to a sheet."
    }
  ],
  "actions": [
    {
      "key": "append_row",
      "title": "Append Row",
      "summary": "Append values as a new row in a sheet tab."
    }
  ]
});
