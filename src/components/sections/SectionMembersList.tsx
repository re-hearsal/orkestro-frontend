import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { withFlatPagination } from "../../utils/pagination";
import { getLocalizedRoleName } from "../../utils/roleNameI18n";
import { getInstrumentLabel } from "../../utils/instrumentI18n";
import SectionMemberCard, { type SectionMemberCardData } from "./SectionMemberCard";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

interface SectionMembersListProps {
  sectionId: number;
  organizationId: number;
  sectionPermissions: Set<string>;
  currentUserId?: number;
  parentSectionId?: number;
}

interface PagedModelLike {
  content?: unknown[];
  page?: { totalElements?: number };
}

interface InstrumentOption {
  id: number;
  name: string;
}

const PAGE_SIZE = 6;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractInstruments(member: Record<string, unknown>): string[] {
  const buckets = [member.musicalRoles, member.instruments, member.instrumentation];
  const names: string[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (typeof item === "string") { names.push(item); continue; }
      const itemRec = asRecord(item);
      if (!itemRec) continue;
      if (typeof itemRec.instrumentName === "string") names.push(itemRec.instrumentName);
      else if (typeof itemRec.name === "string") names.push(itemRec.name);
    }
  }
  if (typeof member.instrumentName === "string") names.push(member.instrumentName);
  return Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
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

function normalizeMember(rawMember: unknown): SectionMemberCardData {
  const member = asRecord(rawMember) ?? {};
  const user = asRecord(member.user);

  const id =
    typeof member.id === "number" ? member.id :
    typeof member.userId === "number" ? member.userId :
    typeof user?.id === "number" ? user.id : undefined;

  const name =
    typeof member.name === "string" ? member.name :
    typeof member.fullName === "string" ? member.fullName :
    typeof user?.name === "string" ? user.name :
    typeof user?.username === "string" ? user.username : undefined;

  const profileImageFileId =
    typeof member.profileImageFileId === "number" ? member.profileImageFileId :
    typeof user?.profileImageFileId === "number" ? user.profileImageFileId : undefined;

  const singleRoleCandidates = [
    member.role,
    member.technicalRole,
    member.sectionRole,
    member.sectionTechnicalRole,
    member.memberRole,
  ];
  const arrayRoleBuckets = [member.roles, member.technicalRoles, member.sectionRoles];

  const roleFromSingles = singleRoleCandidates
    .map(normalizeRole)
    .find((candidate): candidate is { id: number; name: string } => candidate !== undefined);

  const roleFromArrays = arrayRoleBuckets
    .find((bucket) => Array.isArray(bucket))
    ?.find((item) => normalizeRole(item) != null);

  const role = roleFromSingles ?? normalizeRole(roleFromArrays);

  return { id, name, profileImageFileId, instruments: extractInstruments(member), role };
}

function normalizeOrgMember(rawMember: unknown): { id?: number; name?: string } {
  const member = asRecord(rawMember) ?? {};
  const user = asRecord(member.user);
  const id =
    typeof member.id === "number" ? member.id :
    typeof member.userId === "number" ? member.userId :
    typeof user?.id === "number" ? user.id : undefined;
  const name =
    typeof member.name === "string" ? member.name :
    typeof member.fullName === "string" ? member.fullName :
    typeof user?.name === "string" ? user.name :
    typeof user?.username === "string" ? user.username : undefined;
  return { id, name };
}

function normalizeInstrumentOptions(raw: unknown): InstrumentOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") return { id: index + 1, name: item };
    const rec = asRecord(item);
    if (!rec) return null;
    const id = typeof rec.id === "number" ? rec.id : typeof rec.instrumentId === "number" ? rec.instrumentId : null;
    const name = typeof rec.name === "string" ? rec.name : typeof rec.instrumentName === "string" ? rec.instrumentName : null;
    if (id == null || !name) return null;
    return { id, name };
  }).filter((o): o is InstrumentOption => o !== null);
}

export default function SectionMembersList({
  sectionId,
  organizationId,
  sectionPermissions,
  currentUserId,
  parentSectionId,
}: SectionMembersListProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [query, setQuery] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [instrumentIds, setInstrumentIds] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [members, setMembers] = useState<SectionMemberCardData[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);

  const [roles, setRoles] = useState<TechnicalRoleDTO[]>([]);
  const [instruments, setInstruments] = useState<InstrumentOption[]>([]);

  // Add member dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [orgMemberQuery, setOrgMemberQuery] = useState("");
  const [orgMembers, setOrgMembers] = useState<{ id?: number; name?: string }[]>([]);
  const [orgMembersLoading, setOrgMembersLoading] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<number | null>(null);

  const orgQueryRef = useRef(orgMemberQuery);
  orgQueryRef.current = orgMemberQuery;

  // Load roles and instruments for filters
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [{ data: rolesData }, { data: instrumentsData }] = await Promise.all([
          client.GET("/api/v1/sections/{sectionId}/roles", {
            params: { path: { sectionId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          client.GET("/api/v1/instruments", {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);
        if (!cancelled) {
          setRoles((rolesData as unknown as TechnicalRoleDTO[]) ?? []);
          setInstruments(normalizeInstrumentOptions(instrumentsData));
        }
      } catch {
        if (!cancelled) { setRoles([]); setInstruments([]); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sectionId, user]);

  // Load members
  useEffect(() => {
    if (!user) { setMembers([]); setTotalElements(0); setLoading(false); return; }
    let cancelled = false;
    const loadMembers = async () => {
      setLoading(true);
      try {
        const queryParams = withFlatPagination(
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
        };

        const { data, error: responseError } = await client.GET(
          "/api/v1/sections/{sectionId}/members/page",
          {
            params: { path: { sectionId }, query: queryParams },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (responseError) throw responseError;
        if (cancelled) return;

        const paged = (data as unknown as PagedModelLike) ?? {};
        const nextMembers = (paged.content ?? []).map(normalizeMember);
        const total = typeof paged.page?.totalElements === "number" ? paged.page.totalElements : 0;
        setMembers((prev) => page === 0 ? nextMembers : [...prev, ...nextMembers]);
        setTotalElements(total);
      } catch (err) {
        if (!cancelled) {
          const msg = err && typeof err === "object" && "message" in err
            ? String((err as Record<string, unknown>).message)
            : String(t("organizations.members.loadError"));
          showAlert(msg, "warning");
          if (page === 0) { setMembers([]); setTotalElements(0); }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadMembers();
    return () => { cancelled = true; };
  }, [sectionId, page, query, roleIds, instrumentIds, refreshCounter, user, showAlert, t]);

  // Load org members for add dialog
  useEffect(() => {
    if (!addDialogOpen || !user) return;
    let cancelled = false;
    const load = async () => {
      setOrgMembersLoading(true);
      try {
        const queryParams = withFlatPagination(
          { ...(orgMemberQuery.trim() ? { query: orgMemberQuery.trim() } : {}) },
          { page: 0, size: 20 }
        ) as unknown as { query?: string; pageable: components["schemas"]["Pageable"] };

        const { data } = parentSectionId != null
          ? await client.GET("/api/v1/sections/{sectionId}/members/page", {
              params: { path: { sectionId: parentSectionId }, query: queryParams },
              headers: { Authorization: `Bearer ${user.token}` },
            })
          : await client.GET("/api/v1/organizations/{organizationId}/members/page", {
              params: { path: { organizationId }, query: queryParams },
              headers: { Authorization: `Bearer ${user.token}` },
            });
        if (!cancelled) {
          const paged = (data as unknown as PagedModelLike) ?? {};
          setOrgMembers(
            (paged.content ?? [])
              .map(normalizeOrgMember)
              .filter((member) => member.id == null || member.id !== currentUserId)
          );
        }
      } catch {
        if (!cancelled) setOrgMembers([]);
      } finally {
        if (!cancelled) setOrgMembersLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [addDialogOpen, currentUserId, orgMemberQuery, organizationId, parentSectionId, user]);

  const handleAddMember = async (userId: number) => {
    if (!user || addingMemberId != null) return;
    setAddingMemberId(userId);
    try {
      const { error } = await client.POST(
        "/api/v1/sections/{sectionId}/members/{userId}",
        { params: { path: { sectionId, userId } }, headers: { Authorization: `Bearer ${user.token}` } }
      );
      if (error) throw error;
      showAlert(String(t("sections.addMember")), "success");
      setAddDialogOpen(false);
      setPage(0);
      setRefreshCounter((c) => c + 1);
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as Record<string, unknown>).message)
        : String(t("organizations.members.loadError"));
      showAlert(msg, "warning");
    } finally {
      setAddingMemberId(null);
    }
  };

  const hasMore = useMemo(() => totalElements > (page + 1) * PAGE_SIZE, [page, totalElements]);
  const canAssignRole = sectionPermissions.has("SECTION_ASSIGN_TECH_ROLE");
  const canRemoveMember = sectionPermissions.has("SECTION_MEMBER_REMOVE");
  const canAddMember = sectionPermissions.has("SECTION_MEMBER_ADD");

  const reloadMembers = () => { setPage(0); setRefreshCounter((c) => c + 1); };

  const toggleRole = (id: number) => {
    setRoleIds((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
    setPage(0);
  };

  const toggleInstrument = (id: number) => {
    setInstrumentIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    setPage(0);
  };

  const hasFilters = roles.length > 0 || instruments.length > 0;

  return (
    <Box sx={{ mt: 2 }}>
      <TextField
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(0); }}
        placeholder={t("organizations.members.searchPlaceholder")}
        size="small"
        fullWidth
        sx={{ mb: 1.5 }}
      />

      {hasFilters && (
        <Box sx={{ border: "1px solid #dce6f9", borderRadius: "10px", p: 1.5, mb: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
          {roles.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#7795de", whiteSpace: "nowrap", minWidth: 56 }}>
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

          {instruments.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#7795de", whiteSpace: "nowrap", minWidth: 56, pt: "4px" }}>
                {t("organizations.members.filterByInstrument")}:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, maxHeight: 96, overflowY: "auto", flex: 1 }}>
                {instruments.map((instrument) => (
                  <Chip
                    key={instrument.id}
                    label={getInstrumentLabel(instrument.name, t)}
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
      )}

      {loading && members.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
            {members.map((member, index) => (
              <SectionMemberCard
                key={`${member.id ?? member.name ?? "member"}-${index}`}
                member={member}
                sectionId={sectionId}
                canAssignRole={canAssignRole}
                availableRoles={roles}
                canRemoveMember={canRemoveMember}
                currentUserId={currentUserId}
                onMemberRemoved={reloadMembers}
              />
            ))}
            {canAddMember && (
              <Box
                onClick={() => { setOrgMemberQuery(""); setAddDialogOpen(true); }}
                sx={{
                  borderRadius: "50px",
                  border: "2px dashed #7795de",
                  backgroundColor: "#ffffff",
                  px: 1.5, py: 0.85,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#7795de", fontSize: "1.4rem",
                  minHeight: 56,
                  "&:hover": { backgroundColor: "rgba(119,149,222,0.08)" },
                }}
              >
                +
              </Box>
            )}
          </Box>

          {members.length === 0 && (
            <Typography sx={{ mt: 2, fontFamily: "Century Gothic, sans-serif", color: "#7795de" }}>
              {t("organizations.members.empty")}
            </Typography>
          )}

          {hasMore && (
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
              <Button
                variant="outlined"
                disabled={loading}
                onClick={() => setPage((prev) => prev + 1)}
                sx={{ borderRadius: "8px", borderColor: "#0f3eb5", color: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", textTransform: "none", "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" } }}
              >
                {t("organizations.members.loadMore")}
              </Button>
            </Box>
          )}
        </>
      )}

      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontWeight: 700 }}>
          {t("sections.addMember")}
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <TextField
            value={orgMemberQuery}
            onChange={(e) => setOrgMemberQuery(e.target.value)}
            placeholder={t("organizations.members.searchPlaceholder")}
            size="small"
            fullWidth
            sx={{ mb: 2, mt: 0.5 }}
          />
          {orgMembersLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress sx={{ color: "#0f3eb5" }} />
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {orgMembers.map((m) => (
                <Box
                  key={m.id}
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #7795de", borderRadius: "8px", px: 1.5, py: 1 }}
                >
                  <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.92rem", color: "#0f3eb5", fontWeight: 600 }}>
                    {m.name ?? ""}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={addingMemberId != null}
                    onClick={() => m.id != null && void handleAddMember(m.id)}
                    sx={{ borderRadius: "8px", backgroundColor: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", textTransform: "none", fontSize: "0.8rem", "&:hover": { backgroundColor: "#0d35a0" } }}
                  >
                    {addingMemberId === m.id ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : t("sections.addMember")}
                  </Button>
                </Box>
              ))}
              {orgMembers.length === 0 && (
                <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.9rem" }}>
                  {t("organizations.members.empty")}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
