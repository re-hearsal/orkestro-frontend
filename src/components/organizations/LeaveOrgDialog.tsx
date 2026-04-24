import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface LeaveOrgDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLeader: boolean;
}

export default function LeaveOrgDialog({
  open,
  onClose,
  onConfirm,
  isLeader,
}: LeaveOrgDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontWeight: 700 }}>
        {t("organizations.leaveDialog.title")}
      </DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5" }}>
          {isLeader
            ? t("organizations.leaveDialog.leaderWarning")
            : t("organizations.leaveDialog.confirmText")}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            color: "#0f3eb5",
          }}
        >
          {t("organizations.leaveDialog.cancel")}
        </Button>

        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            borderRadius: "8px",
          }}
        >
          {t("organizations.leaveDialog.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
