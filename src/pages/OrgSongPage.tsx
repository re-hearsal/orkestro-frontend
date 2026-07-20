import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import i18n from "../i18n";
import type { components } from "../api/schema";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import InstrumentationSection from "../components/repertoire/InstrumentationSection";
import SongFileSection from "../components/repertoire/SongFileSection";
import { emitSongDeleted, onSongDeleted } from "../utils/songEvents";

type SongDTO = components["schemas"]["SongDTO"];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function normalizeExternalUrl(value?: string | null): string | null {
  if (!value) {return null;}
  const trimmed = value.trim();
  if (!trimmed) {return null;}
  if (/^https?:\/\//i.test(trimmed)) {return trimmed;}
  if (trimmed.startsWith("//")) {return `https:${trimmed}`;}
  return `https://${trimmed}`;
}

export default function OrgSongPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrgId, songId: rawSongId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const songId = useMemo(() => Number(rawSongId), [rawSongId]);
  const isValid = Number.isFinite(organizationId) && organizationId > 0 && Number.isFinite(songId) && songId > 0;

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { permissions } = useOrgMemberContext(isValid ? organizationId : 0);
  const canEditSong = permissions.has("REPERTOIRE_EDIT_SONG");
  const canManageTags = permissions.has("REPERTOIRE_MANAGE_TAGS");
  const canManageInstrumentation = permissions.has("REPERTOIRE_MANAGE_INSTRUMENTATION");
  const canManageFiles = permissions.has("REPERTOIRE_MANAGE_FILES");
  const canDeleteSong = permissions.has("REPERTOIRE_DELETE_SONG");

  const [song, setSong] = useState<SongDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Tag menu
  const [tagMenuAnchor, setTagMenuAnchor] = useState<HTMLElement | null>(null);
  const [tagMenuTarget, setTagMenuTarget] = useState<string | null>(null);

  // Add tag inline
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [tagSaving, setTagSaving] = useState(false);

  // Edit song dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editComposer, setEditComposer] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editTitleError, setEditTitleError] = useState("");

  // Delete song dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSong, setDeletingSong] = useState(false);

  // Sync current organization
  useEffect(() => {
    if (!isValid) {return;}
    if (currentOrganization?.id === organizationId) {return;}
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) {setCurrentOrganization(matched);}
  }, [currentOrganization?.id, isValid, organizationId, organizations, setCurrentOrganization]);

  const loadSong = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !isValid) {return;}
    const isSilent = options?.silent === true;
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}",
        {
          params: { path: { organizationId, songId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          showAlert(String(i18n.t("repertoire.songNotFound")), "error");
          navigate(`/organizations/${organizationId}/repertoire`);
          return;
        }
        throw error;
      }
      setSong(data as unknown as SongDTO);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [isValid, navigate, organizationId, showAlert, songId, user]);

  useEffect(() => {
    void loadSong();
  }, [loadSong]);

  useEffect(() => {
    const unsubscribe = onSongDeleted((detail) => {
      if (detail.organizationId !== organizationId || detail.songId !== songId) {
        return;
      }
      if (deletingSong) {
        return;
      }

      showAlert(String(t("repertoire.songDeleted")), "warning");
      navigate(`/organizations/${organizationId}/repertoire`);
    });

    return unsubscribe;
  }, [deletingSong, navigate, organizationId, showAlert, songId, t]);

  // ── Tag handlers ──────────────────────────────────────────────────────────

  const handleTagClick = (event: React.MouseEvent<HTMLElement>, tag: string) => {
    if (!canManageTags) {return;}
    setTagMenuAnchor(event.currentTarget);
    setTagMenuTarget(tag);
  };

  const handleDeleteTag = async () => {
    if (!song || !tagMenuTarget || !user) {return;}
    setTagMenuAnchor(null);
    const updatedTags = (song.tags ?? []).filter((t) => t !== tagMenuTarget);
    setTagSaving(true);
    try {
      const { data, error } = await client.PUT(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}",
        {
          params: { path: { organizationId, songId } },
          body: { tags: updatedTags },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      setSong(data as unknown as SongDTO);
      showAlert(String(t("repertoire.tagDeleted")), "success");
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setTagSaving(false);
      setTagMenuTarget(null);
    }
  };

  const MAX_TAGS = 5;

  const handleAddTag = async () => {
    const trimmed = newTagValue.trim().slice(0, 20);
    if (!trimmed || !song || !user) {return;}
    const currentTags = song.tags ?? [];
    if (currentTags.includes(trimmed) || currentTags.length >= MAX_TAGS) {
      setAddTagOpen(false);
      setNewTagValue("");
      return;
    }
    setTagSaving(true);
    try {
      const { data, error } = await client.PUT(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}",
        {
          params: { path: { organizationId, songId } },
          body: { tags: [...(song.tags ?? []), trimmed] },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      setSong(data as unknown as SongDTO);
      showAlert(String(t("repertoire.tagAdded")), "success");
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setTagSaving(false);
      setAddTagOpen(false);
      setNewTagValue("");
    }
  };

  // ── Edit song dialog ──────────────────────────────────────────────────────

  const openEditDialog = () => {
    if (!song) {return;}
    setEditTitle(song.title ?? "");
    setEditComposer(song.composer ?? "");
    setEditDuration(song.durationSeconds != null ? String(song.durationSeconds) : "");
    setEditDescription(song.description ?? "");
    setEditVideoUrl(song.videoUrl ?? "");
    setEditTitleError("");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setEditTitleError(String(t("repertoire.titleRequired")));
      return;
    }
    if (!user) {return;}
    setEditSaving(true);
    try {
      const body: components["schemas"]["SongUpdateRequestDTO"] = {
        title: editTitle.trim(),
      };
      if (editComposer.trim() !== (song?.composer ?? "")) {
        body.composer = editComposer.trim();
      }
      if (editDuration !== (song?.durationSeconds != null ? String(song.durationSeconds) : "")) {
        body.durationSeconds = editDuration ? Number(editDuration) : undefined;
      }
      if (editDescription.trim() !== (song?.description ?? "")) {
        body.description = editDescription.trim();
      }
      const normalizedVideo = normalizeExternalUrl(editVideoUrl) ?? "";
      if (normalizedVideo !== (song?.videoUrl ?? "")) {
        body.videoUrl = normalizedVideo || undefined;
      }
      const { data, error } = await client.PUT(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}",
        {
          params: { path: { organizationId, songId } },
          body,
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      setSong(data as unknown as SongDTO);
      showAlert(String(t("repertoire.saveChanges")), "success");
      setEditOpen(false);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!user) {return;}

    setDeletingSong(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}",
        {
          params: { path: { organizationId, songId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}

      showAlert(String(t("repertoire.songDeleted")), "success");
      emitSongDeleted({ organizationId, songId });
      navigate(`/organizations/${organizationId}/repertoire`);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setDeletingSong(false);
      setDeleteOpen(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (!song) {return null;}

  const songVideoUrl = normalizeExternalUrl(song.videoUrl);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>
      {canEditSong && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <Button
            variant="outlined"
            onClick={openEditDialog}
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": {
                borderColor: "#0f3eb5",
                backgroundColor: "rgba(15,62,181,0.08)",
              },
            }}
          >
            {t("repertoire.editSong")}
          </Button>
        </Box>
      )}

      <Box
        sx={{
          border: "1px solid #dce6f9",
          borderRadius: "12px",
          background: "#fff",
          p: { xs: 2, sm: 3 },
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  fontFamily: "Century Gothic, sans-serif",
                  color: "#0f3eb5",
                  wordBreak: "break-word",
                  fontSize: { xs: "1.8rem", sm: "2.1rem" },
                }}
              >
                {song.title}
              </Typography>

              {song.durationSeconds != null && (
                <Typography
                  sx={{
                    color: "#7795de",
                    fontSize: "0.95rem",
                    fontFamily: "Century Gothic, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDuration(song.durationSeconds)}
                </Typography>
              )}

              {songVideoUrl && (
                <Tooltip title={songVideoUrl}>
                  <IconButton
                    component="a"
                    href={songVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    sx={{ color: "#0f3eb5" }}
                  >
                    <SmartDisplayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        {song.composer && (
          <Typography
            variant="subtitle1"
            sx={{ color: "#7795de", fontFamily: "Century Gothic, sans-serif", mb: 1.5 }}
          >
            {song.composer}
          </Typography>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
          {(song.tags ?? []).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              variant="outlined"
              onClick={canManageTags ? (e) => handleTagClick(e, tag) : undefined}
              sx={{
                cursor: canManageTags ? "pointer" : "default",
                borderColor: "#7795de",
                color: "#1a2f63",
                fontFamily: "Century Gothic, sans-serif",
              }}
              disabled={tagSaving}
            />
          ))}

          {canManageTags && !addTagOpen && (song.tags ?? []).length < MAX_TAGS && (
            <Chip
              icon={<AddIcon />}
              label={t("repertoire.addTag")}
              variant="outlined"
              onClick={() => setAddTagOpen(true)}
              sx={{
                cursor: "pointer",
                borderStyle: "dashed",
                borderColor: "#0f3eb5",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
              }}
            />
          )}

          {canManageTags && addTagOpen && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
              <TextField
                size="small"
                autoFocus
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {void handleAddTag();}
                  if (e.key === "Escape") {
                    setAddTagOpen(false);
                    setNewTagValue("");
                  }
                }}
                sx={{ width: 180 }}
                slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif", fontSize: "0.875rem" } } }}
              />
              <Button
                size="small"
                variant="contained"
                onClick={() => void handleAddTag()}
                disabled={tagSaving || !newTagValue.trim()}
                sx={{
                  background: "#0f3eb5",
                  textTransform: "none",
                  fontFamily: "Century Gothic, sans-serif",
                  "&:hover": { background: "#0c34a0" },
                }}
              >
                OK
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setAddTagOpen(false);
                  setNewTagValue("");
                }}
                sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}
              >
                {t("common.cancel")}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Tag context menu */}
      <Menu
        anchorEl={tagMenuAnchor}
        open={Boolean(tagMenuAnchor)}
        onClose={() => { setTagMenuAnchor(null); setTagMenuTarget(null); }}
      >
        <MenuItem onClick={() => void handleDeleteTag()} sx={{ color: "error.main" }}>
          {t("repertoire.deleteTag")}
        </MenuItem>
      </Menu>

      {song.description && (
        <Box
          sx={{
            mb: 2,
            border: "1px solid #dce6f9",
            borderRadius: "12px",
            background: "#fff",
            p: { xs: 2, sm: 3 },
          }}
        >
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
              fontSize: "1.1rem",
              mb: 0.5,
            }}
          >
            {t("repertoire.description")}
          </Typography>
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "#1a2f63",
              fontSize: "0.96rem",
              lineHeight: 1.45,
            }}
          >
            {song.description}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          mb: 2,
          border: "1px solid #dce6f9",
          borderRadius: "12px",
          background: "#fff",
          p: { xs: 2, sm: 3 },
        }}
      >
        <InstrumentationSection
          instrumentation={song.instrumentation ?? []}
          canEdit={canManageInstrumentation}
          organizationId={organizationId}
          songId={songId}
          onUpdate={(updated) => setSong((prev) => prev ? { ...prev, instrumentation: updated } : prev)}
        />
      </Box>

      <Box
        sx={{
          mb: 2,
          border: "1px solid #dce6f9",
          borderRadius: "12px",
          background: "#fff",
          p: { xs: 2, sm: 3 },
        }}
      >
        <SongFileSection
          fileIds={song.fileIds ?? []}
          canManage={canManageFiles}
          organizationId={organizationId}
          songId={songId}
          onUpdate={() => {
            void loadSong({ silent: true });
          }}
        />
      </Box>

      {canDeleteSong && (
        <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1, mb: 2 }}>
          <Button
            color="error"
            variant="outlined"
            onClick={() => setDeleteOpen(true)}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
            }}
          >
            {t("repertoire.deleteSong")}
          </Button>
        </Box>
      )}

      {/* Edit song dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreen} slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}>
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}>
          {t("repertoire.editSong")}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
            <TextField
              label={t("repertoire.fieldTitle")}
              required
              fullWidth
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value.slice(0, 255));
                if (e.target.value.trim()) {setEditTitleError("");}
              }}
              error={Boolean(editTitleError)}
              helperText={editTitleError || `${editTitle.length}/255`}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />
            <TextField
              label={t("repertoire.fieldComposer")}
              fullWidth
              value={editComposer}
              onChange={(e) => setEditComposer(e.target.value.slice(0, 255))}
              helperText={`${editComposer.length}/255`}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />
            <TextField
              label={t("repertoire.fieldDuration")}
              type="number"
              fullWidth
              value={editDuration}
              onChange={(e) => setEditDuration(e.target.value)}
              slotProps={{
                input: { inputProps: { min: 1, step: 1 }, sx: { fontFamily: "Century Gothic, sans-serif" } },
              }}
            />
            <TextField
              label={t("repertoire.fieldDescription")}
              fullWidth
              multiline
              minRows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, 3000))}
              helperText={`${editDescription.length}/3000`}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />
            <TextField
              label={t("repertoire.fieldVideoUrl")}
              fullWidth
              value={editVideoUrl}
              onChange={(e) => setEditVideoUrl(e.target.value.slice(0, 2048))}
              slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
            />
          </Box>
        </DialogContent>
        <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setEditOpen(false)}
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
            onClick={() => void handleSaveEdit()}
            disabled={editSaving}
            sx={{
              borderRadius: "8px",
              backgroundColor: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
              "&:hover": { backgroundColor: "#0c32a0" },
            }}
          >
            {editSaving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("repertoire.saveChanges")}
          </Button>
        </Box>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          if (!deletingSong) {
            setDeleteOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "error.main" }}>
          {t("repertoire.deleteSong")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("repertoire.confirmDeleteSong")}
          </Typography>
        </DialogContent>
        <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteOpen(false)}
            disabled={deletingSong}
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
            color="error"
            variant="outlined"
            onClick={() => void handleDeleteSong()}
            disabled={deletingSong}
            sx={{
              borderRadius: "8px",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
            }}
          >
            {deletingSong ? <CircularProgress size={18} /> : t("repertoire.deleteSong")}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
