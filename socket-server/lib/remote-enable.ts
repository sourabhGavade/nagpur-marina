import {
  REMOTE_ENABLE_CHECK_INTERVAL_MS,
  REMOTE_ENABLE_CONFIG_URL,
} from "./consts.ts";

interface RemoteEnableConfig {
  enabled: boolean;
}

async function fetchRemoteEnabled(): Promise<boolean> {
  const response = await fetch(REMOTE_ENABLE_CONFIG_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Remote enable check failed with status ${response.status}`,
    );
  }

  const data = (await response.json()) as Partial<RemoteEnableConfig>;

  if (typeof data.enabled !== "boolean") {
    throw new Error('Remote enable config must include a boolean "enabled"');
  }

  const isEnabled =
    Bun.env.NODE_ENV && Bun.env.NODE_ENV === "development"
      ? true
      : data.enabled;

  return isEnabled;
}

/**
 * Returns whether the server is allowed to run.
 * Network / parse failures keep the previous known state (fail-open after start).
 */
export async function assertRemoteEnabledOrThrow(): Promise<void> {
  const enabled = await fetchRemoteEnabled();

  if (!enabled) {
    throw new Error("Server locked: remote config has enabled=false");
  }

  console.info("[remote-enable] enabled=true");
}

export function startRemoteEnableWatcher(
  onDisabled: () => void | Promise<void>,
  intervalMs = REMOTE_ENABLE_CHECK_INTERVAL_MS,
): () => void {
  let stopped = false;

  const check = async () => {
    if (stopped) return;

    try {
      const enabled = await fetchRemoteEnabled();

      if (!enabled && !stopped) {
        console.error("[remote-enable] enabled=false; locking server");
        await onDisabled();
      } else {
        console.info("[remote-enable] enabled=true");
      }
    } catch (error) {
      console.warn(
        "[remote-enable] check failed; keeping server running:",
        error instanceof Error ? error.message : error,
      );
    }
  };

  const timer = setInterval(() => {
    void check();
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
