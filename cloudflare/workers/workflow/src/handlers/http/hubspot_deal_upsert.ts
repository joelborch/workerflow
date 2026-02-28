import type { Env } from "../../../../../shared/types";
import { upsertHubspotDeal } from "../../connectors/hubspot";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type HubspotDealUpsertResult = {
  ok: true;
  route: "hubspot_deal_upsert";
  id: string;
  created: boolean;
  idProperty: string;
  idValue: string;
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
): Promise<HubspotDealUpsertResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const accessToken = envString(env, "HUBSPOT_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is required");
  }

  const idProperty = typeof body.idProperty === "string" ? body.idProperty.trim() : "";
  const idValue = typeof body.idValue === "string" ? body.idValue.trim() : "";
  if (!idProperty || !idValue) {
    throw new Error("hubspot_deal_upsert requires body.idProperty and body.idValue");
  }

  const properties = asObject(body.properties);
  const result = await upsertHubspotDeal({
    accessToken,
    idProperty,
    idValue,
    properties
  });

  return {
    ok: true,
    route: "hubspot_deal_upsert",
    id: result.id,
    created: result.created,
    idProperty: result.idProperty,
    idValue: result.idValue
  };
}
