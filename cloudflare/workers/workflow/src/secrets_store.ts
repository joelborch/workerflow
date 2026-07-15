import { isSecretsStoreBinding } from "../../../shared/security";
import type { Env } from "../../../shared/types";

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
