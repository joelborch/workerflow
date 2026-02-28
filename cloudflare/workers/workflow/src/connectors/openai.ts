import { fetchWithRetry } from "./http_retry";

type OpenAiChatCompletionArgs = {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

function normalizeCompletionText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const text = (item as Record<string, unknown>).text;
        return typeof text === "string" ? text : "";
      })
      .join("")
      .trim();
  }

  return "";
}

export async function createOpenAiChatCompletion(args: OpenAiChatCompletionArgs) {
  const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        ...(args.systemPrompt
          ? [
              {
                role: "system",
                content: args.systemPrompt
              }
            ]
          : []),
        {
          role: "user",
          content: args.prompt
        }
      ],
      temperature: args.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI chat completion failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = (await response.json()) as OpenAiChatCompletionResponse;
  const output = normalizeCompletionText(data?.choices?.[0]?.message?.content);

  return {
    output
  };
}
