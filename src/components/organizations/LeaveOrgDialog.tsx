import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
    >
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontWeight: 700 }}>
        {t("organizations.leaveDialog.title")}
      </DialogTitle>

      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5" }}>
          {isLeader
            ? t("organizations.leaveDialog.leaderWarning")
            : t("organizations.leaveDialog.confirmText")}
        </Typography>
      </DialogContent>

      <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderRadius: "8px",
            borderColor: "#7795de",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
          }}
        >
          {t("organizations.leaveDialog.cancel")}
        </Button>

        <Button
          onClick={onConfirm}
          color="error"
          variant="outlined"
          sx={{
            borderRadius: "8px",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
          }}
        >
          {t("organizations.leaveDialog.confirm")}
        </Button>
      </Box>
    </Dialog>
  );
}
