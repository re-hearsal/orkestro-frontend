import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
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
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { getLocalizedRoleName } from "../utils/roleNameI18n";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];

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
    error: memberContextError,
  } = useOrgMemberContext(organizationId);

  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveActionLoading, setLeaveActionLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const eventsRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now);
    to.setDate(now.getDate() + 30);
    return { from: now.toISOString(), to: to.toISOString() };
  }, [organization?.id]);

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
  }, [isValidOrganizationId, organizationId, setCurrentOrganization, user]);

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
  const isLeader = role?.name === "Leader" || role?.name?.toLowerCase() === "leader";

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
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
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

      <Box
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
      </Box>

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

        <OrgMembersList organizationId={organizationId} permissions={permissions} />
      </Box>

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

      {permissions.has("ORG_TECH_ROLE_MANAGE") && (
        <OrgRolesManager organizationId={organizationId} />
      )}

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
