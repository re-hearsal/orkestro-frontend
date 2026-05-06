import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

export default function ChangePasswordDialog({ open, onClose, username }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const confirmMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleClose = () => {
    if (saving) return;
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  const handleSave = async () => {
    if (!user || !isValid) return;
    setSaving(true);
    try {
      const { error } = await client.POST("/api/v1/auth/password/reset", {
        headers: { Authorization: `Bearer ${user.token}` },
        body: { username, newPassword },
      });
      if (error) throw error;
      showAlert(t("profile.security.passwordChanged"), "success");
      handleClose();
    } catch {
      showAlert(t("profile.security.passwordChangeError"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", pr: 6 }}>
        {t("profile.security.changePassword")}
        <IconButton
          onClick={handleClose}
          disabled={saving}
          sx={{ position: "absolute", right: 12, top: 12, color: "#7795de" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label={t("profile.security.newPassword")}
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            size="small"
            error={newPassword.length > 0 && newPassword.length < 8}
            helperText={newPassword.length > 0 && newPassword.length < 8 ? t("auth.errors.passwordMinLength") : ""}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowNew((v) => !v)} edge="end">
                      {showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label={t("profile.security.confirmPassword")}
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            size="small"
            error={confirmMismatch}
            helperText={confirmMismatch ? t("profile.security.passwordMismatch") : ""}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowConfirm((v) => !v)} edge="end">
                      {showConfirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>
      </DialogContent>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={saving}
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
          onClick={() => void handleSave()}
          disabled={saving || !isValid}
          sx={{
            borderRadius: "8px",
            backgroundColor: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            "&:hover": { backgroundColor: "#0c32a0" },
          }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("profile.save")}
        </Button>
      </Box>
    </Dialog>
  );
}
