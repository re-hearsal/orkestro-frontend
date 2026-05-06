export const EVENT_DELETED_EVENT = "orkestro:event-deleted";

export interface EventDeletedDetail {
  organizationId: number;
  eventId: number;
}

export function emitEventDeleted(detail: EventDeletedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<EventDeletedDetail>(EVENT_DELETED_EVENT, { detail })
  );
}

export function onEventDeleted(
  handler: (detail: EventDeletedDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<EventDeletedDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(EVENT_DELETED_EVENT, listener);
  return () => {
    window.removeEventListener(EVENT_DELETED_EVENT, listener);
  };
}
