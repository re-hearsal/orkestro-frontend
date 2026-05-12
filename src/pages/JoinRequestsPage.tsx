import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import JoinRequestCard, {
  type JoinRequestDTO,
} from "../components/organizations/JoinRequestCard";
import {
  emitJoinRequestsUpdated,
  JOIN_REQUESTS_UPDATED_EVENT,
  type JoinRequestsUpdatedDetail,
} from "../utils/joinRequestsEvents";

function parsePendingJoinRequests(raw: unknown): JoinRequestDTO[] {
  let source = raw;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) {
    return [];
  }

  const parsedRequests: JoinRequestDTO[] = [];

  for (const item of source) {
    const request = item as JoinRequestDTO;
    if (typeof request.userId !== "number" || !Number.isFinite(request.userId) || request.userId <= 0) {
      continue;
    }

    parsedRequests.push({
      ...request,
      username: request.username?.trim() || undefined,
      name: request.name?.trim() || undefined,
      description: request.description?.trim() || undefined,
    });
  }

  return parsedRequests.sort((left, right) => {
    const leftTime = left.joinedAt ? new Date(left.joinedAt).getTime() : 0;
    const rightTime = right.joinedAt ? new Date(right.joinedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

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

export default function JoinRequestsPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrganizationId } = useParams();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();

  const organizationId = useMemo(() => Number(rawOrganizationId), [rawOrganizationId]);
  const isValidOrganizationId = Number.isFinite(organizationId) && organizationId > 0;

  const { permissions, loading: memberContextLoading, initialized: memberContextInitialized } = useOrgMemberContext(
    isValidOrganizationId ? organizationId : 0
  );

  const canViewJoinRequests = permissions.has("ORG_JOIN_REQUEST_VIEW");
  const canManageJoinRequests = permissions.has("ORG_JOIN_REQUEST_MANAGE");

  const [requests, setRequests] = useState<JoinRequestDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(
    async (silent = false): Promise<void> => {
      if (!user || !isValidOrganizationId || !canViewJoinRequests) {
        setRequests([]);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/join-requests/pending",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (error) {
          throw error;
        }

        setRequests(parsePendingJoinRequests(data));
      } catch (error) {
        if (!silent) {
          showAlert(getErrorMessage(error) ?? String(t("organizations.profile.loadError")), "error");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [canViewJoinRequests, isValidOrganizationId, organizationId, showAlert, t, user]
  );

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!canViewJoinRequests || !isValidOrganizationId) {
      return;
    }

    const handleJoinRequestUpdate = (event: Event) => {
      const detail = (event as CustomEvent<JoinRequestsUpdatedDetail>).detail;
      if (detail?.organizationId !== undefined && detail.organizationId !== organizationId) {
        return;
      }

      void loadRequests(true);
    };

    window.addEventListener(JOIN_REQUESTS_UPDATED_EVENT, handleJoinRequestUpdate as EventListener);
    return () => {
      window.removeEventListener(JOIN_REQUESTS_UPDATED_EVENT, handleJoinRequestUpdate as EventListener);
    };
  }, [canViewJoinRequests, isValidOrganizationId, loadRequests, organizationId]);

  const handleApprove = useCallback(
    async (request: JoinRequestDTO): Promise<void> => {
      if (!user || !isValidOrganizationId) {
        return;
      }

      if (typeof request.userId !== "number" || !Number.isFinite(request.userId)) {
        return;
      }

      const targetUserId = request.userId;

      const { error } = await client.POST(
        "/api/v1/organizations/{organizationId}/join-requests/{userId}/approve",
        {
          params: { path: { organizationId, userId: targetUserId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );

      if (error) {
        const errorMessage = getErrorMessage(error) ?? String(t("organizations.profile.loadError"));
        showAlert(errorMessage, "error");
        throw new Error(errorMessage);
      }

      setRequests((prev) => prev.filter((item) => item.userId !== targetUserId));
      showAlert(String(t("joinRequests.approved")), "success");
      emitJoinRequestsUpdated({ organizationId });
    },
    [isValidOrganizationId, organizationId, showAlert, t, user]
  );

  const handleReject = useCallback(
    async (request: JoinRequestDTO): Promise<void> => {
      if (!user || !isValidOrganizationId) {
        return;
      }

      if (typeof request.userId !== "number" || !Number.isFinite(request.userId)) {
        return;
      }

      const targetUserId = request.userId;

      const { error } = await client.POST(
        "/api/v1/organizations/{organizationId}/join-requests/{userId}/reject",
        {
          params: { path: { organizationId, userId: targetUserId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );

      if (error) {
        const errorMessage = getErrorMessage(error) ?? String(t("organizations.profile.loadError"));
        showAlert(errorMessage, "error");
        throw new Error(errorMessage);
      }

      setRequests((prev) => prev.filter((item) => item.userId !== targetUserId));
      showAlert(String(t("joinRequests.rejected")), "success");
      emitJoinRequestsUpdated({ organizationId });
    },
    [isValidOrganizationId, organizationId, showAlert, t, user]
  );

  if (!isValidOrganizationId) {
    return <Navigate to="/organizations" replace />;
  }

  if (memberContextInitialized && !memberContextLoading && !canViewJoinRequests) {
    return <Navigate to={`/organizations/${organizationId}`} replace />;
  }

  if (!memberContextInitialized || memberContextLoading || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1024, mx: "auto" }}>
      <Typography
        variant="h5"
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          mb: 2,
        }}
      >
        {t("joinRequests.title")}
      </Typography>

      {requests.length === 0 ? (
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
          }}
        >
          {t("joinRequests.empty")}
        </Typography>
      ) : (
        <Stack spacing={1.2}>
          {requests.map((request) => (
            <JoinRequestCard
              key={`${request.userId}-${request.joinedAt ?? ""}`}
              request={request}
              canManage={canManageJoinRequests}
              currentUserId={profile?.id}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
