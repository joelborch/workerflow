import type { Env } from "../../../../../shared/types";
import { upsertHubspotContact } from "../../connectors/hubspot";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { asObject, unwrapObjectBody } from "../../lib/payload";

type HubspotContactUpsertResult = {
  ok: true;
  route: "hubspot_contact_upsert";
  id: string;
  email: string;
  created: boolean;
  idProperty: string;
};

export async function handle(
  requestPayload: unknown,
  _traceId: string,
  context?: EnvContext<Env>
): Promise<HubspotContactUpsertResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const accessToken = readEnvString(env, ["HUBSPOT_ACCESS_TOKEN"]);
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
