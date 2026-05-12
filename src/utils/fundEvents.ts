import type { components } from "../api/schema";

export const FUND_REALTIME_SNAPSHOT_EVENT = "orkestro:fund-realtime-snapshot";

export interface FundRealtimeSnapshotDetail {
  snapshot: components["schemas"]["OrgFundRealtimeSnapshotDTO"];
}

export function emitFundRealtimeSnapshot(snapshot: components["schemas"]["OrgFundRealtimeSnapshotDTO"]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<FundRealtimeSnapshotDetail>(FUND_REALTIME_SNAPSHOT_EVENT, {
      detail: { snapshot },
    })
  );
}

export function onFundRealtimeSnapshot(
  handler: (snapshot: components["schemas"]["OrgFundRealtimeSnapshotDTO"]) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<FundRealtimeSnapshotDetail>;
    if (customEvent.detail?.snapshot) {
      handler(customEvent.detail.snapshot);
    }
  };

  window.addEventListener(FUND_REALTIME_SNAPSHOT_EVENT, listener);
  return () => {
    window.removeEventListener(FUND_REALTIME_SNAPSHOT_EVENT, listener);
  };
}
