import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import { onTaskUpdated, onTaskDeleted } from "../utils/taskEvents";
import TaskCard from "../components/tasks/TaskCard";
import CreateTaskDialog from "../components/tasks/CreateTaskDialog";

type TaskDTO = components["schemas"]["TaskDTO"];

interface PagedTasksResponse {
  content?: TaskDTO[];
  page?: { totalPages?: number };
}

const PAGE_SIZE = 20;

export default function OrgTasksPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrganizationId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const organizationId = useMemo(() => Number(rawOrganizationId), [rawOrganizationId]);
  const isValidOrganizationId = Number.isFinite(organizationId) && organizationId > 0;

  const { permissions } = useOrgMemberContext(isValidOrganizationId ? organizationId : 0);
  const canManageTasks = permissions.has("TASK_MANAGE");

  const [allTasks, setAllTasks] = useState<TaskDTO[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const silentReloadSeqRef = useRef(0);

  // Sync current organization
  useEffect(() => {
    if (!isValidOrganizationId) {return;}
    if (currentOrganization?.id === organizationId) {return;}
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) {setCurrentOrganization(matched);}
  }, [currentOrganization?.id, isValidOrganizationId, organizationId, organizations, setCurrentOrganization]);

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (!user || !isValidOrganizationId) {return;}
      setLoading(true);
      try {
        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/tasks/available/page",
          {
            params: {
              path: { organizationId },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              query: withFlatPagination({}, { page: pageNum, size: PAGE_SIZE }) as any,
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (error) {throw error;}
        const payload = (data as unknown as PagedTasksResponse) ?? {};
        const content = payload.content ?? [];
        setAllTasks((prev) => (replace ? content : [...prev, ...content]));
        setPage(pageNum);
        setTotalPages(payload.page?.totalPages ?? 0);
      } catch {
        // keep existing tasks on error
      } finally {
        setLoading(false);
      }
    },
    [isValidOrganizationId, organizationId, user]
  );

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  const reload = useCallback(() => {
    void loadPage(0, true);
  }, [loadPage]);

  // Silent reload for WS events — fetches in background without showing spinner
  const silentReload = useCallback(async () => {
    if (!user || !isValidOrganizationId) {return;}
    const seq = ++silentReloadSeqRef.current;
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/tasks/available/page",
        {
          params: {
            path: { organizationId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query: withFlatPagination({}, { page: 0, size: PAGE_SIZE }) as any,
          },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (seq !== silentReloadSeqRef.current) {return;}
      if (error) {throw error;}
      const payload = (data as unknown as PagedTasksResponse) ?? {};
      setAllTasks(payload.content ?? []);
      setPage(0);
      setTotalPages(payload.page?.totalPages ?? 0);
    } catch {
      // ignore
    }
  }, [isValidOrganizationId, organizationId, user]);

  useEffect(() => {
    const off1 = onTaskUpdated((d) => { if (d.organizationId === organizationId) {void silentReload();} });
    const off2 = onTaskDeleted((d) => { if (d.organizationId === organizationId) {void silentReload();} });
    return () => { off1(); off2(); };
  }, [organizationId, silentReload]);

  const handleLoadMore = () => {
    if (page + 1 < totalPages) {
      void loadPage(page + 1, false);
    }
  };

  const openTasks = allTasks.filter((t) => t.status === "OPEN");
  const inProgressTasks = allTasks.filter((t) => t.status === "IN_PROGRESS");
  const hasMore = totalPages > page + 1;

  const columnHeaderSx = {
    fontFamily: "Century Gothic, sans-serif",
    fontWeight: 700,
    fontSize: "1rem",
    color: "#0f3eb5",
    mb: 1.5,
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1100, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}
        >
          {t("tasks.title")}
        </Typography>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            onClick={() => navigate(`/organizations/${organizationId}/tasks/closed`)}
            sx={{
              borderRadius: "8px",
              borderColor: "#7795de",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              whiteSpace: "nowrap",
              "&:hover": { borderColor: "#0f3eb5", color: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.04)" },
            }}
          >
            {t("tasks.closedButton")}
          </Button>

          {canManageTasks && (
            <Button
              variant="outlined"
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                borderRadius: "8px",
                borderColor: "#0f3eb5",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                textTransform: "none",
                whiteSpace: "nowrap",
                "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
              }}
            >
              {t("tasks.createButton")}
            </Button>
          )}
        </Box>
      </Box>

      {loading && allTasks.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : (
        <>
          {/* Two-column grid */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
            {/* OPEN column */}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={columnHeaderSx}>{t("tasks.status.open")}</Typography>
              {openTasks.length === 0 ? (
                <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.9rem" }}>
                  {t("tasks.empty")}
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {openTasks.map((task) => (
                    <TaskCard key={task.id} task={task} currentUserId={profile?.id} />
                  ))}
                </Box>
              )}
              {hasMore && (
                <Button
                  onClick={handleLoadMore}
                  disabled={loading}
                  size="small"
                  sx={{
                    mt: 1.5,
                    fontFamily: "Century Gothic, sans-serif",
                    textTransform: "none",
                    color: "#0f3eb5",
                  }}
                >
                  {t("tasks.loadMore")}
                </Button>
              )}
            </Box>

            {/* IN_PROGRESS column */}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={columnHeaderSx}>{t("tasks.status.inProgress")}</Typography>
              {inProgressTasks.length === 0 ? (
                <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.9rem" }}>
                  {t("tasks.empty")}
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {inProgressTasks.map((task) => (
                    <TaskCard key={task.id} task={task} currentUserId={profile?.id} />
                  ))}
                </Box>
              )}
              {hasMore && (
                <Button
                  onClick={handleLoadMore}
                  disabled={loading}
                  size="small"
                  sx={{
                    mt: 1.5,
                    fontFamily: "Century Gothic, sans-serif",
                    textTransform: "none",
                    color: "#0f3eb5",
                  }}
                >
                  {t("tasks.loadMore")}
                </Button>
              )}
            </Box>
          </Box>

          {loading && allTasks.length > 0 && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} sx={{ color: "#0f3eb5" }} />
            </Box>
          )}

        </>
      )}

      <CreateTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        organizationId={organizationId}
        onCreated={() => {
          setCreateDialogOpen(false);
          reload();
        }}
      />
    </Box>
  );
}
