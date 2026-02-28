type UnwrapBodyOptions = {
  preserveEnvelopeWhenExtraKeys?: boolean;
};

export function unwrapBody(input: unknown, options?: UnwrapBodyOptions) {
  if (input && typeof input === "object" && "body" in input) {
    if (options?.preserveEnvelopeWhenExtraKeys && Object.keys(input as Record<string, unknown>).length !== 1) {
      return input;
    }
    return (input as { body: unknown }).body;
  }
  return input;
}

