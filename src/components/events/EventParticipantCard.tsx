import { useEffect, useState } from "react";
import { Avatar, Box, Chip, Menu, MenuItem, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { navigateToUser } from "../../utils/navigateToUser";

export interface EventParticipantRow {
  userId?: number;
  name?: string;
  profileImageFileId?: number;
  rsvpStatus?: "PENDING" | "ACCEPTED" | "DECLINED";
  attendanceStatus?: "UNKNOWN" | "ATTENDED" | "ABSENT" | "EXCUSED";
}

interface Props {
  participant: EventParticipantRow;
  organizationId: number;
  eventId: number;
  canMarkAttendance: boolean;
  onAttendanceUpdated: (userId: number, status: "UNKNOWN" | "ATTENDED" | "ABSENT" | "EXCUSED") => void;
}

interface StatusStyle {
  bg: string;
  color: string;
  dot: string;
}

function rsvpStyle(status?: string): StatusStyle {
  if (status === "ACCEPTED") return { bg: "#e8f5e9", color: "#2e7d32", dot: "#4caf50" };
  if (status === "DECLINED") return { bg: "#ffebee", color: "#c62828", dot: "#f44336" };
  return { bg: "#f5f5f5", color: "#757575", dot: "#9e9e9e" };
}

function attendanceStyle(status?: string): StatusStyle {
  if (status === "ATTENDED") return { bg: "#e8f5e9", color: "#2e7d32", dot: "#4caf50" };
  if (status === "ABSENT")   return { bg: "#ffebee", color: "#c62828", dot: "#f44336" };
  if (status === "EXCUSED")  return { bg: "#fff3e0", color: "#e65100", dot: "#ff9800" };
  return { bg: "#f5f5f5", color: "#757575", dot: "#9e9e9e" };
}

const ATTENDANCE_OPTIONS = ["ATTENDED", "ABSENT", "EXCUSED", "UNKNOWN"] as const;

const chipSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontSize: "0.75rem",
  fontWeight: 600,
  height: 24,
  borderRadius: "12px",
  flexShrink: 0,
  "& .MuiChip-label": { px: 1, overflow: "visible" },
};

const RSVP_CHIP_WIDTH = 100;
const ATTEND_CHIP_WIDTH = 175;

export default function EventParticipantCard({
  participant,
  organizationId,
  eventId,
  canMarkAttendance,
  onAttendanceUpdated,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!participant.profileImageFileId || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: participant.profileImageFileId! } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });
        if (cancelled || !data) return;
        setAvatarUrl(URL.createObjectURL(data as unknown as Blob));
      } catch {
        // use system avatar
      }
    })();
    return () => { cancelled = true; };
  }, [participant.profileImageFileId, user]);

  const handleAttendanceClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!canMarkAttendance) return;
    setAnchorEl(e.currentTarget);
  };

  const handleSelect = async (status: "UNKNOWN" | "ATTENDED" | "ABSENT" | "EXCUSED") => {
    setAnchorEl(null);
    if (!user || !participant.userId) return;
    try {
      const { error } = await client.POST(
        "/api/v1/organizations/{organizationId}/events/{eventId}/attendance",
        {
          params: { path: { organizationId, eventId } },
          body: { participantUserId: participant.userId, attendanceStatus: status },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      showAlert(String(t("events.attendanceUpdated")), "success");
      onAttendanceUpdated(participant.userId, status);
    } catch {
      showAlert(String(t("events.attendanceUpdateError")), "error");
    }
  };

  const rsvpSt = rsvpStyle(participant.rsvpStatus);
  const attendSt = attendanceStyle(participant.attendanceStatus);

  const rsvpLabel = (() => {
    if (participant.rsvpStatus === "ACCEPTED") return String(t("events.rsvpAccepted"));
    if (participant.rsvpStatus === "DECLINED") return String(t("events.rsvpDeclined"));
    return String(t("events.rsvpPending"));
  })();

  const attendanceLabel = String(t(`events.attendance.${participant.attendanceStatus ?? "UNKNOWN"}`));

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        borderRadius: "50px",
        border: "1px solid #dce6f9",
        backgroundColor: "#ffffff",
        minWidth: 0,
      }}
    >
      <Avatar
        src={avatarUrl ?? undefined}
        sx={{
          width: 32,
          height: 32,
          bgcolor: "#7795de",
          fontSize: "0.85rem",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={() => navigateToUser(participant.userId, undefined, navigate)}
      >
        {!avatarUrl && (participant.name?.[0]?.toUpperCase() ?? "?")}
      </Avatar>

      <Typography
        onClick={() => navigateToUser(participant.userId, undefined, navigate)}
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          fontSize: "0.92rem",
          cursor: "pointer",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
          "&:hover": { textDecoration: "underline" },
        }}
      >
        {participant.name}
      </Typography>


      {/* RSVP status chip */}
      <Chip
        size="small"
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%" }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: rsvpSt.dot, flexShrink: 0 }} />
            {rsvpLabel}
          </Box>
        }
        sx={{
          ...chipSx,
          width: RSVP_CHIP_WIDTH,
          bgcolor: rsvpSt.bg,
          color: rsvpSt.color,
        }}
      />

      {/* Divider between RSVP and Attendance */}
      <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "#dce6f9", flexShrink: 0 }} />

      {/* Attendance status chip — clickable for authorized users */}
      <Chip
        size="small"
        onClick={canMarkAttendance ? handleAttendanceClick : undefined}
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: attendSt.dot, flexShrink: 0 }} />
              {attendanceLabel}
            </Box>
            {canMarkAttendance && (
              <ExpandMoreIcon sx={{ fontSize: "0.9rem", color: attendSt.color, flexShrink: 0 }} />
            )}
          </Box>
        }
        sx={{
          ...chipSx,
          width: ATTEND_CHIP_WIDTH,
          bgcolor: attendSt.bg,
          color: attendSt.color,
          cursor: canMarkAttendance ? "pointer" : "default",
          ...(canMarkAttendance && {
            "&:hover": { filter: "brightness(0.95)" },
          }),
        }}
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 180 } } }}
      >
        {ATTENDANCE_OPTIONS.map((s) => {
          const st = attendanceStyle(s);
          return (
            <MenuItem
              key={s}
              onClick={() => void handleSelect(s)}
              selected={s === participant.attendanceStatus}
              sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", gap: 1 }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: st.dot, flexShrink: 0 }} />
              {t(`events.attendance.${s}`)}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
