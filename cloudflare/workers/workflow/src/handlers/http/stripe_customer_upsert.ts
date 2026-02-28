import type { Env } from "../../../../../shared/types";
import { upsertStripeCustomer } from "../../connectors/stripe";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type StripeCustomerUpsertResult = {
  ok: true;
  route: "stripe_customer_upsert";
  customerId: string;
  email: string;
  name: string;
  created: boolean;
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

function toMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      out[key] = String(item);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function handle(requestPayload: unknown, traceId: string, context?: HandlerContext): Promise<StripeCustomerUpsertResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const apiKey = envString(env, "STRIPE_API_KEY");
  if (!apiKey) {
    throw new Error("STRIPE_API_KEY is required");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    throw new Error("stripe_customer_upsert requires body.email");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const explicitIdempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

  const customer = await upsertStripeCustomer({
    apiKey,
    email,
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    metadata: toMetadata(body.metadata),
    idempotencyKey: explicitIdempotencyKey || `workerflow-${traceId}-stripe-customer`
  });

  return {
    ok: true,
    route: "stripe_customer_upsert",
    customerId: customer.id,
    email: customer.email || email,
    name: customer.name || name,
    created: customer.created
  };
}
