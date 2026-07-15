export type RouteRateLimitSetting = {
  rpm: number;
  burst: number;
};

export function parseRouteRateLimits(rawValue: string | undefined) {
  const raw = rawValue?.trim();
  if (!raw) {
    return {} as Record<string, RouteRateLimitSetting>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, RouteRateLimitSetting>;
    }

    const output: Record<string, RouteRateLimitSetting> = {};
    for (const [routePath, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      const candidate = value as Record<string, unknown>;
      const rpm = typeof candidate.rpm === "number" ? Math.floor(candidate.rpm) : 0;
      const burst = typeof candidate.burst === "number" ? Math.floor(candidate.burst) : 0;
      if (rpm > 0) {
        output[routePath] = { rpm, burst: Math.max(0, burst) };
      }
    }
    return output;
  } catch {
    return {} as Record<string, RouteRateLimitSetting>;
  }
}
