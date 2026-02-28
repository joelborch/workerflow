import type { Env } from "../../../../../shared/types";
import { upsertHubspotContact } from "../../connectors/hubspot";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type HubspotContactUpsertResult = {
  ok: true;
  route: "hubspot_contact_upsert";
  id: string;
  email: string;
  created: boolean;
  idProperty: string;
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

export async function handle(
  requestPayload: unknown,
  _traceId: string,
  context?: HandlerContext
): Promise<HubspotContactUpsertResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const accessToken = envString(env, "HUBSPOT_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is required");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    throw new Error("hubspot_contact_upsert requires body.email");
  }

  const properties = asObject(body.properties);
  const idProperty = typeof body.idProperty === "string" && body.idProperty.trim() ? body.idProperty.trim() : "email";
  const result = await upsertHubspotContact({
    accessToken,
    email,
    properties,
    idProperty
  });

  return {
    ok: true,
    route: "hubspot_contact_upsert",
    id: result.id,
    email,
    created: result.created,
    idProperty: result.idProperty
  };
}
