import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

interface LeaveSectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export default function LeaveSectionDialog({ open, onClose, onConfirm, loading = false }: LeaveSectionDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={() => { if (!loading) {onClose();} }}
      maxWidth="xs"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
    >
      <DialogTitle sx={{ color: "error.main", fontFamily: "Century Gothic, sans-serif", fontWeight: 700 }}>
        {t("sections.leaveSection")}
      </DialogTitle>
      <DialogContent sx={{ overflowY: 'auto' }}>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
          {t("sections.confirmLeaveSection")}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, '& > *': { m: '0 !important' } }}>
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
