import { useEffect, useState } from "react";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "./useAuth";
import { MEMBER_ROLE_UPDATED_EVENT } from "../utils/memberRoleEvents";

type OrgMemberContextDTO = components["schemas"]["OrgMemberContextDTO"];

interface UseOrgMemberContextResult {
  role: OrgMemberContextDTO["role"];
  permissions: Set<string>;
  loading: boolean;
  initialized: boolean;
  error: unknown;
}

export function useOrgMemberContext(
  organizationId: number
): UseOrgMemberContextResult {
  const { user } = useAuth();
  const [role, setRole] = useState<OrgMemberContextDTO["role"]>(undefined);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(MEMBER_ROLE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(MEMBER_ROLE_UPDATED_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) {
      setRole(undefined);
      setPermissions(new Set());
      setLoading(false);
      setInitialized(true);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadMemberContext = async () => {
      setLoading(true);
      setInitialized(false);
      setError(null);

      try {
        const { data, error: responseError } = await client.GET(
          "/api/v1/organizations/{organizationId}/members/me",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (responseError) {
          throw responseError;
        }

        if (cancelled) {
          return;
        }

        const context = data as unknown as OrgMemberContextDTO;
        setRole(context?.role);
        setPermissions(new Set(context?.permissions ?? []));
      } catch (err) {
        if (!cancelled) {
          setRole(undefined);
          setPermissions(new Set());
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    void loadMemberContext();

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshCounter, user]);

  return { role, permissions, loading, initialized, error };
}
