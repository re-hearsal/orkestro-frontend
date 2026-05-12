import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [deleting, setDeleting] = useState(false);

  const handleClose = () => {
    if (deleting) return;
    onClose();
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { error } = await client.DELETE("/api/v1/auth/account", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (error) throw error;
      logout();
    } catch {
      showAlert(t("profile.security.deleteAccountError"), "error");
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
    >
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#c0392b", pr: 6 }}>
        {t("profile.security.deleteAccount")}
        <IconButton
          onClick={handleClose}
          disabled={deleting}
          sx={{ position: "absolute", right: 12, top: 12, color: "#7795de", minWidth: 44, minHeight: 44 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto' }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 1 }}>
          <WarningAmberIcon sx={{ color: "#e67e22", fontSize: 48 }} />
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              color: "#0f3eb5",
              fontSize: "0.95rem",
              textAlign: "center",
            }}
          >
            {t("profile.security.deleteAccountConfirm")}
          </Typography>
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              color: "#c0392b",
              fontSize: "0.85rem",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {t("profile.security.deleteAccountWarning")}
          </Typography>
        </Box>
      </DialogContent>

      <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={deleting}
          sx={{
            borderRadius: "8px",
            borderColor: "#7795de",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
          }}
        >
          {t("profile.cancel")}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void handleDelete()}
          disabled={deleting}
          sx={{
            borderRadius: "8px",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
          }}
        >
          {deleting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("profile.security.deleteAccountConfirmButton")}
        </Button>
      </Box>
    </Dialog>
  );
}
