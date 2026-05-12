import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CakeIcon from "@mui/icons-material/Cake";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";
import EventList from "../components/events/EventList";
import SectionCard from "../components/sections/SectionCard";
import CreateSectionDialog from "../components/sections/CreateSectionDialog";
import SectionMembersList from "../components/sections/SectionMembersList";
import SectionRolesManager from "../components/sections/SectionRolesManager";
import LeaveSectionDialog from "../components/sections/LeaveSectionDialog";
import OrgInfoMessageSection from "../components/organizations/OrgInfoMessageSection";
import { getLocalizedRoleName } from "../utils/roleNameI18n";

type SectionDTO = components["schemas"]["SectionDTO"];

export default function SectionProfilePage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { organizationId: rawOrgId, sectionId: rawSectionId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const sectionId = useMemo(() => Number(rawSectionId), [rawSectionId]);

  const isValid = Number.isFinite(organizationId) && organizationId > 0
    && Number.isFinite(sectionId) && sectionId > 0;

  const eventsRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now);
    to.setDate(now.getDate() + 30);
    return { from: now.toISOString(), to: to.toISOString() };
  }, [sectionId]);

  const [section, setSection] = useState<SectionDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const [parentSection, setParentSection] = useState<SectionDTO | null>(null);

  const [sectionPermissions, setSectionPermissions] = useState<Set<string>>(new Set());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isNotMember, setIsNotMember] = useState(false);
  const [myRoleName, setMyRoleName] = useState<string | undefined>(undefined);
  const [permissionsTrigger, setPermissionsTrigger] = useState(0);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Child sections
  const [childSections, setChildSections] = useState<SectionDTO[]>([]);
  const [childSectionsLoaded, setChildSectionsLoaded] = useState(false);
  const [childSectionsExpanded, setChildSectionsExpanded] = useState(false);
  const [createChildDialogOpen, setCreateChildDialogOpen] = useState(false);

  // Leave / delete
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load section
  useEffect(() => {
    if (!user || !isValid) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await client.GET("/api/v1/sections/{sectionId}", {
          params: { path: { sectionId } },
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (error) throw error;
        if (!cancelled) setSection((data as SectionDTO) ?? null);
      } catch {
        if (!cancelled) { setSection(null); showAlert(String(t("organizations.profile.loadError")), "error"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isValid, sectionId, user, showAlert, t]);

  // Load parent section name for breadcrumb
  useEffect(() => {
    if (!user || !section?.parentSectionId) { setParentSection(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await client.GET("/api/v1/sections/{sectionId}", {
          params: { path: { sectionId: section.parentSectionId as number } },
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!cancelled) setParentSection((data as SectionDTO) ?? null);
      } catch {
        if (!cancelled) setParentSection(null);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [section?.parentSectionId, user]);

  useEffect(() => {
    if (!user || !isValid) {
      setSectionPermissions(new Set());
      setPermissionsLoaded(false);
      return;
    }
    let cancelled = false;

    const loadPermissions = async () => {
      try {
        const { data, error } = await client.GET("/api/v1/sections/{sectionId}/members/me", {
          params: { path: { sectionId } },
          headers: { Authorization: `Bearer ${user.token}` },
        });

        if (cancelled) return;

        if (error) {
          setSectionPermissions(new Set());
          setMyRoleName(undefined);
          setIsNotMember(true);
          setPermissionsLoaded(true);
          return;
        }

        const ctx = data as { member?: boolean; role?: { id?: number; name?: string } | null; permissions?: string[] };
        setMyRoleName(ctx.role?.name ?? undefined);
        setSectionPermissions(new Set(ctx.permissions ?? []));
        setIsNotMember(!ctx.member);
        setPermissionsLoaded(true);
      } catch {
        if (!cancelled) {
          setSectionPermissions(new Set());
          setMyRoleName(undefined);
          setIsNotMember(true);
          setPermissionsLoaded(true);
        }
      }
    };

    void loadPermissions();
    return () => { cancelled = true; };
  }, [isValid, sectionId, user, permissionsTrigger]);

  useEffect(() => {
    if (!user || !isValid) { setChildSections([]); setChildSectionsLoaded(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await client.GET("/api/v1/sections/{parentSectionId}/sections", {
          params: { path: { parentSectionId: sectionId } },
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!cancelled) {
          setChildSections((data as SectionDTO[] | undefined) ?? []);
          setChildSectionsLoaded(true);
        }
      } catch {
        if (!cancelled) setChildSectionsLoaded(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isValid, sectionId, user]);

  const handleCreateChildSection = useCallback(
    async (data: { name: string; description?: string }) => {
      const { data: newSection, error } = await client.POST(
        "/api/v1/sections/{parentSectionId}/sections",
        {
          params: { path: { parentSectionId: sectionId } },
          headers: { Authorization: `Bearer ${user!.token}` },
          body: data,
        }
      );
      if (error) throw error;
      return newSection as SectionDTO;
    },
    [sectionId, user]
  );

  const handleJoinSection = async () => {
    if (!user || !profile) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    try {
      const { error } = await client.POST("/api/v1/sections/{sectionId}/members/me", {
        params: { path: { sectionId } },
        headers,
      });
      if (error) throw error;
      showAlert(String(t("sections.joinSuccess")), "success");
      setIsNotMember(false);
      setPermissionsTrigger((prev) => prev + 1);
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as Record<string, unknown>).message)
        : String(t("sections.joinError"));
      showAlert(msg, "error");
    }
  };

  const handleOpenEdit = () => {
    setEditName(section?.name ?? "");
    setEditDescription(section?.description ?? "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !section?.id) return;
    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (editName.trim() && editName.trim() !== (section?.name ?? "")) {
        body.name = editName.trim();
      }
      if (editDescription.trim() !== (section?.description ?? "")) {
        body.description = editDescription.trim();
      }

      const { data, error } = await client.PATCH("/api/v1/sections/{sectionId}", {
        params: { path: { sectionId: section.id } },
        headers: { Authorization: `Bearer ${user.token}` },
        body: body as components["schemas"]["SectionUpdateRequestDTO"],
      });
      if (error) throw error;
      setSection(data as SectionDTO);
      setEditDialogOpen(false);
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as Record<string, unknown>).message)
        : String(t("organizations.profile.loadError"));
      showAlert(msg, "error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setLeaveLoading(true);
    try {
      const { error } = await client.DELETE("/api/v1/sections/{sectionId}/members/me", {
        params: { path: { sectionId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (error) throw error;
      setLeaveDialogOpen(false);
      showAlert(String(t("sections.leaveSection")), "success");
      navigateToParent();
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as Record<string, unknown>).message)
        : String(t("sections.leaveSection"));
      showAlert(msg, "error");
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !window.confirm(String(t("sections.confirmDeleteSection")))) return;
    setDeleteLoading(true);
    try {
      const { error } = await client.DELETE("/api/v1/sections/{sectionId}", {
        params: { path: { sectionId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (error) throw error;
      showAlert(String(t("sections.deleteSection")), "success");
      navigateToParent();
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as Record<string, unknown>).message)
        : String(t("sections.deleteSection"));
      showAlert(msg, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const navigateToParent = () => {
    if (section?.parentSectionId != null) {
      navigate(`/organizations/${organizationId}/sections/${section.parentSectionId}`);
    } else {
      navigate(`/organizations/${organizationId}`);
    }
  };

  if (!isValid) return <Navigate to="/organizations" replace />;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (!section) return null;

  const canEdit = sectionPermissions.has("SECTION_EDIT");
  const canDelete = sectionPermissions.has("SECTION_DELETE");
  const canManageRoles = sectionPermissions.has("SECTION_TECH_ROLE_MANAGE");

  const SECTIONS_PREVIEW = 5;
  const visibleChildSections = childSectionsExpanded ? childSections : childSections.slice(0, SECTIONS_PREVIEW);
  const showChildSectionsBlock = childSectionsLoaded && (childSections.length > 0 || permissionsLoaded);

  const parentHref = section.parentSectionId != null
    ? `/organizations/${organizationId}/sections/${section.parentSectionId}`
    : `/organizations/${organizationId}`;

  const parentLabel = section.parentSectionId != null
    ? (parentSection?.name ?? t("sections.backToSection"))
    : t("sections.backToOrganization");

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>
      {/* Breadcrumb */}
      <Box
        onClick={() => navigate(parentHref)}
        sx={{
          display: "inline-flex", alignItems: "center", gap: 0.5,
          cursor: "pointer", color: "#7795de", fontSize: "0.85rem",
          fontFamily: "Century Gothic, sans-serif", mb: 2,
          "&:hover": { color: "#0f3eb5" },
        }}
      >
        <ArrowBackIcon sx={{ fontSize: "1rem" }} />
        <Typography sx={{ fontSize: "0.85rem", fontFamily: "Century Gothic, sans-serif" }}>
          {parentLabel}
        </Typography>
      </Box>

      {/* Edit / Join button top-right */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        {canEdit && (
          <Button
            variant="outlined"
            onClick={handleOpenEdit}
            sx={{ borderRadius: "8px", borderColor: "#0f3eb5", color: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none", "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" } }}
          >
            {t("sections.editSection")}
          </Button>
        )}
        {isNotMember && !canEdit && (
          <Button
            variant="outlined"
            onClick={() => void handleJoinSection()}
            sx={{ borderRadius: "8px", borderColor: "#0f3eb5", color: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none", "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" } }}
          >
            {t("sections.joinSection")}
          </Button>
        )}
      </Box>

      {/* Header */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}>
          {section.name}
        </Typography>
      </Box>

      {section.description!= null && <Box
        sx={{
          mt: 2,
          border: "1px solid #7795de",
          borderRadius: "12px",
          p: 2,
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#0f3eb5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {section.description ?? ""}
        </Typography>
      </Box>}

      {permissionsLoaded && myRoleName && (
        <Typography sx={{ mt: 2, color: "#7795de", fontSize: "0.875rem", fontFamily: "Century Gothic, sans-serif" }}>
          {t("sections.yourRole")}: {getLocalizedRoleName(myRoleName, t)}
        </Typography>
      )}

      {/* Members */}
      <Box sx={{ mt: 5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
              fontSize: "1.15rem",
            }}
          >
            {t("sections.sectionMembers")}
          </Typography>
          <Tooltip title={t("birthdays.tooltipButton")}>
            <IconButton
              size="small"
              onClick={() => navigate(`/organizations/${organizationId}/sections/${sectionId}/birthdays`)}
              sx={{ color: "#7795de", "&:hover": { color: "#0f3eb5" } }}
            >
              <CakeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <SectionMembersList
          sectionId={sectionId}
          organizationId={organizationId}
          sectionPermissions={sectionPermissions}
          currentUserId={profile?.id}
          parentSectionId={section.parentSectionId ?? undefined}
        />
      </Box>

      {/* Technical roles — always show when loaded */}
      {permissionsLoaded && (
        <SectionRolesManager sectionId={sectionId} canManage={canManageRoles} />
      )}

      <Box sx={{ mt: 4 }}>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.15rem" }}>
          {t("sections.upcomingEvents")}
        </Typography>
        <EventList
          organizationId={organizationId}
          from={eventsRange.from}
          to={eventsRange.to}
        />
      </Box>

      {/* Child sections */}
      {showChildSectionsBlock && (
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.15rem" }}>
              {t("sections.childSections")}
            </Typography>
            {permissionsLoaded && !isNotMember && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateChildDialogOpen(true)}
                sx={{ borderRadius: "8px", borderColor: "#0f3eb5", color: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none", fontSize: "0.8rem", "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" } }}
              >
                {t("sections.createSection")}
              </Button>
            )}
          </Box>

          {childSections.length === 0 ? (
            <Typography sx={{ color: "#7795de", fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem" }}>
              {t("sections.noSections")}
            </Typography>
          ) : (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
                {visibleChildSections.map((s) => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    showAvatar={false}
                    onClick={() => navigate(`/organizations/${organizationId}/sections/${s.id}`)}
                  />
                ))}
              </Box>
              {childSections.length > SECTIONS_PREVIEW && (
                <Button
                  size="small"
                  onClick={() => setChildSectionsExpanded((prev) => !prev)}
                  sx={{ mt: 1, color: "#7795de", fontSize: "0.8rem", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
                >
                  {childSectionsExpanded ? t("sections.collapse") : t("sections.showAll")}
                </Button>
              )}
            </>
          )}
        </Box>
      )}

      <OrgInfoMessageSection sectionId={sectionId} />

      {/* Destructive zone */}
      <Box sx={{ mt: 6, display: "flex", gap: 2, flexWrap: "wrap" }}>
        {!isNotMember && (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setLeaveDialogOpen(true)}
            sx={{ borderRadius: "8px", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none" }}
          >
            {t("sections.leaveSection")}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="outlined"
            color="error"
            disabled={deleteLoading}
            onClick={() => void handleDelete()}
            sx={{ borderRadius: "8px", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none" }}
          >
            {deleteLoading ? <CircularProgress size={16} /> : t("sections.deleteSection")}
          </Button>
        )}
      </Box>

      {/* Edit dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => { if (!editLoading) setEditDialogOpen(false); }}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontWeight: 700 }}>
          {t("sections.editSection")}
        </DialogTitle>
        <DialogContent dividers sx={{ overflowY: "auto" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
            <TextField
              label={t("sections.sectionName")}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
              size="small"
              disabled={editLoading}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
            <TextField
              label={t("sections.sectionDescription")}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={3}
              disabled={editLoading}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
          </Box>
        </DialogContent>
        <Box sx={{ display: "flex", flexDirection: { xs: "column-reverse", sm: "row" }, justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
          <Button
            onClick={() => setEditDialogOpen(false)}
            disabled={editLoading}
            variant="outlined"
            fullWidth={fullScreen}
            sx={{ borderRadius: "8px", borderColor: "#7795de", color: "#7795de", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void handleSaveEdit()}
            disabled={editLoading || !editName.trim()}
            variant="contained"
            fullWidth={fullScreen}
            sx={{ borderRadius: "8px", backgroundColor: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none", "&:hover": { backgroundColor: "#0d35a0" } }}
          >
            {editLoading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("common.edit")}
          </Button>
        </Box>
      </Dialog>

      {/* Leave dialog */}
      <LeaveSectionDialog
        open={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        onConfirm={handleLeave}
        loading={leaveLoading}
      />

      {/* Create child section dialog */}
      <CreateSectionDialog
        open={createChildDialogOpen}
        onClose={() => setCreateChildDialogOpen(false)}
        createFn={handleCreateChildSection}
        onCreated={(newSection) => setChildSections((prev) => [...prev, newSection])}
      />
    </Box>
  );
}
