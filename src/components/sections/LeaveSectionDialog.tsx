import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

interface LeaveSectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export default function LeaveSectionDialog({ open, onClose, onConfirm, loading = false }: LeaveSectionDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={() => { if (!loading) onClose(); }}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle sx={{ color: "error.main", fontFamily: "Century Gothic, sans-serif", fontWeight: 700 }}>
        {t("sections.leaveSection")}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
          {t("sections.confirmLeaveSection")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de" }}
        >
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => void onConfirm()}
          disabled={loading}
          color="error"
          variant="outlined"
          sx={{ fontFamily: "Century Gothic, sans-serif", borderRadius: "8px" }}
        >
          {loading ? <CircularProgress size={16} /> : t("sections.leaveSection")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
