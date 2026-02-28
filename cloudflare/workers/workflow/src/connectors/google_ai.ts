type GenerateGoogleAiTextArgs = {
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
  responseMimeType?: string;
};

type GenerateGoogleAiTextResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
};

function normalizeText(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

export async function generateGoogleAiText(args: GenerateGoogleAiTextArgs) {
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent`);
  url.searchParams.set("key", args.apiKey);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: args.prompt }]
        }
      ],
      generationConfig: {
        temperature: args.temperature ?? 0,
        ...(args.responseMimeType ? { responseMimeType: args.responseMimeType } : {})
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google AI request failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = (await response.json()) as GenerateGoogleAiTextResponse;
  return normalizeText(data?.candidates?.[0]?.content?.parts?.[0]?.text).trim();
}

export async function tryGenerateGoogleAiText(args: GenerateGoogleAiTextArgs) {
  try {
    return await generateGoogleAiText(args);
  } catch {
    return "";
  }
}

