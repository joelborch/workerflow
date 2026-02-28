import type { Env } from "../../../shared/types";

type SecretsStoreBinding = {
  get: () => Promise<string>;
};

function isSecretsStoreBinding(value: unknown): value is SecretsStoreBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as { get?: unknown }).get === "function"
  );
}

export async function resolveWorkflowSecretsStore(env: Env): Promise<Env> {
  const source = env as unknown as Record<string, unknown>;
  const resolved = { ...source };

  await Promise.all(
    Object.entries(source).map(async ([key, candidate]) => {
      if (!isSecretsStoreBinding(candidate)) {
        return;
      }
      const value = await candidate.get();
      resolved[key] = value;
    })
  );

  return resolved as unknown as Env;
}
