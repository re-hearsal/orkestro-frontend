import { createContext } from "react";
import type { AuthUser, UserProfile } from "./AuthContext";

export interface AuthContextValue {
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
