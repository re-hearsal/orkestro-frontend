import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { withFlatPagination } from "../../utils/pagination";
import { getLocalizedRoleName } from "../../utils/roleNameI18n";
import { getInstrumentLabel as getInstrumentLabelUtil, sortByLocalizedLabel } from "../../utils/instrumentI18n";
import { MEMBER_ROLE_UPDATED_EVENT } from "../../utils/memberRoleEvents";
import { ORG_ROLES_UPDATED_EVENT } from "../../utils/orgRolesEvents";
import OrgMemberCard, { type OrgMemberCardData } from "./OrgMemberCard";
import OrgInviteLink from "./OrgInviteLink";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

interface OrgMembersListProps {
  organizationId: number;
  permissions: Set<string>;
}

interface InstrumentOption {
  id: number;
  name: string;
}

interface PagedModelLike {
  content?: unknown[];
  page?: {
    totalElements?: number;
  };
}

const PAGE_SIZE = 6;

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if ("details" in error && Array.isArray(error.details)) {
    const details = error.details.filter((item): item is string => typeof item === "string");
    if (details.length > 0) {
      return details.join("\n");
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractInstruments(member: Record<string, unknown>): string[] {
  const buckets = [member.musicalRoles, member.instruments, member.instrumentation];
  const names: string[] = [];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }

    for (const item of bucket) {
      if (typeof item === "string") {
        names.push(item);
        continue;
      }

      const itemRecord = asRecord(item);
      if (!itemRecord) {
        continue;
      }

      if (typeof itemRecord.instrumentName === "string") {
        names.push(itemRecord.instrumentName);
      } else if (typeof itemRecord.name === "string") {
        names.push(itemRecord.name);
      }
    }
  }

  if (typeof member.instrumentName === "string") {
    names.push(member.instrumentName);
  }

  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

function normalizeRole(rawRole: unknown): { id: number; name: string } | undefined {
  const role = asRecord(rawRole);
  if (!role) {
    return undefined;
  }

  const id =
    typeof role.id === "number"
      ? role.id
      : typeof role.roleId === "number"
        ? role.roleId
        : undefined;

  const name =
    typeof role.name === "string"
      ? role.name
      : typeof role.roleName === "string"
        ? role.roleName
        : undefined;

  if (id == null || !name) {
    return undefined;
  }

  return { id, name };
}

function normalizeMember(rawMember: unknown): OrgMemberCardData {
  const member = asRecord(rawMember) ?? {};
  const user = asRecord(member.user);

  const id =
    typeof member.id === "number"
      ? member.id
      : typeof member.userId === "number"
        ? member.userId
        : typeof user?.id === "number"
          ? user.id
          : undefined;

  const name =
    typeof member.name === "string"
      ? member.name
      : typeof member.fullName === "string"
        ? member.fullName
        : typeof user?.name === "string"
          ? user.name
          : typeof user?.username === "string"
            ? user.username
            : undefined;

  const birthDate =
    typeof member.birthDate === "string"
      ? member.birthDate
      : typeof member.dateOfBirth === "string"
        ? member.dateOfBirth
        : typeof user?.birthDate === "string"
          ? user.birthDate
          : undefined;

  const profileImageFileId =
    typeof member.profileImageFileId === "number"
      ? member.profileImageFileId
      : typeof user?.profileImageFileId === "number"
        ? user.profileImageFileId
        : undefined;

  const singleRoleCandidates = [
    member.role,
    member.technicalRole,
    member.organizationRole,
    member.memberRole,
  ];
  const arrayRoleBuckets = [member.roles, member.technicalRoles, member.organizationRoles];

  const roleFromSingles = singleRoleCandidates
    .map(normalizeRole)
    .find((candidate): candidate is { id: number; name: string } => candidate !== undefined);

  const roleFromArrays = arrayRoleBuckets
    .find((bucket) => Array.isArray(bucket))
    ?.find((item) => normalizeRole(item) != null);

  const role = roleFromSingles ?? normalizeRole(roleFromArrays);

  return {
    id,
    name,
    birthDate,
    profileImageFileId,
    instruments: extractInstruments(member),
    role,
  };
}

function normalizeInstrumentOptions(raw: unknown): InstrumentOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index) => {
      if (typeof item === "string") {
        return { id: index + 1, name: item };
      }

      const instrument = asRecord(item);
      if (!instrument) {
        return null;
      }

      const id =
        typeof instrument.id === "number"
          ? instrument.id
          : typeof instrument.instrumentId === "number"
            ? instrument.instrumentId
            : null;

      const name =
        typeof instrument.name === "string"
          ? instrument.name
          : typeof instrument.instrumentName === "string"
            ? instrument.instrumentName
            : null;

      if (id == null || !name) {
        return null;
      }

      return { id, name };
    })
    .filter((option): option is InstrumentOption => option !== null);
}

export default function OrgMembersList({ organizationId, permissions }: OrgMembersListProps) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();

  const [query, setQuery] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [instrumentIds, setInstrumentIds] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [members, setMembers] = useState<OrgMemberCardData[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);

  const [roles, setRoles] = useState<TechnicalRoleDTO[]>([]);
  const [instruments, setInstruments] = useState<InstrumentOption[]>([]);
  const [rolesRefreshCounter, setRolesRefreshCounter] = useState(0);

  const refreshCounterRef = useRef(refreshCounter);
  refreshCounterRef.current = refreshCounter;

  useEffect(() => {
    const handler = () => {
      setPage(0);
      setRefreshCounter((c) => c + 1);
    };
    window.addEventListener(MEMBER_ROLE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(MEMBER_ROLE_UPDATED_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => setRolesRefreshCounter((c) => c + 1);
    window.addEventListener(ORG_ROLES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(ORG_ROLES_UPDATED_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) {
      setRoles([]);
      setInstruments([]);
      return;
    }

    let cancelled = false;

    const loadFilterOptions = async () => {
      try {
        const [{ data: rolesData }, { data: instrumentsData }] = await Promise.all([
          client.GET("/api/v1/organizations/{organizationId}/roles", {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          client.GET("/api/v1/instruments", {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);

        if (cancelled) {
          return;
        }

        setRoles((rolesData as unknown as TechnicalRoleDTO[]) ?? []);
        setInstruments(normalizeInstrumentOptions(instrumentsData));
      } catch {
        if (!cancelled) {
          setRoles([]);
          setInstruments([]);
        }
      }
    };

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [organizationId, user, rolesRefreshCounter]);

  useEffect(() => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) {
      setMembers([]);
      setTotalElements(0);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      setLoading(true);

      try {
        const queryParams = (withFlatPagination(
          {
            ...(query.trim() ? { query: query.trim() } : {}),
            ...(roleIds.length > 0 ? { roleIds } : {}),
            ...(instrumentIds.length > 0 ? { instrumentIds } : {}),
          },
          { page, size: PAGE_SIZE }
        ) as unknown as {
          query?: string;
          roleIds?: number[];
          instrumentIds?: number[];
          pageable: components["schemas"]["Pageable"];
        });

        const { data, error: responseError } = await client.GET(
          "/api/v1/organizations/{organizationId}/members/page",
          {
            params: {
              path: { organizationId },
              query: queryParams,
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (responseError) {
          throw responseError;
        }

        if (cancelled) {
          return;
        }

        const paged = (data as unknown as PagedModelLike) ?? {};
        const nextMembers = (paged.content ?? []).map(normalizeMember);
        const total = typeof paged.page?.totalElements === "number" ? paged.page.totalElements : 0;

        setMembers((prev) => (page === 0 ? nextMembers : [...prev, ...nextMembers]));
        setTotalElements(total);
      } catch (err) {
        if (!cancelled) {
          showAlert(getErrorMessage(err) ?? String(t("organizations.members.loadError")), "warning");
          if (page === 0) {
            setMembers([]);
            setTotalElements(0);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [instrumentIds, organizationId, page, query, refreshCounter, roleIds, showAlert, t, user]);

  const hasMore = useMemo(
    () => totalElements > (page + 1) * PAGE_SIZE,
    [page, totalElements]
  );
  const canEditInvite = permissions.has("ORG_EDIT");
  const canAssignRole = permissions.has("ORG_ASSIGN_TECH_ROLE");
  const canRemoveMember = permissions.has("ORG_MEMBER_REMOVE");

  const reloadMembers = () => {
    setPage(0);
    setRefreshCounter((c) => c + 1);
  };

  const toggleRole = (id: number) => {
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
    setPage(0);
  };

  const toggleInstrument = (id: number) => {
    setInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    setPage(0);
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Search */}
      <TextField
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(0);
        }}
        placeholder={t("organizations.members.searchPlaceholder")}
        size="small"
        fullWidth
        sx={{ mb: 1.5 }}
      />

      {/* Filters block */}
      <Box
        sx={{
          border: "1px solid #dce6f9",
          borderRadius: "10px",
          p: 1.5,
          mb: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        {/* Role filter */}
        {roles.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#7795de",
                whiteSpace: "nowrap",
                minWidth: 56,
              }}
            >
              {t("organizations.members.filterByRole")}:
            </Typography>
            {roles.map((role) => (
              <Chip
                key={role.id}
                label={getLocalizedRoleName(role.name, t)}
                size="small"
                color={role.id != null && roleIds.includes(role.id) ? "primary" : "default"}
                onClick={() => role.id != null && toggleRole(role.id)}
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Box>
        )}

        {/* Instrument filter */}
        {instruments.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#7795de",
                whiteSpace: "nowrap",
                minWidth: 56,
                pt: "4px",
              }}
            >
              {t("organizations.members.filterByInstrument")}:
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.75,
                maxHeight: 96,
                overflowY: "auto",
                flex: 1,
              }}
            >
              {sortByLocalizedLabel(instruments, (i) => getInstrumentLabelUtil(i.name, t), i18n.language).map((instrument) => (
                <Chip
                  key={instrument.id}
                  label={getInstrumentLabelUtil(instrument.name, t)}
                  size="small"
                  color={instrumentIds.includes(instrument.id) ? "primary" : "default"}
                  onClick={() => toggleInstrument(instrument.id)}
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {loading && members.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : (
        <>
          {members.length === 0 && !canEditInvite ? (
            <Typography
              sx={{
                mt: 2,
                fontFamily: "Century Gothic, sans-serif",
                color: "#7795de",
              }}
            >
              {String(t("organizations.members.empty"))}
            </Typography>
          ) : (
            <Box
              sx={{
                mt: 2,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 1.25,
              }}
            >
              {members.map((member, index) => (
                <OrgMemberCard
                  key={`${member.id ?? member.name ?? "member"}-${index}`}
                  member={member}
                  organizationId={organizationId}
                  canAssignRole={canAssignRole}
                  availableRoles={roles}
                  canRemoveMember={canRemoveMember}
                  currentUserId={profile?.id}
                  onMemberRemoved={reloadMembers}
                />
              ))}

              {canEditInvite && (
                <Box>
                  <OrgInviteLink organizationId={organizationId} permissions={permissions} />
                </Box>
              )}
            </Box>
          )}

          {hasMore && (
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
              <Button
                type="button"
                variant="outlined"
                disabled={loading}
                onClick={() => setPage((prev) => prev + 1)}
                sx={{
                  borderRadius: "8px",
                  borderColor: "#0f3eb5",
                  color: "#0f3eb5",
                  fontFamily: "Century Gothic, sans-serif",
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#0f3eb5",
                    backgroundColor: "rgba(15,62,181,0.08)",
                  },
                }}
              >
                {t("organizations.members.loadMore")}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
