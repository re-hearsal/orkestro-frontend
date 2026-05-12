export const INFO_MESSAGE_CREATED_EVENT = "orkestro:info-message-created";

export interface InfoMessageCreatedDetail {
  organizationId?: number;
  sectionId?: number;
}

export function emitInfoMessageCreated(detail: InfoMessageCreatedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<InfoMessageCreatedDetail>(INFO_MESSAGE_CREATED_EVENT, { detail })
  );
}

export function onInfoMessageCreated(
  handler: (detail: InfoMessageCreatedDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<InfoMessageCreatedDetail>;
    handler(customEvent.detail ?? {});
  };

  window.addEventListener(INFO_MESSAGE_CREATED_EVENT, listener);
  return () => {
    window.removeEventListener(INFO_MESSAGE_CREATED_EVENT, listener);
  };
}
