type UnwrapBodyOptions = {
  preserveEnvelopeWhenExtraKeys?: boolean;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export function toScalarMetadata(value: unknown) {
  const metadata = Object.fromEntries(
    Object.entries(asObject(value))
      .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
      .map(([key, item]) => [key, String(item)])
  );
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function unwrapBody(input: unknown, options?: UnwrapBodyOptions) {
  if (input && typeof input === "object" && "body" in input) {
    if (options?.preserveEnvelopeWhenExtraKeys && Object.keys(input as Record<string, unknown>).length !== 1) {
      return input;
    }
    return (input as { body: unknown }).body;
  }
  return input;
}

export function unwrapObjectBody(input: unknown, options?: UnwrapBodyOptions) {
  return asObject(unwrapBody(input, options));
}
