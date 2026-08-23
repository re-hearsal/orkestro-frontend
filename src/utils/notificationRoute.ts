export function resolveNotificationRoute(
  type: string | undefined,
  entityType: string | undefined,
  entityId: number | undefined,
  organizationId: number | undefined,
  sectionId: number | undefined
): string | null {
  if (entityType == null || entityId == null || organizationId == null) {return null;}

  switch (entityType) {
    case 'EVENT':
      return `/organizations/${organizationId}/events/${entityId}`;
    case 'TASK':
      if (type === 'TASK_DELETED') {
        return `/organizations/${organizationId}/tasks`;
      }
      return `/organizations/${organizationId}/tasks/${entityId}`;
    case 'SECTION':
      return `/organizations/${organizationId}/sections/${entityId}`;
    case 'ORGANIZATION':
      if (type === 'JOIN_REQUEST_RECEIVED') {
        return `/organizations/${organizationId}/join-requests`;
      }
      return `/organizations/${organizationId}`;
    case 'ORG_INFO_MESSAGE':
      if (sectionId != null) {
        return `/organizations/${organizationId}/sections/${sectionId}`;
      }
      return `/organizations/${organizationId}`;
    default:
      return null;
  }
}
