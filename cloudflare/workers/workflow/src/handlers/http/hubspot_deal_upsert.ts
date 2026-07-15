import type { Env } from "../../../../../shared/types";
import { upsertHubspotDeal } from "../../connectors/hubspot";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { asObject, unwrapObjectBody } from "../../lib/payload";

type HubspotDealUpsertResult = {
  ok: true;
  route: "hubspot_deal_upsert";
  id: string;
  created: boolean;
  idProperty: string;
  idValue: string;
};

export async function handle(
  requestPayload: unknown,
  _traceId: string,
  context?: EnvContext<Env>
): Promise<HubspotDealUpsertResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const accessToken = readEnvString(env, ["HUBSPOT_ACCESS_TOKEN"]);
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
