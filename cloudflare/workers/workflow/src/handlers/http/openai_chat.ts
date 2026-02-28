import type { Env } from "../../../../../shared/types";
import { createOpenAiChatCompletion } from "../../connectors/openai";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type OpenAiChatResult = {
  ok: true;
  route: "openai_chat";
  model: string;
  output: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function handle(requestPayload: unknown, _traceId: string, context?: HandlerContext): Promise<OpenAiChatResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const apiKey = envString(env, "OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const prompt = typeof body.prompt === "string" && body.prompt.trim().length > 0 ? body.prompt.trim() : "Say hello from WorkerFlow.";
  const modelFromBody = typeof body.model === "string" ? body.model.trim() : "";
  const model = modelFromBody || envString(env, "OPENAI_MODEL") || "gpt-4o-mini";
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : "";
  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature) ? Number(body.temperature) : undefined;

  const response = await createOpenAiChatCompletion({
    apiKey,
    model,
    prompt,
    systemPrompt,
    temperature
  });

  return {
    ok: true,
    route: "openai_chat",
    model,
    output: response.output
  };
}
