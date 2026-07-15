export type SecretsStoreBinding = {
  get: () => Promise<string>;
};

export function isSecretsStoreBinding(value: unknown): value is SecretsStoreBinding {
  return typeof value === "object" && value !== null && "get" in value && typeof value.get === "function";
}

export function timingSafeStringEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
