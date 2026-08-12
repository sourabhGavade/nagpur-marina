export function isTabletLockedConnectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as Error & {
    data?: unknown;
    description?: unknown;
  };

  const payloads = [err.data, err.description].filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null,
  );

  for (const payload of payloads) {
    if (payload.error_code === "tablet_locked") {
      return true;
    }
  }

  const message = err.message.toLowerCase();
  return message.includes("tablet_locked") || message.includes("locked");
}
