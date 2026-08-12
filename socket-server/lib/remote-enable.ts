import {
  REMOTE_ENABLE_CHECK_INTERVAL_MS,
  REMOTE_ENABLE_CONFIG_URL,
} from "./consts.ts";

interface RemoteEnableConfig {
  enabled: boolean;
}

export type TabletLockReason = "disabled" | "unavailable";

export interface TabletLockState {
  locked: boolean;
  reason: TabletLockReason | null;
  checkedAtMs: number;
}

let tabletLockState: TabletLockState = {
  locked: true,
  reason: "unavailable",
  checkedAtMs: 0,
};

const isRemoteEnableBypassed = () =>
  Bun.env.NODE_ENV === "development" || Bun.env.NODE_ENV === "test";

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

  const isEnabled = isRemoteEnableBypassed() ? true : data.enabled;

  return isEnabled;
}

async function evaluateTabletLockState(): Promise<TabletLockState> {
  const checkedAtMs = Date.now();

  if (isRemoteEnableBypassed()) {
    return {
      locked: false,
      reason: null,
      checkedAtMs,
    };
  }

  try {
    const enabled = await fetchRemoteEnabled();

    if (!enabled) {
      return {
        locked: true,
        reason: "disabled",
        checkedAtMs,
      };
    }

    return {
      locked: false,
      reason: null,
      checkedAtMs,
    };
  } catch {
    return {
      locked: true,
      reason: "unavailable",
      checkedAtMs,
    };
  }
}

function logTabletLockState(state: TabletLockState): void {
  if (state.locked) {
    console.warn(
      `[remote-enable] tablet lock active (${state.reason}); TV and hardware unaffected`,
    );
    return;
  }

  console.info("[remote-enable] tablet unlocked");
}

export function isTabletLocked(): boolean {
  if (isRemoteEnableBypassed()) {
    return false;
  }

  return tabletLockState.locked;
}

export function getTabletLockState(): TabletLockState {
  return tabletLockState;
}

export async function refreshTabletLockState(): Promise<TabletLockState> {
  tabletLockState = await evaluateTabletLockState();
  logTabletLockState(tabletLockState);
  return tabletLockState;
}

export function startRemoteEnableWatcher(
  onTabletLocked: (state: TabletLockState) => void | Promise<void>,
  intervalMs = REMOTE_ENABLE_CHECK_INTERVAL_MS,
): () => void {
  let stopped = false;

  const check = async () => {
    if (stopped) return;

    const previousLocked = tabletLockState.locked;
    tabletLockState = await evaluateTabletLockState();
    logTabletLockState(tabletLockState);

    if (tabletLockState.locked) {
      await onTabletLocked(tabletLockState);
    } else if (previousLocked) {
      console.info("[remote-enable] tablets may connect again");
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
