export const ORG_ROLES_UPDATED_EVENT = 'orkestro:org-roles-updated';

export function emitOrgRolesUpdated(): void {
  if (typeof window === 'undefined') {return;}
  window.dispatchEvent(new Event(ORG_ROLES_UPDATED_EVENT));
}
