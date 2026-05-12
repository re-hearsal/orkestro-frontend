export const EVENT_COMMENT_CREATED_EVENT = "orkestro:event-comment-created";

export interface EventCommentCreatedDetail {
  organizationId: number;
  eventId: number;
}

export function emitEventCommentCreated(detail: EventCommentCreatedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<EventCommentCreatedDetail>(EVENT_COMMENT_CREATED_EVENT, { detail })
  );
}

export function onEventCommentCreated(
  handler: (detail: EventCommentCreatedDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<EventCommentCreatedDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(EVENT_COMMENT_CREATED_EVENT, listener);
  return () => {
    window.removeEventListener(EVENT_COMMENT_CREATED_EVENT, listener);
  };
}
