export const JOIN_REQUESTS_UPDATED_EVENT = "orkestro:join-requests-updated";

export interface JoinRequestsUpdatedDetail {
  organizationId?: number;
  pendingCount?: number;
}

export function emitJoinRequestsUpdated(detail: JoinRequestsUpdatedDetail = {}): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<JoinRequestsUpdatedDetail>(JOIN_REQUESTS_UPDATED_EVENT, {
      detail,
    })
  );
}
