export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatuses?: number[];
};

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return 0;
  }

  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return 0;
}

function computeBackoffMs(attempt: number, baseDelayMs: number, maxDelayMs: number) {
  const expDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 75);
  return Math.min(maxDelayMs, expDelay + jitter);
}

export async function fetchWithRetry(input: string | URL, init: RequestInit = {}, options: RetryOptions = {}) {
  const maxRetries = Math.max(0, options.maxRetries ?? 2);
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? 200);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 3000);
  const retryOnStatuses = options.retryOnStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const isRetryableStatus = retryOnStatuses.includes(response.status);
      if (!isRetryableStatus || attempt === maxRetries) {
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const delayMs = retryAfterMs > 0 ? Math.min(maxDelayMs, retryAfterMs) : computeBackoffMs(attempt, baseDelayMs, maxDelayMs);
      await sleep(delayMs);
      continue;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }
      const delayMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Connector request failed after retries");
}
