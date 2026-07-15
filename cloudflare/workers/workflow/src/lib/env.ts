export type EnvRecord = Record<string, unknown>;
export type EnvContext<T> = { env: T };

export function asEnvRecord(env: unknown): EnvRecord {
  return (env ?? {}) as EnvRecord;
}

export function requireContextEnv<T>(context: EnvContext<T> | undefined, message = "Execution context missing env") {
  if (!context?.env) {
    throw new Error(message);
  }
  return context.env;
}

export function readEnvString(env: unknown, keys: string[]) {
  const record = asEnvRecord(env);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
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
