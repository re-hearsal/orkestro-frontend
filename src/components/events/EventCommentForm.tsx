import { useState } from "react";
import { Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";

interface Props {
  organizationId: number;
  eventId: number;
  onCreated: () => void;
  onCancel: () => void;
}

export default function EventCommentForm({ organizationId, eventId, onCreated, onCancel }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const [text, setText] = useState("");
  const [rating, setRating] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !text.trim()) {return;}
    setSaving(true);
    try {
      const ratingNum = rating !== "" ? Number(rating) : undefined;
      const { error } = await client.POST(
        "/api/v1/organizations/{organizationId}/events/{eventId}/comments",
        {
          params: { path: { organizationId, eventId } },
          body: { text: text.trim(), rating: ratingNum },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      showAlert(String(t("events.commentCreated")), "success");
      onCreated();
    } catch {
      showAlert(String(t("events.commentCreateError")), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        border: "1px solid #dce6f9",
        borderRadius: "12px",
        p: 2,
        backgroundColor: "#ffffff",
        mt: 1.5,
      }}
    >
      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          fontSize: "1rem",
          mb: 1.5,
        }}
      >
        {t("events.writeComment")}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          label={t("events.commentRating")}
          type="number"
          size="small"
          value={rating}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") { setRating(""); return; }
            const n = Number(val);
            if (n >= 0 && n <= 10) {setRating(val);}
          }}
          slotProps={{ input: { inputProps: { min: 0, max: 10, step: 1 }, sx: { fontFamily: "Century Gothic, sans-serif" } } }}
          sx={{ maxWidth: 140 }}
        />
        <TextField
          label={t("events.commentText")}
          multiline
          minRows={3}
          fullWidth
          size="small"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 3000))}
          helperText={`${text.length}/3000`}
          slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
        />

        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={saving}
            sx={{
              borderRadius: "8px",
              borderColor: "#7795de",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={saving || !text.trim()}
            sx={{
              borderRadius: "8px",
              backgroundColor: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
              "&:hover": { backgroundColor: "#0c32a0" },
            }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("events.commentSubmit")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
