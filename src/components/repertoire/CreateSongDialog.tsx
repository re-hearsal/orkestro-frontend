import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";
import { instrumentI18nKey } from "../profile/InstrumentPicker";

type InstrumentDTO = components["schemas"]["InstrumentDTO"];
type SongDTO = components["schemas"]["SongDTO"];

interface InstrumentationItem {
  instrumentId: number;
  name: string;
  count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  onCreated: (songId: number) => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  return String(error);
}

function normalizeExternalUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export default function CreateSongDialog({ open, onClose, organizationId, onCreated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const createSongMultipart = client.POST as unknown as (
    path: "/api/v1/organizations/{organizationId}/repertoire/songs",
    init: {
      params: { path: { organizationId: number } };
      body: FormData;
      headers: { Authorization: string };
      bodySerializer: (body: FormData) => FormData;
    }
  ) => Promise<{ data?: SongDTO; error?: unknown }>;

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [titleError, setTitleError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [durationError, setDurationError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [videoUrlError, setVideoUrlError] = useState("");

  // Step 2 fields
  const [instruments, setInstruments] = useState<InstrumentDTO[]>([]);
  const [instrumentation, setInstrumentation] = useState<InstrumentationItem[]>([]);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [instrError, setInstrError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load instruments on step 2
  useEffect(() => {
    if (step !== 2 || !user) return;
    void (async () => {
      const { data } = await client.GET("/api/v1/instruments", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setInstruments((data as unknown as InstrumentDTO[]) ?? []);
    })();
  }, [step, user]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setTitle("");
      setComposer("");
      setDurationSeconds("");
      setDescription("");
      setVideoUrl("");
      setTagInput("");
      setTags([]);
      setTitleError("");
      setComposerError("");
      setDurationError("");
      setDescriptionError("");
      setVideoUrlError("");
      setInstrumentation([]);
      setAutocompleteKey((k) => k + 1);
      setInstrError("");
      setSubmitting(false);
    }
  }, [open]);

  const MAX_TAGS = 5;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().slice(0, 20);
    if (!trimmed || tags.includes(trimmed) || tags.length >= MAX_TAGS) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const validateStep1 = (): boolean => {
    let valid = true;

    if (!title.trim()) {
      setTitleError(String(t("repertoire.titleRequired")));
      valid = false;
    } else {
      setTitleError("");
    }

    if (composer && !composer.trim()) {
      setComposerError(String(t("repertoire.fieldWhitespaceOnly")));
      valid = false;
    } else {
      setComposerError("");
    }

    if (durationSeconds !== "" && (isNaN(Number(durationSeconds)) || Number(durationSeconds) < 1)) {
      setDurationError(String(t("repertoire.durationMin")));
      valid = false;
    } else {
      setDurationError("");
    }

    if (description && !description.trim()) {
      setDescriptionError(String(t("repertoire.fieldWhitespaceOnly")));
      valid = false;
    } else {
      setDescriptionError("");
    }

    if (videoUrl && !videoUrl.trim()) {
      setVideoUrlError(String(t("repertoire.fieldWhitespaceOnly")));
      valid = false;
    } else {
      setVideoUrlError("");
    }

    return valid;
  };

  const handleNextStep = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleAddInstrument = (instrument: InstrumentDTO | null) => {
    if (!instrument?.id) return;
    if (instrumentation.some((i) => i.instrumentId === instrument.id)) {
      setAutocompleteKey((k) => k + 1);
      return;
    }
    setInstrumentation((prev) => [
      ...prev,
      { instrumentId: instrument.id!, name: localizedInstrumentName(instrument.name ?? ""), count: 1 },
    ]);
    setAutocompleteKey((k) => k + 1);
    setInstrError("");
  };

  const handleRemoveInstrument = (instrumentId: number) => {
    setInstrumentation((prev) => prev.filter((i) => i.instrumentId !== instrumentId));
  };

  const handleCountChange = (instrumentId: number, value: string) => {
    const count = Math.max(1, parseInt(value, 10) || 1);
    setInstrumentation((prev) =>
      prev.map((i) => (i.instrumentId === instrumentId ? { ...i, count } : i))
    );
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(instrumentation);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    setInstrumentation(items);
  };

  const handleCreate = async () => {
    if (instrumentation.length === 0) {
      setInstrError(String(t("repertoire.instrumentationRequired")));
      return;
    }
    if (instrumentation.some((i) => i.count < 1)) {
      setInstrError(String(t("repertoire.instrumentCountMin")));
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      if (composer.trim()) formData.append("composer", composer.trim());
      if (durationSeconds) formData.append("durationSeconds", durationSeconds);
      if (description.trim()) formData.append("description", description.trim());
      const normalizedVideoUrl = normalizeExternalUrl(videoUrl);
      if (normalizedVideoUrl) formData.append("videoUrl", normalizedVideoUrl);
      tags.forEach((tag) => formData.append("tags", tag));
      instrumentation.forEach((item, index) => {
        formData.append(`instrumentation[${index}].instrumentId`, String(item.instrumentId));
        formData.append(`instrumentation[${index}].count`, String(item.count));
      });

      const { data, error } = await createSongMultipart(
        "/api/v1/organizations/{organizationId}/repertoire/songs",
        {
          params: { path: { organizationId } },
          body: formData,
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
          bodySerializer: (body: FormData) => body,
        }
      );

      if (error) throw error;

      const song = data as unknown as SongDTO;
      onCreated(song.id!);
      onClose();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const localizedInstrumentName = (apiName: string): string => {
    const key = instrumentI18nKey(apiName);
    const translated = t(`organizations.instrumentNames.${key}`);
    return translated === `organizations.instrumentNames.${key}` ? apiName : translated;
  };

  const availableInstruments = instruments.filter(
    (inst) => !instrumentation.some((i) => i.instrumentId === inst.id)
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700 }}>
        {step === 1 ? t("repertoire.createStep1") : t("repertoire.createStep2")}
      </DialogTitle>

      <DialogContent dividers sx={{ overflow: step === 2 ? "visible" : "auto", overflowY: 'auto' }}>
        {step === 1 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
            <TextField
              label={t("repertoire.fieldTitle")}
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
              label={t("repertoire.fieldComposer")}
              fullWidth
              value={composer}
              onChange={(e) => {
                setComposer(e.target.value.slice(0, 255));
                if (composerError && e.target.value.trim()) setComposerError("");
              }}
              error={Boolean(composerError)}
              helperText={composerError || `${composer.length}/255`}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />

            <TextField
              label={t("repertoire.fieldDuration")}
              type="number"
              fullWidth
              value={durationSeconds}
              onChange={(e) => {
                setDurationSeconds(e.target.value);
                if (durationError) setDurationError("");
              }}
              error={Boolean(durationError)}
              helperText={durationError || undefined}
              slotProps={{
                input: { inputProps: { min: 1, step: 1 }, sx: { fontFamily: "Century Gothic, sans-serif" } },
              }}
            />

            <TextField
              label={t("repertoire.fieldDescription")}
              fullWidth
              multiline
              minRows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value.slice(0, 3000));
                if (descriptionError && e.target.value.trim()) setDescriptionError("");
              }}
              error={Boolean(descriptionError)}
              helperText={descriptionError || `${description.length}/3000`}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />

            <TextField
              label={t("repertoire.fieldVideoUrl")}
              fullWidth
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value.slice(0, 2048));
                if (videoUrlError && e.target.value.trim()) setVideoUrlError("");
              }}
              error={Boolean(videoUrlError)}
              helperText={videoUrlError || undefined}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />

            {/* Tags */}
            <Box>
              {tags.length < MAX_TAGS ? (
                <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    label={t("repertoire.fieldTag")}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value.slice(0, 20))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    sx={{ flex: 1 }}
                    slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddTag}
                    sx={{
                      textTransform: "none",
                      fontFamily: "Century Gothic, sans-serif",
                      borderColor: "#0f3eb5",
                      color: "#0f3eb5",
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </Button>
                </Box>
              ) : (
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontFamily: "Century Gothic, sans-serif", display: "block", mb: 1 }}
                >
                  {t("repertoire.maxTagsReached")}
                </Typography>
              )}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ pt: 0.5 }}>
            {/* Autocomplete to add instrument */}
            <Autocomplete
              key={autocompleteKey}
              options={availableInstruments}
              getOptionLabel={(opt) => localizedInstrumentName(opt.name ?? "")}
              onChange={(_, value) => handleAddInstrument(value)}
              blurOnSelect
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("repertoire.addInstrument")}
                  size="small"
                  sx={{ mb: 2 }}
                />
              )}
            />

            {instrError && (
              <Typography color="error" variant="caption" sx={{ mb: 1, display: "block" }}>
                {instrError}
              </Typography>
            )}

            {/* DnD list */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="instrumentation">
                {(provided) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                  >
                    {instrumentation.map((item, index) => (
                      <Draggable
                        key={item.instrumentId}
                        draggableId={String(item.instrumentId)}
                        index={index}
                      >
                        {(provided) => (
                          <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              p: 1,
                              border: "1px solid #dce6f9",
                              borderRadius: "8px",
                              background: "#fff",
                            }}
                          >
                            <Box {...provided.dragHandleProps} sx={{ display: "flex", cursor: "grab" }}>
                              <DragIndicatorIcon sx={{ color: "text.secondary" }} />
                            </Box>

                            <Typography sx={{ flex: 1, fontFamily: "Century Gothic, sans-serif" }}>
                              {item.name}
                            </Typography>

                            <TextField
                              type="number"
                              size="small"
                              value={item.count}
                              onChange={(e) => handleCountChange(item.instrumentId, e.target.value)}
                              sx={{ width: 72 }}
                              slotProps={{
                                input: {
                                  inputProps: { min: 1 },
                                  sx: { fontFamily: "Century Gothic, sans-serif" },
                                },
                              }}
                            />

                            <IconButton
                              size="small"
                              onClick={() => handleRemoveInstrument(item.instrumentId)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, '& > *': { m: '0 !important' } }}>
        {step === 1 ? (
          <>
            <Button
              onClick={onClose}
              sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={handleNextStep}
              sx={{
                textTransform: "none",
                fontFamily: "Century Gothic, sans-serif",
                background: "#0f3eb5",
              }}
            >
              {t("repertoire.next")}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => setStep(1)}
              sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}
            >
              {t("repertoire.back")}
            </Button>
            <Button
              variant="contained"
              onClick={() => { void handleCreate(); }}
              disabled={submitting}
              sx={{
                textTransform: "none",
                fontFamily: "Century Gothic, sans-serif",
                background: "#0f3eb5",
              }}
            >
              {t("repertoire.create")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
