export const NOTIFICATIONS_UPDATED_EVENT = 'orkestro:notifications-updated';

export function emitNotificationsUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}
