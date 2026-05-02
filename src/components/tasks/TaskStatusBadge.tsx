import type { MouseEvent } from "react";
import { Chip } from "@mui/material";
import { useTranslation } from "react-i18next";

interface TaskStatusBadgeProps {
  status: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  large?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  OPEN: { bg: "#e8f5e9", color: "#2e7d32" },
  IN_PROGRESS: { bg: "#e3f2fd", color: "#1565c0" },
  DONE: { bg: "#e8f5e9", color: "#2e7d32" },
  CANCELLED: { bg: "#ffebee", color: "#c62828" },
};

const STATUS_KEYS: Record<string, string> = {
  OPEN: "tasks.status.open",
  IN_PROGRESS: "tasks.status.inProgress",
  DONE: "tasks.status.done",
  CANCELLED: "tasks.status.cancelled",
};

export default function TaskStatusBadge({ status, onClick, large }: TaskStatusBadgeProps) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status] ?? { bg: "#f5f5f5", color: "#616161" };
  const label = STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status;

  return (
    <Chip
      label={label}
      size={large ? "medium" : "small"}
      onClick={onClick}
      sx={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontFamily: "Century Gothic, sans-serif",
        fontWeight: 700,
        fontSize: large ? "0.95rem" : "0.78rem",
        borderRadius: "8px",
        px: large ? 0.5 : 0,
        height: large ? 36 : undefined,
        ...(onClick ? { cursor: "pointer" } : {}),
      }}
    />
  );
}
