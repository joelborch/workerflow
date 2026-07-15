import { readString, unwrapObjectBody } from "../../lib/payload";

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

export function handle(requestPayload: unknown): NormalizeResult {
  const body = unwrapObjectBody(requestPayload);

  const firstName = readString(body, "firstName");
  const lastName = readString(body, "lastName");
  const fullName = readString(body, "fullName") || [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

  const email = readString(body, "email").toLowerCase() || "unknown@example.com";
  const phone = readString(body, "phone").replace(/[^\d+]/g, "");
  const source = readString(body, "source") || "unspecified";

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
