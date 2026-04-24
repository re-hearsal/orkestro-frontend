import { useEffect, useState } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import Button from "@mui/material/Button";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

interface OrgInviteLinkProps {
  organizationId: number;
  permissions: Set<string>;
}

export default function OrgInviteLink({ organizationId, permissions }: OrgInviteLinkProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canEdit = permissions.has("ORG_EDIT");

  useEffect(() => {
    if (!canEdit || !user) return;

    let cancelled = false;

    const load = async () => {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/invite",
        {
          parseAs: "text",
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (!cancelled && !error && data != null) {
        setCode(data as unknown as string);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canEdit, organizationId, user]);

  if (!canEdit) return null;

  const baseUrl = import.meta.env.VITE_APP_BASE_URL ?? window.location.origin;
  const inviteUrl = `${baseUrl}/join?code=${code ?? ""}`;

  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = async () => {
    if (!user) return;

    setRegenerating(true);
    try {
      const { data } = await client.POST(
        "/api/v1/organizations/{organizationId}/invite/regenerate",
        {
          parseAs: "text",
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (data != null) {
        setCode(data as unknown as string);
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          borderRadius: "50px",
          border: "1px solid #7795de",
          backgroundColor: "#ffffff",
          px: 1.5,
          py: 0.85,
          minHeight: 57,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          width: "100%",
        }}
      >
        <LinkIcon sx={{ color: "#7795de", fontSize: 20 }} />

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontSize: "0.92rem",
            fontWeight: 700,
            color: "#0f3eb5",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {t("organizations.invite.inviteFriends")}
        </Typography>

        <Tooltip title={copied ? t("organizations.invite.copied") : t("organizations.invite.copyButton") as string}>
          <span>
            <IconButton
              size="small"
              onClick={handleCopy}
              disabled={!code}
              aria-label={String(t("organizations.invite.copyButton"))}
              sx={{ color: copied ? "#2e7d32" : "#0f3eb5" }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t("organizations.invite.regenerateButton") as string}>
          <span>
            <IconButton
              size="small"
              onClick={() => setConfirmOpen(true)}
              disabled={regenerating}
              aria-label={String(t("organizations.invite.regenerateButton"))}
              sx={{ color: "#7795de" }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!regenerating) {
            setConfirmOpen(false);
          }
        }}
        slotProps={{ paper: { sx: { borderRadius: "32px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontWeight: 700 }}>
          {t("organizations.invite.regenerateButton")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de" }}>
            {t("organizations.invite.regenerateConfirm")}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={regenerating}
            sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif" }}
          >
            {t("organizations.leaveDialog.cancel")}
          </Button>
          <Button
            onClick={() => {
              setConfirmOpen(false);
              void handleRegenerate();
            }}
            disabled={regenerating}
            variant="outlined"
            sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", borderRadius: "8px" }}
          >
            {t("organizations.invite.regenerateButton")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
