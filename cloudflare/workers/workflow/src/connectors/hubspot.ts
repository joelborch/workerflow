import { WorkflowHandlerError } from "../lib/errors";
import { fetchWithRetry } from "./http_retry";

type HubspotRequestArgs = {
  accessToken: string;
  method: "POST" | "PATCH";
  path: string;
  body: unknown;
};

type HubspotErrorPayload = {
  status?: unknown;
  message?: unknown;
  category?: unknown;
  subCategory?: unknown;
  correlationId?: unknown;
  context?: unknown;
};

type HubspotSearchResponse = {
  results?: Array<{
    id?: unknown;
    properties?: unknown;
  }>;
};

type HubspotObjectResponse = {
  id?: unknown;
  properties?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type HubspotContactUpsertArgs = {
  accessToken: string;
  email: string;
  properties: Record<string, unknown>;
  idProperty?: string;
};

type HubspotDealUpsertArgs = {
  accessToken: string;
  idProperty: string;
  idValue: string;
  properties: Record<string, unknown>;
};

type HubspotObjectType = "contacts" | "deals";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeProperties(properties: Record<string, unknown>) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    const cleanKey = key.trim();
    if (!cleanKey) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[cleanKey] = value;
    }
  }
  return out;
}

function normalizeHubspotError(payload: HubspotErrorPayload | null, fallbackBody: string) {
  const normalized = {
    message: payload?.message ? String(payload.message) : fallbackBody || "HubSpot request failed",
    category: payload?.category ? String(payload.category) : "",
    subCategory: payload?.subCategory ? String(payload.subCategory) : "",
    status: payload?.status ? String(payload.status) : "",
    correlationId: payload?.correlationId ? String(payload.correlationId) : "",
    context: asObject(payload?.context)
  };

  const codeParts = [normalized.category, normalized.subCategory].filter(Boolean);
  const code = codeParts.length > 0 ? `hubspot_${codeParts.join("_").toLowerCase()}` : "hubspot_error";

  return {
    code,
    message: normalized.message,
    details: {
      category: normalized.category || null,
      subCategory: normalized.subCategory || null,
      status: normalized.status || null,
      correlationId: normalized.correlationId || null,
      context: normalized.context
    }
  };
}

async function hubspotRequest<T>(args: HubspotRequestArgs) {
  try {
    const response = await fetchWithRetry(`${HUBSPOT_API_BASE}${args.path}`, {
      method: args.method,
      headers: {
        authorization: `Bearer ${args.accessToken.trim()}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(args.body)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as HubspotErrorPayload | null;
      const fallbackBody = payload ? "" : await response.text().catch(() => "");
      const normalized = normalizeHubspotError(payload, fallbackBody);
      throw new WorkflowHandlerError(normalized.message, {
        code: normalized.code,
        status: response.status,
        details: normalized.details
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof WorkflowHandlerError) {
      throw error;
    }
    throw new WorkflowHandlerError(error instanceof Error ? error.message : String(error), {
      code: "hubspot_network_error",
      status: 502
    });
  }
}

async function searchHubspotObjectByProperty(
  accessToken: string,
  objectType: HubspotObjectType,
  propertyName: string,
  propertyValue: string
) {
  const searchPayload = {
    filterGroups: [
      {
        filters: [
          {
            propertyName,
            operator: "EQ",
            value: propertyValue
          }
        ]
      }
    ],
    limit: 1
  };

  const search = await hubspotRequest<HubspotSearchResponse>({
    accessToken,
    method: "POST",
    path: `/crm/v3/objects/${objectType}/search`,
    body: searchPayload
  });

  const id = asText(search.results?.[0]?.id);
  return id || null;
}

async function upsertHubspotObject(args: {
  accessToken: string;
  objectType: HubspotObjectType;
  idProperty: string;
  idValue: string;
  properties: Record<string, unknown>;
}) {
  const cleanIdProperty = args.idProperty.trim();
  const cleanIdValue = args.idValue.trim();
  if (!cleanIdProperty || !cleanIdValue) {
    throw new WorkflowHandlerError("HubSpot upsert requires idProperty and idValue", {
      code: "hubspot_invalid_payload",
      status: 400
    });
  }

  const normalizedProperties = normalizeProperties(args.properties);
  normalizedProperties[cleanIdProperty] = cleanIdValue;

  const existingId = await searchHubspotObjectByProperty(
    args.accessToken,
    args.objectType,
    cleanIdProperty,
    cleanIdValue
  );

  if (existingId) {
    const updated = await hubspotRequest<HubspotObjectResponse>({
      accessToken: args.accessToken,
      method: "PATCH",
      path: `/crm/v3/objects/${args.objectType}/${encodeURIComponent(existingId)}`,
      body: {
        properties: normalizedProperties
      }
    });

    return {
      id: asText(updated.id),
      created: false as const,
      idProperty: cleanIdProperty,
      idValue: cleanIdValue,
      properties: asObject(updated.properties)
    };
  }

  const created = await hubspotRequest<HubspotObjectResponse>({
    accessToken: args.accessToken,
    method: "POST",
    path: `/crm/v3/objects/${args.objectType}`,
    body: {
      properties: normalizedProperties
    }
  });

  return {
    id: asText(created.id),
    created: true as const,
    idProperty: cleanIdProperty,
    idValue: cleanIdValue,
    properties: asObject(created.properties)
  };
}

export async function upsertHubspotContact(args: HubspotContactUpsertArgs) {
  const email = args.email.trim().toLowerCase();
  if (!email) {
    throw new WorkflowHandlerError("HubSpot contact upsert requires email", {
      code: "hubspot_invalid_payload",
      status: 400
    });
  }

  return upsertHubspotObject({
    accessToken: args.accessToken,
    objectType: "contacts",
    idProperty: args.idProperty?.trim() || "email",
    idValue: email,
    properties: args.properties
  });
}

export async function upsertHubspotDeal(args: HubspotDealUpsertArgs) {
  return upsertHubspotObject({
    accessToken: args.accessToken,
    objectType: "deals",
    idProperty: args.idProperty,
    idValue: args.idValue,
    properties: args.properties
  });
}
