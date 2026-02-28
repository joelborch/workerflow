import { unwrapBody } from "../../lib/payload";

type NormalizedLead = {
  fullName: string;
  email: string;
  phone: string;
  source: string;
};

type NormalizeResult = {
  ok: true;
  route: "lead_normalizer";
  normalized: NormalizedLead;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function stringValue(record: Record<string, unknown>, key: string) {
  const raw = record[key];
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

export function handle(requestPayload: unknown): NormalizeResult {
  const body = asObject(unwrapBody(requestPayload));

  const firstName = stringValue(body, "firstName");
  const lastName = stringValue(body, "lastName");
  const fullName = stringValue(body, "fullName") || [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

  const email = stringValue(body, "email").toLowerCase() || "unknown@example.com";
  const phone = stringValue(body, "phone").replace(/[^\d+]/g, "");
  const source = stringValue(body, "source") || "unspecified";

  return {
    ok: true,
    route: "lead_normalizer",
    normalized: {
      fullName,
      email,
      phone,
      source
    }
  };
}
