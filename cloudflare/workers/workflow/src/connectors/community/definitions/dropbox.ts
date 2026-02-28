import { createConnectorScaffold } from "../define";

export const dropboxConnector = createConnectorScaffold({
  "id": "dropbox",
  "displayName": "Dropbox",
  "description": "File ingestion and sync automation for cloud storage.",
  "providerUrl": "https://www.dropbox.com",
  "docsUrl": "https://www.dropbox.com/developers/documentation/http/documentation",
  "categories": [
    "storage",
    "files"
  ],
  "authStrategy": "oauth2",
  "requiredSecrets": [
    "DROPBOX_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "file_added",
      "title": "File Added",
      "summary": "Run when a file is added in a monitored path."
    }
  ],
  "actions": [
    {
      "key": "upload_file",
      "title": "Upload File",
      "summary": "Upload content into a Dropbox path."
    }
  ]
});
