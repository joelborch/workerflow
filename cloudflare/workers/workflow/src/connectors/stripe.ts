import { fetchWithRetry } from "./http_retry";

type StripePaymentIntentCreateArgs = {
  apiKey: string;
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
};

type StripeCustomerUpsertArgs = {
  apiKey: string;
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
};

type StripePaymentIntentResponse = {
  id?: unknown;
  status?: unknown;
  client_secret?: unknown;
  amount?: unknown;
  currency?: unknown;
};

type StripeCustomerResponse = {
  id?: unknown;
  email?: unknown;
  name?: unknown;
};

type StripeCustomerListResponse = {
  data?: Array<StripeCustomerResponse>;
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function normalizeApiKey(apiKey: string) {
  return apiKey.trim();
}

function toFormData(record: Record<string, string | undefined>) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value.length === 0) {
      continue;
    }
    form.append(key, value);
  }
  return form;
}

function appendMetadata(form: URLSearchParams, metadata: Record<string, string> | undefined) {
  if (!metadata) {
    return;
  }

  for (const [key, value] of Object.entries(metadata)) {
    const cleanKey = key.trim();
    const cleanValue = value.trim();
    if (!cleanKey || !cleanValue) {
      continue;
    }
    form.append(`metadata[${cleanKey}]`, cleanValue);
  }
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function stripeRequest<T>(args: {
  apiKey: string;
  method: "GET" | "POST";
  path: string;
  body?: URLSearchParams;
  idempotencyKey?: string;
}) {
  const response = await fetchWithRetry(`${STRIPE_API_BASE}${args.path}`, {
    method: args.method,
    headers: {
      authorization: `Bearer ${normalizeApiKey(args.apiKey)}`,
      ...(args.method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      ...(args.idempotencyKey ? { "idempotency-key": args.idempotencyKey } : {})
    },
    ...(args.body ? { body: args.body.toString() } : {})
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe request failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  return (await response.json()) as T;
}

function normalizeCurrency(value: string) {
  return value.trim().toLowerCase() || "usd";
}

export async function createStripePaymentIntent(args: StripePaymentIntentCreateArgs) {
  const form = toFormData({
    amount: String(Math.max(1, Math.round(args.amount))),
    currency: normalizeCurrency(args.currency),
    customer: args.customerId?.trim(),
    description: args.description?.trim()
  });
  appendMetadata(form, args.metadata);

  const data = await stripeRequest<StripePaymentIntentResponse>({
    apiKey: args.apiKey,
    method: "POST",
    path: "/payment_intents",
    body: form,
    idempotencyKey: args.idempotencyKey
  });

  return {
    id: asText(data.id),
    status: asText(data.status),
    clientSecret: asText(data.client_secret),
    amount: typeof data.amount === "number" ? data.amount : 0,
    currency: asText(data.currency)
  };
}

async function findStripeCustomerByEmail(apiKey: string, email: string) {
  const query = new URLSearchParams({
    email,
    limit: "1"
  });

  const data = await stripeRequest<StripeCustomerListResponse>({
    apiKey,
    method: "GET",
    path: `/customers?${query.toString()}`
  });

  const first = data.data?.[0];
  const id = asText(first?.id);
  return id || null;
}

export async function upsertStripeCustomer(args: StripeCustomerUpsertArgs) {
  const email = args.email.trim().toLowerCase();
  const existingId = await findStripeCustomerByEmail(args.apiKey, email);

  const form = toFormData({
    email,
    name: args.name?.trim(),
    phone: args.phone?.trim()
  });
  appendMetadata(form, args.metadata);

  if (existingId) {
    const updated = await stripeRequest<StripeCustomerResponse>({
      apiKey: args.apiKey,
      method: "POST",
      path: `/customers/${encodeURIComponent(existingId)}`,
      body: form
    });

    return {
      id: asText(updated.id),
      email: asText(updated.email),
      name: asText(updated.name),
      created: false as const
    };
  }

  const created = await stripeRequest<StripeCustomerResponse>({
    apiKey: args.apiKey,
    method: "POST",
    path: "/customers",
    body: form,
    idempotencyKey: args.idempotencyKey
  });

  return {
    id: asText(created.id),
    email: asText(created.email),
    name: asText(created.name),
    created: true as const
  };
}
