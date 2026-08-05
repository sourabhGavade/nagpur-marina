/** Flattens nested/aggregate failures so fail-safe logs name the real cause. */
export function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    const causes = error.errors.map(describeError).join("; ");
    return causes.length > 0 ? `${error.message}: ${causes}` : error.message;
  }
  if (error instanceof Error) {
    return error.name === "Error"
      ? error.message
      : `${error.name}: ${error.message}`;
  }
  return String(error);
}
