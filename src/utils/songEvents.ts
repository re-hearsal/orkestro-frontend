export const SONG_DELETED_EVENT = "orkestro:song-deleted";

export interface SongDeletedDetail {
  organizationId: number;
  songId: number;
}

export function emitSongDeleted(detail: SongDeletedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<SongDeletedDetail>(SONG_DELETED_EVENT, { detail })
  );
}

export function onSongDeleted(
  handler: (detail: SongDeletedDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SongDeletedDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(SONG_DELETED_EVENT, listener);
  return () => {
    window.removeEventListener(SONG_DELETED_EVENT, listener);
  };
}
