export const TASK_UPDATED_EVENT = "orkestro:task-updated";
export const TASK_DELETED_EVENT = "orkestro:task-deleted";

export interface TaskUpdatedDetail {
  organizationId: number;
  taskId: number;
}

export interface TaskDeletedDetail {
  organizationId: number;
  taskId: number;
}

export function emitTaskUpdated(detail: TaskUpdatedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<TaskUpdatedDetail>(TASK_UPDATED_EVENT, { detail })
  );
}

export function emitTaskDeleted(detail: TaskDeletedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<TaskDeletedDetail>(TASK_DELETED_EVENT, { detail })
  );
}

export function onTaskUpdated(
  handler: (detail: TaskUpdatedDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<TaskUpdatedDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(TASK_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener(TASK_UPDATED_EVENT, listener);
  };
}

export function onTaskDeleted(
  handler: (detail: TaskDeletedDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<TaskDeletedDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(TASK_DELETED_EVENT, listener);
  return () => {
    window.removeEventListener(TASK_DELETED_EVENT, listener);
  };
}
