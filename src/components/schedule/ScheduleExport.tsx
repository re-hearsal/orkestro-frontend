import { useState } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import client, { type UnsafeApiMethod } from "../../api/client";

const labelSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "#0f3eb5",
  mb: 1.5,
};

const blockSx = {
  border: "1px solid #dce6f9",
  borderRadius: "10px",
  p: 1.5,
};

const btnSx = {
  fontFamily: "Century Gothic, sans-serif",
  borderColor: "#0f3eb5",
  color: "#0f3eb5",
  "&:hover": { borderColor: "#0c32a0", color: "#0c32a0" },
};

export default function ScheduleExport() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingIcal, setLoadingIcal] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    if (!user) {return;}
    setLoadingCsv(true);
    try {
      const { data, error } = await (client.GET as UnsafeApiMethod)(
        "/api/v1/events/exports/schedule.csv",
        {
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        }
      );
      if (error) {throw error;}
      downloadBlob(data as Blob, "schedule.csv");
    } catch {
      showAlert(t("schedule.exportError"), "error");
    } finally {
      setLoadingCsv(false);
    }
  };

  const handleExportIcal = async () => {
    if (!user) {return;}
    setLoadingIcal(true);
    try {
      const { data, error } = await (client.GET as UnsafeApiMethod)(
        "/api/v1/events/exports/schedule.ics",
        {
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        }
      );
      if (error) {throw error;}
      downloadBlob(data as Blob, "schedule.ics");
    } catch {
      showAlert(t("schedule.exportError"), "error");
    } finally {
      setLoadingIcal(false);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography sx={labelSx}>{t("schedule.export")}</Typography>
      <Box sx={blockSx}>
        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            sx={btnSx}
            disabled={loadingCsv}
            startIcon={loadingCsv ? <CircularProgress size={16} sx={{ color: "#0f3eb5" }} /> : undefined}
            onClick={() => void handleExportCsv()}
          >
            {t("schedule.exportCsv")}
          </Button>
          <Button
            variant="outlined"
            sx={btnSx}
            disabled={loadingIcal}
            startIcon={loadingIcal ? <CircularProgress size={16} sx={{ color: "#0f3eb5" }} /> : undefined}
            onClick={() => void handleExportIcal()}
          >
            {t("schedule.exportIcal")}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
