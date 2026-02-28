type GoogleAccessTokenOptions = {
  scopes: string[];
  fallbackTokenKeys?: string[];
  subjectKeys?: string[];
  requireSubject?: boolean;
};

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const TOKEN_SAFETY_WINDOW_MS = 60_000;

const tokenCache = new Map<string, CachedToken>();

export const GOOGLE_SCOPE_GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_SCOPE_SHEETS = "https://www.googleapis.com/auth/spreadsheets";
export const GOOGLE_SCOPE_DRIVE = "https://www.googleapis.com/auth/drive";
export const GOOGLE_SCOPE_DOCS = "https://www.googleapis.com/auth/documents";

function readEnvString(env: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = env[key];
    if (raw === undefined || raw === null) {
      continue;
    }

    const value = String(raw).trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function readPrivateKey(env: Record<string, unknown>) {
  const single = readEnvString(env, ["GCP_PRIVATE_KEY"]);
  if (single) {
    return single;
  }

  const part1 = readEnvString(env, ["GCP_PRIVATE_KEY_PART1"]);
  const part2 = readEnvString(env, ["GCP_PRIVATE_KEY_PART2"]);
  if (part1 && part2) {
    return `${part1}${part2}`;
  }

  return "";
}

function encodeBase64Url(input: Uint8Array) {
  let binary = "";
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeStringBase64Url(value: string) {
  return encodeBase64Url(new TextEncoder().encode(value));
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  const maybePem = trimmed.replace(/\\n/g, "\n");

  if (maybePem.includes("-----BEGIN PRIVATE KEY-----")) {
    return maybePem;
  }

  try {
    const decoded = atob(trimmed);
    const decodedNormalized = decoded.replace(/\\n/g, "\n").trim();
    if (decodedNormalized.includes("-----BEGIN PRIVATE KEY-----")) {
      return decodedNormalized;
    }
  } catch {
    // Not base64; fall through to return the raw normalized value.
  }

  return maybePem;
}

function parsePrivateKeyPem(value: string) {
  const normalized = normalizePrivateKey(value);
  const stripped = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  if (!stripped) {
    throw new Error("GCP_PRIVATE_KEY is empty after PEM normalization");
  }

  const decoded = atob(stripped);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

async function signJwt(unsignedJwt: string, privateKeyPem: string) {
  const privateKeyDer = parsePrivateKeyPem(privateKeyPem);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedJwt));
  const encodedSignature = encodeBase64Url(new Uint8Array(signature));

  return `${unsignedJwt}.${encodedSignature}`;
}

async function exchangeJwtForAccessToken(assertion: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    const details = data.error_description || data.error || JSON.stringify(data);
    throw new Error(`Google token exchange failed: ${response.status} ${response.statusText} ${details}`);
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;

  return {
    token: data.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000
  };
}

function buildCacheKey(serviceAccountEmail: string, subject: string, scopes: string[]) {
  return `${serviceAccountEmail}::${subject}::${scopes.slice().sort().join(" ")}`;
}

export async function getGoogleAccessToken(env: Record<string, unknown>, options: GoogleAccessTokenOptions) {
  const fallbackToken = readEnvString(env, options.fallbackTokenKeys ?? []);

  const serviceAccountEmail = readEnvString(env, ["GCP_SERVICE_ACCOUNT_EMAIL"]);
  const privateKey = readPrivateKey(env);
  const subject = readEnvString(env, options.subjectKeys ?? ["GOOGLE_ADMIN_USER"]);

  if (!serviceAccountEmail || !privateKey) {
    if (fallbackToken) {
      return fallbackToken;
    }
    throw new Error(
      "Missing Google service-account credentials: GCP_SERVICE_ACCOUNT_EMAIL and/or GCP_PRIVATE_KEY (or *_PART1/*_PART2)"
    );
  }

  if (options.requireSubject && !subject) {
    throw new Error("Missing required GOOGLE_ADMIN_USER for delegated Google auth");
  }

  const cacheKey = buildCacheKey(serviceAccountEmail, subject, options.scopes);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs - TOKEN_SAFETY_WINDOW_MS > Date.now()) {
    return cached.token;
  }

  const now = Math.floor(Date.now() / 1000);

  const header = encodeStringBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT"
    })
  );

  const payload = encodeStringBase64Url(
    JSON.stringify({
      iss: serviceAccountEmail,
      sub: subject || undefined,
      scope: options.scopes.join(" "),
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600
    })
  );

  const signedJwt = await signJwt(`${header}.${payload}`, privateKey);
  const token = await exchangeJwtForAccessToken(signedJwt);

  tokenCache.set(cacheKey, token);
  return token.token;
}
