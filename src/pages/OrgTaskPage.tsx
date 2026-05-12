import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import i18n from "../i18n";
import type { components } from "../api/schema";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { onTaskUpdated, onTaskDeleted } from "../utils/taskEvents";
import { navigateToUser } from "../utils/navigateToUser";
import TaskStatusBadge from "../components/tasks/TaskStatusBadge";
import TaskAssigneesSection from "../components/tasks/TaskAssigneesSection";
import TaskFileSection from "../components/tasks/TaskFileSection";
import TaskVisibilitySection from "../components/tasks/TaskVisibilitySection";
import EditTaskDialog from "../components/tasks/EditTaskDialog";

type TaskDTO = components["schemas"]["TaskDTO"];

const ALL_STATUSES: Array<"OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"> = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return (
    parsed.toLocaleDateString("ru-RU") +
    " " +
    parsed.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

const CLOSED_STATUSES = new Set(["DONE", "CANCELLED"]);

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "" : "http://localhost:8080");

export default function OrgTaskPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrgId, taskId: rawTaskId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, currentOrganization, setCurrentOrganization } =
    useOrganization();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const taskId = useMemo(() => Number(rawTaskId), [rawTaskId]);
  const isValid =
    Number.isFinite(organizationId) &&
    organizationId > 0 &&
    Number.isFinite(taskId) &&
    taskId > 0;

  const { permissions } = useOrgMemberContext(isValid ? organizationId : 0);
  const canManageTasks = permissions.has("TASK_MANAGE");

  const [task, setTask] = useState<TaskDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Delete task
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit task dialog
  const [editOpen, setEditOpen] = useState(false);

  // Status change menu
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Author avatar
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);

  // Timestamp of last local mutation — used to suppress WS echo reloads
  const lastMutationRef = useRef<number>(0);
  // Request counter — only the latest loadTask response is applied
  const loadTaskSeqRef = useRef<number>(0);

  // Sync current organization
  useEffect(() => {
    if (!isValid) return;
    if (currentOrganization?.id === organizationId) return;
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) setCurrentOrganization(matched);
  }, [
    currentOrganization?.id,
    isValid,
    organizationId,
    organizations,
    setCurrentOrganization,
  ]);

  const loadTask = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user || !isValid) return;
      const seq = ++loadTaskSeqRef.current;
      const isSilent = options?.silent === true;
      if (!isSilent) setLoading(true);
      try {
        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/tasks/{taskId}",
          {
            params: { path: { organizationId, taskId } },
            headers: {
              Authorization: `Bearer ${user.token}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cache: "no-store" as any,
          }
        );
        // Discard response if a newer request was already started
        if (seq !== loadTaskSeqRef.current) return;
        if (error) {
          const status = (error as { status?: number }).status;
          if (status === 404) {
            showAlert(String(i18n.t("tasks.deleted")), "error");
            navigate(`/organizations/${organizationId}/tasks`);
            return;
          }
          throw error;
        }
        setTask(data as unknown as TaskDTO);
      } catch (err) {
        showAlert(getErrorMessage(err), "error");
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [isValid, navigate, organizationId, showAlert, taskId, user]
  );

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  // Load author avatar
  useEffect(() => {
    if (!task?.author?.profileImageFileId || !user) return;
    const fileId = task.author.profileImageFileId;
    setAuthorAvatarUrl(null);
    void (async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/files/${fileId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (response.ok) {
          const blob = await response.blob();
          setAuthorAvatarUrl(URL.createObjectURL(blob));
        }
      } catch {
        // ignore
      }
    })();
  }, [task?.author?.profileImageFileId, user]);

  // WS events
  useEffect(() => {
    const off1 = onTaskUpdated((d) => {
      if (d.organizationId === organizationId && d.taskId === taskId) {
        // Skip WS echo within 2s of our own mutation — PATCH already returned up-to-date state
        if (Date.now() - lastMutationRef.current < 2000) return;
        void loadTask({ silent: true });
      }
    });
    const off2 = onTaskDeleted((d) => {
      if (d.organizationId === organizationId && d.taskId === taskId) {
        showAlert(String(i18n.t("tasks.deleted")), "warning");
        navigate(`/organizations/${organizationId}/tasks`);
      }
    });
    return () => {
      off1();
      off2();
    };
  }, [loadTask, navigate, organizationId, showAlert, taskId]);

  // ── Status change ──────────────────────────────────────────────────────────

  const currentUserId = profile?.id;
  const isAuthor = task?.author?.userId === currentUserId;
  const isAssignee = task?.assignees?.some((a) => a.userId === currentUserId) ?? false;
  const canChangeStatus = isAuthor || isAssignee;

  const handleStatusChange = async (newStatus: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED") => {
    if (!user || !task) return;
    setStatusAnchor(null);

    // Optimistic update — apply immediately so UI responds without waiting for server
    const previousTask = task;
    lastMutationRef.current = Date.now();
    setTask({ ...task, status: newStatus });
    setUpdatingStatus(true);

    try {
      const { error } = await client.PATCH(
        "/api/v1/organizations/{organizationId}/tasks/{taskId}/status",
        {
          params: { path: { organizationId, taskId } },
          body: { status: newStatus },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
    } catch (err) {
      // Revert on failure
      setTask(previousTask);
      lastMutationRef.current = 0;
      showAlert(getErrorMessage(err), "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Delete task ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/tasks/{taskId}",
        {
          params: { path: { organizationId, taskId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      showAlert(String(t("tasks.deleted")), "success");
      navigate(`/organizations/${organizationId}/tasks`);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (!task) return null;

  const isClosed = CLOSED_STATUSES.has(task.status ?? "");
  const isDeadlinePast = task.deadline
    ? new Date(task.deadline) < new Date()
    : false;
  const canEdit = isAuthor || canManageTasks;

  const sectionBoxSx = {
    mb: 2,
    border: "1px solid #dce6f9",
    borderRadius: "12px",
    background: "#fff",
    p: { xs: 2, sm: 3 },
  };

  const sectionTitleSx = {
    fontFamily: "Century Gothic, sans-serif",
    fontWeight: 700,
    color: "#0f3eb5",
    fontSize: "1rem",
    mb: 1,
  };

  const dateLabelSx = {
    fontFamily: "Century Gothic, sans-serif",
    fontSize: "0.78rem",
    color: "#7795de",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  };

  const dateValueSx = {
    fontFamily: "Century Gothic, sans-serif",
    fontSize: "0.9rem",
    color: "#1a2f63",
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1100, mx: "auto" }}>
      {/* Back button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/organizations/${organizationId}/tasks`)}
          sx={{
            borderRadius: "8px",
            color: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { backgroundColor: "rgba(15,62,181,0.08)" },
          }}
        >
          {t("tasks.title")}
        </Button>
      </Box>

      {/* Two-column layout */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" },
          gap: 3,
          alignItems: "start",
        }}
      >
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <Box>
          {/* Title + status badge + edit button */}
          <Box sx={sectionBoxSx}>
            {/* Top row: title + status badge */}
            <Box
              sx={{
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                gap: 2,
                mb: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "Century Gothic, sans-serif",
                  color: "#0f3eb5",
                  wordBreak: "break-word",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {task.title}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                {updatingStatus && (
                  <CircularProgress size={18} sx={{ color: "#0f3eb5" }} />
                )}
                {canChangeStatus ? (
                  <>
                    <TaskStatusBadge
                      status={task.status ?? ""}
                      large
                      onClick={
                        updatingStatus
                          ? undefined
                          : (e) => setStatusAnchor(e.currentTarget)
                      }
                    />
                    <Menu
                      anchorEl={statusAnchor}
                      open={Boolean(statusAnchor)}
                      onClose={() => setStatusAnchor(null)}
                    >
                      {ALL_STATUSES.map((s) => (
                        <MenuItem
                          key={s}
                          disabled={s === task.status}
                          onClick={() => void handleStatusChange(s)}
                        >
                          {t(`tasks.status.${s === "IN_PROGRESS" ? "inProgress" : s.toLowerCase()}`)}
                        </MenuItem>
                      ))}
                    </Menu>
                  </>
                ) : (
                  <TaskStatusBadge status={task.status ?? ""} large />
                )}
              </Box>
            </Box>

            {/* Edit button row */}
            {canEdit && (
              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setEditOpen(true)}
                  sx={{
                    borderRadius: "8px",
                    borderColor: "#0f3eb5",
                    color: "#0f3eb5",
                    fontFamily: "Century Gothic, sans-serif",
                    fontWeight: 700,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    "&:hover": {
                      borderColor: "#0f3eb5",
                      backgroundColor: "rgba(15,62,181,0.08)",
                    },
                  }}
                >
                  {t("common.edit")}
                </Button>
              </Box>
            )}
          </Box>

          {/* Description section */}
          {task.description && (
            <Box sx={sectionBoxSx}>
              <Typography sx={sectionTitleSx}>
                {t("tasks.description.section")}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#1a2f63",
                  fontSize: "0.96rem",
                  lineHeight: 1.55,
                }}
              >
                {task.description}
              </Typography>
            </Box>
          )}

          {/* Deadline section */}
          {task.deadline && (
            <Box sx={sectionBoxSx}>
              <Typography sx={sectionTitleSx}>
                {t("tasks.deadline.section")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <AccessTimeIcon
                  sx={{
                    fontSize: "1rem",
                    color: isDeadlinePast && !isClosed ? "#d32f2f" : "#7795de",
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    fontSize: "0.96rem",
                    color: isDeadlinePast && !isClosed ? "#d32f2f" : "#1a2f63",
                  }}
                >
                  {formatDate(task.deadline)}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Files section */}
          <Box sx={sectionBoxSx}>
            <TaskFileSection
              taskId={taskId}
              organizationId={organizationId}
              fileIds={task.fileIds ?? []}
              canManage={canEdit}
              onUpdated={() => void loadTask({ silent: true })}
            />
          </Box>

          {/* Delete button */}
          {canEdit && (
            <Box sx={{ mt: 1 }}>
              <Button
                color="error"
                variant="outlined"
                onClick={() => setDeleteOpen(true)}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontFamily: "Century Gothic, sans-serif",
                  fontWeight: 700,
                }}
              >
                {t("tasks.deleteButton")}
              </Button>
            </Box>
          )}
        </Box>

        {/* ── Metadata column ──────────────────────────────────────────────── */}
        <Box sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
          {/* Author */}
          <Box sx={{ ...sectionBoxSx }}>
            <Typography sx={sectionTitleSx}>{t("tasks.author")}</Typography>
            <Box
              onClick={() => navigateToUser(task.author?.userId, profile?.id, navigate)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                cursor: task.author?.userId ? "pointer" : "default",
                "&:hover": task.author?.userId ? { backgroundColor: "rgba(15,62,181,0.06)" } : {},
                borderRadius: "8px",
                p: 0.5,
                mx: -0.5,
              }}
            >
              <Avatar
                src={authorAvatarUrl ?? undefined}
                sx={{ width: 40, height: 40, bgcolor: "#0f3eb5" }}
              >
                {task.author?.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Typography
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  fontWeight: 600,
                  color: "#1a2f63",
                  fontSize: "0.96rem",
                }}
              >
                {task.author?.name}
              </Typography>
            </Box>
          </Box>

          {/* Dates */}
          <Box sx={{ ...sectionBoxSx }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Box>
                <Typography sx={dateLabelSx}>{t("tasks.createdAt")}</Typography>
                <Typography sx={dateValueSx}>{formatDate(task.createdAt)}</Typography>
              </Box>
              <Box>
                <Typography sx={dateLabelSx}>{t("tasks.updatedAt")}</Typography>
                <Typography sx={dateValueSx}>{formatDate(task.updatedAt)}</Typography>
              </Box>
              {task.closedAt && (
                <Box>
                  <Typography sx={dateLabelSx}>{t("tasks.closedAt")}</Typography>
                  <Typography sx={dateValueSx}>{formatDate(task.closedAt)}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Assignees section */}
          <Box sx={{ ...sectionBoxSx }}>
            <TaskAssigneesSection
              task={task}
              organizationId={organizationId}
              canManage={canEdit}
              currentUserId={profile?.id}
              onUpdated={() => void loadTask({ silent: true })}
            />
          </Box>

          {/* Visibility section */}
          <Box sx={{ ...sectionBoxSx }}>
            <TaskVisibilitySection
              task={task}
              organizationId={organizationId}
              canManage={false}
              onUpdated={() => void loadTask({ silent: true })}
            />
          </Box>
        </Box>
      </Box>

      {/* Edit task dialog */}
      <EditTaskDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        task={task}
        organizationId={organizationId}
        onUpdated={() => {
          setEditOpen(false);
          void loadTask({ silent: true });
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => { if (!deleting) setDeleteOpen(false); }}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
      >
        <DialogTitle
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "error.main",
          }}
        >
          {t("tasks.deleteButton")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("tasks.confirmDelete")}
          </Typography>
        </DialogContent>
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}
        >
          <Button
            variant="outlined"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
            sx={{
              borderRadius: "8px",
              borderColor: "#7795de",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => void handleDelete()}
            disabled={deleting}
            sx={{
              borderRadius: "8px",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
            }}
          >
            {deleting ? <CircularProgress size={18} /> : t("tasks.deleteButton")}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
