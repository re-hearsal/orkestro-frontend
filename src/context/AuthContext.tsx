import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import client from '../api/client';
import { emitJoinRequestsUpdated } from '../utils/joinRequestsEvents';
import { emitNotificationsUpdated } from '../utils/notificationsEvents';
import { emitMemberRoleUpdated } from '../utils/memberRoleEvents';

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
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  avatarUrl: string | null;
  initialized: boolean;
  login: (token: string, username: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8080');

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
        if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
        const objectUrl = URL.createObjectURL(data as unknown as Blob);
        avatarUrlRef.current = objectUrl;
        setAvatarUrl(objectUrl);
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
            const payload = JSON.parse(msg.body) as { type?: string };
            if (payload.type === 'ROLE_ASSIGNED' || payload.type === 'ROLE_REMOVED') {
              emitMemberRoleUpdated();
            }
          } catch {
            // ignore parse errors
          }
        };

        for (const destination of destinations) {
          stomp.subscribe(destination, handleRealtimeUpdate);
        }

        stomp.subscribe(`/user/${userId}/queue/profile-updated`, (msg) => {
          try {
            const updated: UserProfile = JSON.parse(msg.body);
            setProfile(updated);
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

            if (avatarUrlRef.current) {
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

  const login = async (token: string, username: string) => {
    localStorage.setItem('orkestro_token', token);
    localStorage.setItem('orkestro_username', username);
    setUser({ token, username });
    await fetchProfile(token);
  };

  const logout = () => {
    disconnectWebSocket();
    if (avatarUrlRef.current) {
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
    <AuthContext.Provider value={{ user, profile, avatarUrl, initialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
