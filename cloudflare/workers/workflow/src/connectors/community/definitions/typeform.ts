import { createConnectorScaffold } from "../define";

export const typeformConnector = createConnectorScaffold({
  "id": "typeform",
  "displayName": "Typeform",
  "description": "Form submission automation for lead capture and surveys.",
  "providerUrl": "https://www.typeform.com",
  "docsUrl": "https://www.typeform.com/developers",
  "categories": [
    "forms",
    "marketing"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "TYPEFORM_TOKEN"
  ],
  "triggers": [
    {
      "key": "form_response_submitted",
      "title": "Form Response Submitted",
      "summary": "Run when a response is submitted for a form."
    }
  ],
  "actions": [
    {
      "key": "create_form",
      "title": "Create Form",
      "summary": "Create a form from a lightweight template payload."
    }
  ]
});
