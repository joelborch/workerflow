type LogLevel = "info" | "warn" | "error";

type RuntimeLogEvent = {
  level: LogLevel;
  event: string;
  traceId?: string;
  workspaceId?: string;
  routePath?: string;
  scheduleId?: string;
  status?: string;
  details?: Record<string, unknown>;
  timestamp: string;
};

const SENSITIVE_PATTERN = /(token|secret|password|authorization|api[_-]?key)/i;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 128) {
      return `${value.slice(0, 64)}...[redacted ${value.length - 64} chars]`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_PATTERN.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = redactValue(item);
      }
    }
    return output;
  }

  return value;
}

export function buildRuntimeLogEvent(event: Omit<RuntimeLogEvent, "timestamp">): RuntimeLogEvent {
  return {
    ...event,
    details: event.details ? (redactValue(event.details) as Record<string, unknown>) : undefined,
    timestamp: new Date().toISOString()
  };
}

export function runtimeLog(event: Omit<RuntimeLogEvent, "timestamp">) {
  const structured = buildRuntimeLogEvent(event);
  const line = JSON.stringify(structured);

  if (event.level === "error") {
    console.error(line);
    return;
  }
  if (event.level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
