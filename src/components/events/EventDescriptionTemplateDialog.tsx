import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";

type EventDescriptionTemplateDTO = components["schemas"]["EventDescriptionTemplateDTO"];
type EventDescriptionTemplateCreateRequestDTO = components["schemas"]["EventDescriptionTemplateCreateRequestDTO"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (template: EventDescriptionTemplateDTO) => void;
  organizationId: number;
  eventType: "REHEARSAL" | "CONCERT" | "OTHER";
  template?: EventDescriptionTemplateDTO;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export default function EventDescriptionTemplateDialog({
  open,
  onClose,
  onSaved,
  organizationId,
  eventType,
  template,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const isEdit = Boolean(template);

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [content, setContent] = useState("");
  const [contentError, setContentError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(template?.title ?? "");
      setContent(template?.content ?? "");
      setTitleError("");
      setContentError("");
      setSubmitting(false);
    }
  }, [open, template]);

  const handleSubmit = async () => {
    let valid = true;
    if (!title.trim()) {
      setTitleError(t("events.templates.dialog.titleField") + " — " + t("auth.errors.nameRequired"));
      valid = false;
    }
    if (!content.trim()) {
      setContentError(t("events.templates.dialog.contentField") + " — " + t("auth.errors.nameRequired"));
      valid = false;
    }
    if (!valid || !user) return;

    setSubmitting(true);
    try {
      const body: EventDescriptionTemplateCreateRequestDTO = {
        title: title.trim(),
        content: content.trim(),
        eventType,
      };

      if (isEdit && template?.id != null) {
        const putFn = client.PUT as unknown as (
          path: "/api/v1/organizations/{organizationId}/event-templates/{templateId}",
          init: {
            params: { path: { organizationId: number; templateId: number } };
            body: EventDescriptionTemplateCreateRequestDTO;
            headers: { Authorization: string };
          }
        ) => Promise<{ data?: unknown; error?: unknown }>;

        const { data, error } = await putFn(
          "/api/v1/organizations/{organizationId}/event-templates/{templateId}",
          {
            params: { path: { organizationId, templateId: template.id } },
            body,
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (error) throw error;
        showAlert(t("events.templates.updateSuccess"), "success");
        onSaved(data as EventDescriptionTemplateDTO);
      } else {
        const { data, error } = await client.POST(
          "/api/v1/organizations/{organizationId}/event-templates",
          {
            params: { path: { organizationId } },
            body,
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (error) throw error;
        showAlert(t("events.templates.createSuccess"), "success");
        onSaved(data as unknown as EventDescriptionTemplateDTO);
      }

      onClose();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700 }}>
        {isEdit ? t("events.templates.edit") : t("events.templates.create")}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
          <TextField
            label={t("events.templates.dialog.titleField")}
            required
            fullWidth
            value={title}
            onChange={(e) => {
              setTitle(e.target.value.slice(0, 255));
              if (e.target.value.trim()) setTitleError("");
            }}
            error={Boolean(titleError)}
            helperText={titleError || `${title.length}/255`}
            slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
          />

          <TextField
            label={t("events.templates.dialog.contentField")}
            required
            fullWidth
            multiline
            minRows={5}
            value={content}
            onChange={(e) => {
              setContent(e.target.value.slice(0, 5000));
              if (e.target.value.trim()) setContentError("");
            }}
            error={Boolean(contentError)}
            helperText={contentError || `${content.length}/5000`}
            slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => { void handleSubmit(); }}
          disabled={submitting}
          sx={{
            textTransform: "none",
            fontFamily: "Century Gothic, sans-serif",
            backgroundColor: "#0f3eb5",
            "&:hover": { backgroundColor: "#0c32a0" },
          }}
        >
          {submitting
            ? <CircularProgress size={18} sx={{ color: "#fff" }} />
            : isEdit ? t("events.templates.edit") : t("events.templates.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
