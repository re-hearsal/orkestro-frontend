import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import client from '../api/client';
import type { components } from '../api/schema';
import { emitJoinRequestsUpdated } from '../utils/joinRequestsEvents';
import { emitNotificationsUpdated } from '../utils/notificationsEvents';
import { emitMemberRoleUpdated } from '../utils/memberRoleEvents';
import { emitFundRealtimeSnapshot } from '../utils/fundEvents';
import { emitSongDeleted } from '../utils/songEvents';
import { emitTaskUpdated, emitTaskDeleted } from '../utils/taskEvents';
import { emitEventCommentCreated } from '../utils/eventCommentEvents';
import { emitEventDeleted } from '../utils/eventDeletedEvents';
import { emitInfoMessageCreated } from '../utils/infoMessageEvents';
import { isBlobUrl, toRenderableImageSource } from '../utils/imageSource';

export interface AuthUser {
  token: string;
  username: string;
}

export interface UserProfile {
  id: number;
  username: string;
  name: string;
  email: string;
  location?: string;
  birthDate?: string;
  preferredLanguage?: string;
  profileImageFileId?: number;
  telegramUserId?: number;
  notificationChannel?: 'TELEGRAM' | 'EMAIL' | 'VK';
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  avatarUrl: string | null;
  initialized: boolean;
  login: (token: string, username: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  subscribeToEventWebSocket: (organizationId: number, eventId: number) => () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8080');

type OrganizationListItem = Pick<components['schemas']['OrganizationDTO'], 'id'>;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const avatarUrlRef = useRef<string | null>(null);
  const stompRef = useRef<Client | null>(null);

  const fetchAvatar = async (token: string, fileId: number) => {
    try {
      const { data } = await client.GET('/api/v1/files/{fileId}', {
        params: { path: { fileId } },
        headers: { Authorization: `Bearer ${token}` },
        parseAs: 'blob',
      });
      if (data) {
        if (avatarUrlRef.current && isBlobUrl(avatarUrlRef.current)) URL.revokeObjectURL(avatarUrlRef.current);
        const renderable = await toRenderableImageSource(data as unknown as Blob);
        avatarUrlRef.current = renderable;
        setAvatarUrl(renderable);
      }
    } catch (e) {
      console.error('[avatar] fetch error:', e);
    }
  };

  const fetchProfile = async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await client.GET('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data) {
        return false;
      }

      const p = data as UserProfile;
      setProfile(p);
      if (p.profileImageFileId) {
        await fetchAvatar(token, p.profileImageFileId);
      }
      return true;
    } catch {
      return false;
    }
  };

  const connectWebSocket = (token: string, userId: number) => {
    if (stompRef.current?.active) return;

    const stomp = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        const destinations = new Set<string>([
          '/user/queue/notifications',
          '/user/queue/join-requests',
          '/topic/notifications',
          '/topic/join-requests',
        ]);

        destinations.add(`/user/${userId}/queue/notifications`);
        destinations.add(`/user/${userId}/queue/join-requests`);

        const handleRealtimeUpdate = (msg: { body: string }) => {
          emitNotificationsUpdated();
          emitJoinRequestsUpdated();
          try {
            const payload = JSON.parse(msg.body) as { type?: string; organizationId?: number; sectionId?: number };
            if (payload.type === 'ROLE_ASSIGNED' || payload.type === 'ROLE_REMOVED') {
              emitMemberRoleUpdated();
            }
            if (payload.type === 'NEW_INFO_MESSAGE') {
              emitInfoMessageCreated({
                organizationId: payload.organizationId,
                sectionId: payload.sectionId,
              });
            }
          } catch {
            // ignore parse errors
          }
        };

        for (const destination of destinations) {
          stomp.subscribe(destination, handleRealtimeUpdate);
        }

        const subscribeFundTopics = async () => {
          try {
            const { data, error } = await client.GET('/api/v1/users/me/organizations', {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (error || !data) {
              return;
            }

            const organizations = (data as OrganizationListItem[]) ?? [];
            for (const org of organizations) {
              if (typeof org.id !== 'number') {
                continue;
              }

              stomp.subscribe(`/topic/organizations/${org.id}/fund`, (msg) => {
                try {
                  const snapshot = JSON.parse(msg.body) as components['schemas']['OrgFundRealtimeSnapshotDTO'];
                  emitFundRealtimeSnapshot(snapshot);
                } catch {
                  // ignore malformed messages
                }
              });

              stomp.subscribe(`/topic/organizations/${org.id}/repertoire`, (msg) => {
                try {
                  const payload = JSON.parse(msg.body) as { type?: string; songId?: number };
                  if (payload.type === 'SONG_DELETED' && typeof payload.songId === 'number') {
                    emitSongDeleted({ organizationId: org.id as number, songId: payload.songId });
                  }
                } catch {
                  // ignore malformed messages
                }
              });

              stomp.subscribe(`/topic/organizations/${org.id}/tasks`, (msg) => {
                try {
                  const payload = JSON.parse(msg.body) as { type?: string; taskId?: number };
                  if (payload.type === 'TASK_UPDATED' && typeof payload.taskId === 'number') {
                    emitTaskUpdated({ organizationId: org.id as number, taskId: payload.taskId });
                  } else if (payload.type === 'TASK_DELETED' && typeof payload.taskId === 'number') {
                    emitTaskDeleted({ organizationId: org.id as number, taskId: payload.taskId });
                  }
                } catch {
                  // ignore malformed messages
                }
              });
            }
          } catch {
            // ignore subscription bootstrap errors
          }
        };

        void subscribeFundTopics();

        stomp.subscribe(`/user/${userId}/queue/profile-updated`, (msg) => {
          try {
            const updated: UserProfile = JSON.parse(msg.body);
            setProfile((prev) => {
              if (prev?.profileImageFileId !== updated.profileImageFileId) {
                if (updated.profileImageFileId) {
                  void fetchAvatar(token, updated.profileImageFileId);
                } else {
                  if (avatarUrlRef.current && isBlobUrl(avatarUrlRef.current)) {
                    URL.revokeObjectURL(avatarUrlRef.current);
                    avatarUrlRef.current = null;
                  }
                  setAvatarUrl(null);
                }
              }
              return updated;
            });
          } catch {
            // ignore malformed messages
          }
        });
      },
    });

    stomp.activate();
    stompRef.current = stomp;
  };

  const disconnectWebSocket = () => {
    stompRef.current?.deactivate();
    stompRef.current = null;
  };

  useEffect(() => {
    const token = localStorage.getItem('orkestro_token');
    const username = localStorage.getItem('orkestro_username');
    if (token && username) {
      setUser({ token, username });

      fetchProfile(token)
        .then((ok) => {
          if (!ok) {
            localStorage.removeItem('orkestro_token');
            localStorage.removeItem('orkestro_username');

            if (avatarUrlRef.current && isBlobUrl(avatarUrlRef.current)) {
              URL.revokeObjectURL(avatarUrlRef.current);
              avatarUrlRef.current = null;
            }

            setUser(null);
            setProfile(null);
            setAvatarUrl(null);
          }
        })
        .finally(() => setInitialized(true));
    } else {
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (user && profile?.id) {
      connectWebSocket(user.token, profile.id);
    }
  }, [user?.token, profile?.id]);

  useEffect(() => {
    return () => { disconnectWebSocket(); };
  }, []);

  const refreshProfile = async () => {
    const token = user?.token;
    if (token) {
      await fetchProfile(token);
    }
  };

  const subscribeToEventWebSocket = (organizationId: number, eventId: number): () => void => {
    const stomp = stompRef.current;
    if (!stomp?.active) {
      return () => {};
    }

    const commentsSub = stomp.subscribe(
      `/topic/organizations/${organizationId}/events/${eventId}/comments`,
      () => {
        emitEventCommentCreated({ organizationId, eventId });
      }
    );

    const eventSub = stomp.subscribe(
      `/topic/organizations/${organizationId}/events/${eventId}`,
      (msg) => {
        try {
          const payload = JSON.parse(msg.body) as { type?: string };
          if (payload.type === 'EVENT_DELETED') {
            emitEventDeleted({ organizationId, eventId });
          }
        } catch {
          // ignore malformed messages
        }
      }
    );

    return () => {
      commentsSub.unsubscribe();
      eventSub.unsubscribe();
    };
  };

  const login = async (token: string, username: string) => {
    localStorage.setItem('orkestro_token', token);
    localStorage.setItem('orkestro_username', username);
    setUser({ token, username });
    await fetchProfile(token);
  };

  const logout = () => {
    disconnectWebSocket();
    if (avatarUrlRef.current && isBlobUrl(avatarUrlRef.current)) {
      URL.revokeObjectURL(avatarUrlRef.current);
      avatarUrlRef.current = null;
    }
    localStorage.removeItem('orkestro_token');
    localStorage.removeItem('orkestro_username');
    setUser(null);
    setProfile(null);
    setAvatarUrl(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, avatarUrl, initialized, login, logout, refreshProfile, subscribeToEventWebSocket }}>
      {children}
    </AuthContext.Provider>
  );
}
