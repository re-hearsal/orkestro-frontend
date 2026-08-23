import { Box, Paper, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { components } from "../../api/schema";
import { navigateToUser } from "../../utils/navigateToUser";

type TaskDTO = components["schemas"]["TaskDTO"];

interface TaskCardProps {
  task: TaskDTO;
  isClosedList?: boolean;
  currentUserId?: number;
}

function formatDate(value?: string | null): string {
  if (!value) {return "-";}
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {return "-";}
  return `${parsed.toLocaleDateString("ru-RU")  } ${  parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

const CLOSED_STATUSES = new Set(["DONE", "CANCELLED"]);

export default function TaskCard({ task, isClosedList, currentUserId }: TaskCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isClosed = CLOSED_STATUSES.has(task.status ?? "");
  const isDeadlinePast = task.deadline ? new Date(task.deadline) < new Date() : false;
  const showDeadline = !!task.deadline && !isClosed;

  const createdLine = `${t("tasks.createdAt")}: ${formatDate(task.createdAt)}`;
  const secondLine = isClosedList && task.closedAt
    ? `${t("tasks.closedAt")}: ${formatDate(task.closedAt)}`
    : `${t("tasks.updatedAt")}: ${formatDate(task.updatedAt)}`;

  return (
    <Paper
      elevation={0}
      onClick={() => navigate(`/organizations/${task.organizationId}/tasks/${task.id}`)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.5,
        border: "1px solid #dce6f9",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "background 0.15s",
        "&:hover": { background: "#f0f4fd" },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "1rem",
            fontFamily: "Century Gothic, sans-serif",
            color: "#0f3eb5",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </Typography>

        {task.author?.name && (
          <Typography
            sx={{
              fontSize: "0.82rem",
              color: "#1976d2",
              fontFamily: "Century Gothic, sans-serif",
            }}
          >
            <Box
              component="span"
              onClick={(e) => { e.stopPropagation(); navigateToUser(task.author?.userId, currentUserId, navigate); }}
              sx={{
                cursor: task.author?.userId ? "pointer" : "default",
                "&:hover": task.author?.userId ? { textDecoration: "underline" } : {},
              }}
            >
              {task.author.name}
            </Box>
          </Typography>
        )}

        <Typography
          sx={{
            fontSize: "0.78rem",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            mt: 0.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {createdLine}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.78rem",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {secondLine}
        </Typography>

        {showDeadline && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: "0.85rem", color: isDeadlinePast ? "#d32f2f" : "#7795de" }} />
            <Typography
              sx={{
                fontSize: "0.78rem",
                fontFamily: "Century Gothic, sans-serif",
                color: isDeadlinePast ? "#d32f2f" : "#7795de",
              }}
            >
              {formatDate(task.deadline)}
            </Typography>
          </Box>
        )}
      </Box>

      <ChevronRightIcon sx={{ color: "#7795de", flexShrink: 0 }} />
    </Paper>
  );
}
