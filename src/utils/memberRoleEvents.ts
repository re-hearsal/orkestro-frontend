export const MEMBER_ROLE_UPDATED_EVENT = 'orkestro:member-role-updated';

export function emitMemberRoleUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MEMBER_ROLE_UPDATED_EVENT));
}
