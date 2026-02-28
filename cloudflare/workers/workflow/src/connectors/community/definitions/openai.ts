import { createConnectorScaffold } from "../define";

export const openaiConnector = createConnectorScaffold({
  "id": "openai",
  "displayName": "OpenAI",
  "description": "LLM and embeddings automation for AI workflows.",
  "providerUrl": "https://openai.com",
  "docsUrl": "https://platform.openai.com/docs",
  "categories": [
    "ai",
    "llm"
  ],
  "authStrategy": "api_key",
  "requiredSecrets": [
    "OPENAI_API_KEY"
  ],
  "triggers": [
    {
      "key": "prompt_received",
      "title": "Prompt Received",
      "summary": "Run when an upstream flow emits a prompt event."
    }
  ],
  "actions": [
    {
      "key": "chat_completion",
      "title": "Chat Completion",
      "summary": "Generate a completion from a chat prompt."
    }
  ]
});
