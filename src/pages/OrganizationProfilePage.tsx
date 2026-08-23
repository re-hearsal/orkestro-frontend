import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import CakeIcon from "@mui/icons-material/Cake";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import EventList from "../components/events/EventList";
import OrgAvatar from "../components/organizations/OrgAvatar";
import LeaveOrgDialog from "../components/organizations/LeaveOrgDialog";
import OrgMembersList from "../components/organizations/OrgMembersList";
import OrgRolesManager from "../components/organizations/OrgRolesManager";
import EditOrgDialog from "../components/organizations/EditOrgDialog";
import OrgSocialLinks from "../components/organizations/OrgSocialLinks";
import OrgInfoMessageSection from "../components/organizations/OrgInfoMessageSection";
import SectionCard from "../components/sections/SectionCard";
import CreateSectionDialog from "../components/sections/CreateSectionDialog";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { getLocalizedRoleName } from "../utils/roleNameI18n";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];
type SectionDTO = components["schemas"]["SectionDTO"];

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return null;
}

export default function OrganizationProfilePage() {
  const { t } = useTranslation();
  const { organizationId: rawOrganizationId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();
  const {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    refreshOrganizations,
  } = useOrganization();

  const organizationId = useMemo(
    () => Number(rawOrganizationId),
    [rawOrganizationId]
  );
  const isValidOrganizationId = Number.isFinite(organizationId) && organizationId > 0;

  const {
    role,
    permissions,
    loading: memberContextLoading,
    initialized: memberContextInitialized,
    error: memberContextError,
  } = useOrgMemberContext(organizationId);

  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveActionLoading, setLeaveActionLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [sections, setSections] = useState<SectionDTO[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [sectionsLoadedOk, setSectionsLoadedOk] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState(false);
  const [createSectionDialogOpen, setCreateSectionDialogOpen] = useState(false);

  const eventsRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now);
    to.setDate(now.getDate() + 30);
    return { from: now.toISOString(), to: to.toISOString() };
  }, []);

  useEffect(() => {
    if (!user || !isValidOrganizationId) {
      setLoading(false);
      setOrganization(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadOrganization = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: responseError } = await client.GET(
          "/api/v1/organizations/{organizationId}",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (responseError) {
          throw responseError;
        }

        const org = data as unknown as OrganizationDTO;

        if (!cancelled) {
          setOrganization(org ?? null);
          if (org?.id != null) {
            setCurrentOrganization(org);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setOrganization(null);
          setError(err);
          showAlert(
            getErrorMessage(err) ?? String(t("organizations.profile.loadError")),
            "error"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, [isValidOrganizationId, organizationId, setCurrentOrganization, user, showAlert, t]);

  useEffect(() => {
    if (!user || !isValidOrganizationId) {
      setSections([]);
      setSectionsLoaded(false);
      setSectionsLoadedOk(false);
      return;
    }

    let cancelled = false;

    const loadSections = async () => {
      try {
        const { data } = await client.GET(
          "/api/v1/organizations/{organizationId}/sections",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (!cancelled) {
          setSections((data as SectionDTO[] | undefined) ?? []);
          setSectionsLoaded(true);
          setSectionsLoadedOk(true);
        }
      } catch {
        if (!cancelled) {
          setSectionsLoaded(true);
          setSectionsLoadedOk(false);
        }
      }
    };

    void loadSections();

    return () => {
      cancelled = true;
    };
  }, [isValidOrganizationId, organizationId, user]);

  useEffect(() => {
    if (memberContextError) {
      showAlert(
        getErrorMessage(memberContextError) ?? String(t("organizations.profile.memberContextError")),
        "warning"
      );
    }
  }, [memberContextError, showAlert, t]);

  const handleOrganizationUpdated = useCallback(
    (updatedOrganization: OrganizationDTO) => {
      setOrganization(updatedOrganization);
      setCurrentOrganization(updatedOrganization);
      refreshOrganizations();
    },
    [refreshOrganizations, setCurrentOrganization]
  );

  const handleLeaveOrganization = useCallback(async () => {
    if (!user || leaveActionLoading) {
      return;
    }

    setLeaveActionLoading(true);

    try {
      const { error: responseError } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/members/me",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );

      if (responseError) {
        setLeaveDialogOpen(false);
        const apiError = responseError as components["schemas"]["ApiErrorResponse"];

        if (apiError?.status === 401) {
          logout();
          showAlert(String(t("auth.errors.sessionExpired")), "error");
          navigate("/auth", { replace: true });
          return;
        }

        showAlert(
          getErrorMessage(responseError) ?? String(t("organizations.leaveDialog.leaveFailed")),
          "error"
        );
        return;
      }

      if (organization?.id != null && organization.id === currentOrganization?.id) {
        const remainingOrganizations = organizations.filter((org) => org.id !== organization.id);
        localStorage.removeItem("currentOrganizationId");
        setCurrentOrganization(remainingOrganizations[0] ?? null);
      }

      refreshOrganizations();
      setLeaveDialogOpen(false);
      showAlert(String(t("organizations.leaveDialog.leaveSuccess")), "success");
      navigate("/organizations");
    } catch (err) {
      setLeaveDialogOpen(false);
      showAlert(getErrorMessage(err) ?? String(t("organizations.leaveDialog.leaveFailed")), "error");
    } finally {
      setLeaveActionLoading(false);
    }
  }, [
    currentOrganization?.id,
    leaveActionLoading,
    navigate,
    organization?.id,
    organizationId,
    organizations,
    refreshOrganizations,
    logout,
    setCurrentOrganization,
    showAlert,
    t,
    user,
  ]);

  const handleCreateSection = useCallback(
    async (data: { name: string; description?: string }) => {
      const { data: newSection, error: responseError } = await client.POST(
        "/api/v1/organizations/{organizationId}/sections",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user!.token}` },
          body: data,
        }
      );
      if (responseError) {throw responseError;}
      return newSection as SectionDTO;
    },
    [organizationId, user]
  );

  if (!isValidOrganizationId) {
    return <Navigate to="/organizations" replace />;
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (error || !organization) {
    return null;
  }

  const canEdit = permissions.has("ORG_EDIT");
  const canManageRoles = permissions.has("ORG_TECH_ROLE_MANAGE");
  const canManageTemplates = permissions.has("EVENT_MANAGE_DESCRIPTIONS");
  const isLeader = role?.name === "Leader" || role?.name?.toLowerCase() === "leader";

  const SECTIONS_PREVIEW = 5;
  const visibleSections = sectionsExpanded ? sections : sections.slice(0, SECTIONS_PREVIEW);
  // Show the block only if we successfully loaded (user is a member) AND either there are sections or we can create
  const showSectionsBlock = sectionsLoadedOk && (sections.length > 0 || sectionsLoaded);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
          width: "100%",
        }}
      >
        {canManageTemplates && organization.id != null && (
          <Button
            variant="outlined"
            onClick={() => navigate(`/organizations/${organizationId}/event-templates`)}
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": {
                borderColor: "#0f3eb5",
                backgroundColor: "rgba(15,62,181,0.08)",
              },
            }}
          >
            {t("events.templates.button")}
          </Button>
        )}
        {canEdit && organization.id != null && (
          <Button
            variant="outlined"
            onClick={() => setEditDialogOpen(true)}
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": {
                borderColor: "#0f3eb5",
                backgroundColor: "rgba(15,62,181,0.08)",
              },
            }}
          >
            {t("organizations.profile.editButton")}
          </Button>
        )}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <OrgAvatar
          organizationId={organizationId}
          organizationName={organization.name ?? ""}
          profileImageFileId={organization.profileImageFileId}
          canEdit={canEdit}
          onOrganizationUpdated={handleOrganizationUpdated}
        />
      </Box>

      <Box
        sx={{
          mt: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {organization.name}
          </Typography>

          {organization.location && (
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                color: "#7795de",
                fontSize: "0.9rem",
                mt: 0.5,
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {organization.location}
            </Typography>
          )}
        </Box>

        <OrgSocialLinks links={organization.links} />
      </Box>

      {organization.description!=null && <Box
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
          {organization.description ?? ""}
        </Typography>
      </Box>}

      {!memberContextLoading && role?.name && (
        <Typography
          sx={{
            mt: 2,
            color: "#7795de",
            fontSize: "0.875rem",
            fontFamily: "Century Gothic, sans-serif",
          }}
        >
          {t("organizations.profile.yourRole")}: {getLocalizedRoleName(role.name, t)}
        </Typography>
      )}

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
            {t("organizations.profile.membersSection")}
          </Typography>
          <Tooltip title={t("birthdays.tooltipButton")}>
            <IconButton
              size="small"
              onClick={() => navigate(`/organizations/${organizationId}/birthdays`)}
              sx={{ color: "#7795de", "&:hover": { color: "#0f3eb5" } }}
            >
              <CakeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <OrgMembersList organizationId={organizationId} permissions={permissions} />
      </Box>

      {showSectionsBlock && (
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                color: "#0f3eb5",
                fontSize: "1.15rem",
              }}
            >
              {t("sections.sections")}
            </Typography>
            {sectionsLoaded && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateSectionDialogOpen(true)}
                sx={{
                  borderRadius: "8px",
                  borderColor: "#0f3eb5",
                  color: "#0f3eb5",
                  fontFamily: "Century Gothic, sans-serif",
                  fontWeight: 700,
                  textTransform: "none",
                  fontSize: "0.8rem",
                  "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
                }}
              >
                {t("sections.createSection")}
              </Button>
            )}
          </Box>

          {sections.length === 0 ? (
            <Typography sx={{ color: "#7795de", fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem" }}>
              {t("sections.noSections")}
            </Typography>
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                  gap: 1.25,
                }}
              >
                {visibleSections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    showAvatar={false}
                    onClick={() => navigate(`/organizations/${organizationId}/sections/${section.id}`)}
                  />
                ))}
              </Box>

              {sections.length > SECTIONS_PREVIEW && (
                <Button
                  size="small"
                  onClick={() => setSectionsExpanded((prev) => !prev)}
                  sx={{
                    mt: 1,
                    color: "#7795de",
                    fontSize: "0.8rem",
                    fontFamily: "Century Gothic, sans-serif",
                    textTransform: "none",
                  }}
                >
                  {sectionsExpanded ? t("sections.collapse") : t("sections.showAll")}
                </Button>
              )}
            </>
          )}
        </Box>
      )}

      <CreateSectionDialog
        open={createSectionDialogOpen}
        onClose={() => setCreateSectionDialogOpen(false)}
        createFn={handleCreateSection}
        onCreated={(newSection) => setSections((prev) => [...prev, newSection])}
      />

      <Box sx={{ mt: 4 }}>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            fontSize: "1.15rem",
          }}
        >
          {t("organizations.profile.eventsSection")}
        </Typography>

        <EventList
          organizationId={organizationId}
          from={eventsRange.from}
          to={eventsRange.to}
        />
      </Box>

      {memberContextInitialized && (
        <OrgRolesManager organizationId={organizationId} canManage={canManageRoles} />
      )}

      <OrgInfoMessageSection organizationId={organizationId} />

      <Box sx={{ mt: 6 }}>
        <Button
          type="button"
          variant="outlined"
          color="error"
          onClick={() => setLeaveDialogOpen(true)}
          disabled={leaveActionLoading}
          sx={{
            borderRadius: "8px",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            textTransform: "none",
          }}
        >
          {t("organizations.profile.leaveButton")}
        </Button>
      </Box>

      <LeaveOrgDialog
        open={leaveDialogOpen}
        onClose={() => {
          if (!leaveActionLoading) {
            setLeaveDialogOpen(false);
          }
        }}
        onConfirm={handleLeaveOrganization}
        isLeader={Boolean(isLeader)}
      />

      {editDialogOpen && (
        <EditOrgDialog
          open={editDialogOpen}
          organization={organization}
          onClose={() => setEditDialogOpen(false)}
          onSaved={handleOrganizationUpdated}
        />
      )}
    </Box>
  );
}
