import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import client from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { components } from '../api/schema';

export type OrganizationDTO = components['schemas']['OrganizationDTO'];

interface OrganizationContextValue {
  organizations: OrganizationDTO[];
  currentOrganization: OrganizationDTO | null;
  setCurrentOrganization: (org: OrganizationDTO | null) => void;
  refreshOrganizations: () => void;
}

export const OrganizationContext = createContext<OrganizationContextValue | null>(null);

const STORAGE_KEY = 'currentOrganizationId';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationDTO[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<OrganizationDTO | null>(null);

  const fetchOrganizations = useCallback(async (token: string) => {
    try {
      const { data } = await client.GET('/api/v1/users/me/organizations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orgs = (data as OrganizationDTO[]) ?? [];
      setOrganizations(orgs);

      const storedId = localStorage.getItem(STORAGE_KEY);
      const storedOrg = storedId
        ? orgs.find((o) => String(o.id) === storedId) ?? orgs[0] ?? null
        : orgs[0] ?? null;
      setCurrentOrganizationState(storedOrg ?? null);
    } catch {
      // keep empty state
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrganizations(user.token);
    } else {
      setOrganizations([]);
      setCurrentOrganizationState(null);
    }
  }, [user, fetchOrganizations]);

  const setCurrentOrganization = useCallback((org: OrganizationDTO | null) => {
    setCurrentOrganizationState(org);

    if (org?.id != null) {
      localStorage.setItem(STORAGE_KEY, String(org.id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshOrganizations = useCallback(() => {
    if (user) {
      fetchOrganizations(user.token);
    }
  }, [user, fetchOrganizations]);

  return (
    <OrganizationContext.Provider
      value={{ organizations, currentOrganization, setCurrentOrganization, refreshOrganizations }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
