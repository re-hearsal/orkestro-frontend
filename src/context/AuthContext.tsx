import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import client from '../api/client';

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
  login: (token: string, username: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const stompRef = useRef<Client | null>(null);

  const fetchProfile = async (token: string) => {
    try {
      const { data } = await client.GET('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data) setProfile(data as UserProfile);
    } catch {
      // profile stays null, app continues working
    }
  };

  const connectWebSocket = (token: string, userId: number) => {
    if (stompRef.current?.active) return;

    const stomp = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
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

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('orkestro_token');
    const username = localStorage.getItem('orkestro_username');
    if (token && username) {
      setUser({ token, username });
      fetchProfile(token);
    }
  }, []);

  // Connect WebSocket once profile id is known
  useEffect(() => {
    if (user && profile?.id) {
      connectWebSocket(user.token, profile.id);
    }
  }, [user?.token, profile?.id]);

  // Disconnect on unmount
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
    localStorage.removeItem('orkestro_token');
    localStorage.removeItem('orkestro_username');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
