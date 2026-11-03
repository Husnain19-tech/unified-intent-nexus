/** Safely extracts an HTTP status from nested provider/AI SDK errors. */
export function getHttpStatus(error: unknown): number | undefined {
  const queue: unknown[] = [error];
  const seen = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (typeof current !== "object" || current === null) continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const value = current as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown };
      cause?: unknown;
      errors?: unknown[];
    };

    for (const candidate of [value.statusCode, value.status, value.response?.status]) {
      if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599) {
        return candidate;
      }
    }

    if (value.cause !== undefined) queue.push(value.cause);
    if (Array.isArray(value.errors)) queue.push(...value.errors);
  }

  return undefined;
}
