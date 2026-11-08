/** Fail visibly when a required database read fails instead of treating it as an empty result. */
export function assertQuerySuccess(...queries: { label: string; error: { message: string } | null }[]): void {
  const failure = queries.find((query) => query.error);
  if (failure?.error) throw new Error(`${failure.label}: ${failure.error.message}`);
}
