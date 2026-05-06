import { useState } from "react";
import { Box, Button, CircularProgress, Menu, MenuItem, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircle";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HelpOutlineIcon from "@mui/icons-material/Help";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";

type RsvpStatus = "PENDING" | "ACCEPTED" | "DECLINED";

interface Props {
  organizationId: number;
  eventId: number;
  initialStatus?: RsvpStatus;
}

function getStatusColor(status?: RsvpStatus): string {
  if (status === "ACCEPTED") return "#2e7d32";
  if (status === "DECLINED") return "#d32f2f";
  return "#9e9e9e";
}

function StatusIcon({ status }: { status?: RsvpStatus }) {
  if (status === "ACCEPTED") return <CheckCircleOutlineIcon sx={{ fontSize: 28 }} />;
  if (status === "DECLINED") return <CancelOutlinedIcon sx={{ fontSize: 28 }} />;
  return <HelpOutlineIcon sx={{ fontSize: 28 }} />;
}

function getStatusLabel(status: RsvpStatus | undefined, t: (k: string) => string): string {
  if (status === "ACCEPTED") return t("events.rsvpAccepted");
  if (status === "DECLINED") return t("events.rsvpDeclined");
  return t("events.rsvpPending");
}

export default function EventRsvpButton({ organizationId, eventId, initialStatus }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const [status, setStatus] = useState<RsvpStatus | undefined>(initialStatus);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (newStatus: RsvpStatus) => {
    setAnchor(null);
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await client.PUT(
        "/api/v1/organizations/{organizationId}/events/{eventId}/rsvp",
        {
          params: { path: { organizationId, eventId } },
          body: { rsvpStatus: newStatus },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      setStatus(newStatus);
      showAlert(String(t("events.rsvpUpdated")), "success");
    } catch {
      showAlert(String(t("events.rsvpUpdateError")), "error");
    } finally {
      setSaving(false);
    }
  };

  const color = getStatusColor(status);

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={saving}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.5,
          py: 0.75,
          borderRadius: "8px",
          border: `1.5px solid ${color}`,
          color,
          textTransform: "none",
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 600,
          fontSize: "0.85rem",
          backgroundColor: "transparent",
          flexShrink: 0,
          "&:hover": { backgroundColor: `${color}14` },
        }}
      >
        {saving ? (
          <CircularProgress size={20} sx={{ color }} />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <StatusIcon status={status} />
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 600, fontSize: "0.85rem", color, lineHeight: 1 }}>
              {getStatusLabel(status, (k) => String(t(k)))}
            </Typography>
          </Box>
        )}
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => void handleSelect("ACCEPTED")}
          sx={{ color: "#2e7d32", fontFamily: "Century Gothic, sans-serif" }}
        >
          <CheckCircleOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t("events.rsvpAccepted")}
        </MenuItem>
        <MenuItem
          onClick={() => void handleSelect("DECLINED")}
          sx={{ color: "#d32f2f", fontFamily: "Century Gothic, sans-serif" }}
        >
          <CancelOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          {t("events.rsvpDeclined")}
        </MenuItem>
        <MenuItem
          onClick={() => void handleSelect("PENDING")}
          sx={{ color: "#9e9e9e", fontFamily: "Century Gothic, sans-serif" }}
        >
          <HelpOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t("events.rsvpPending")}
        </MenuItem>
      </Menu>
    </>
  );
}
