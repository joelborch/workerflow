export type EnvRecord = Record<string, unknown>;

export function asEnvRecord(env: unknown): EnvRecord {
  return (env ?? {}) as EnvRecord;
}

export function readEnvValue(env: EnvRecord, keys: string[]) {
  for (const key of keys) {
    const value = env[key];
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value).trim();
    if (text.length > 0) {
      return text;
    }
  }
  return "";
}

export function requireEnvValue(env: EnvRecord, keys: string[], label: string) {
  const value = readEnvValue(env, keys);
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
}

