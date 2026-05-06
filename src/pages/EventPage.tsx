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
  Pagination,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PeopleIcon from "@mui/icons-material/People";
import EditIcon from "@mui/icons-material/Edit";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { onEventCommentCreated } from "../utils/eventCommentEvents";
import { emitEventDeleted, onEventDeleted } from "../utils/eventDeletedEvents";
import { withFlatPagination } from "../utils/pagination";
import EventRsvpButton from "../components/events/EventRsvpButton";
import EventCommentCard from "../components/events/EventCommentCard";
import EventCommentForm from "../components/events/EventCommentForm";
import EventFileSection from "../components/events/EventFileSection";
import EditEventDialog from "../components/events/EditEventDialog";

type EventDTO = components["schemas"]["EventDTO"];
type EventCommentDTO = components["schemas"]["EventCommentDTO"];
type SectionDTO = components["schemas"]["SectionDTO"];
type SongDTO = components["schemas"]["SongDTO"];

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function formatSetDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}ч ${m}мин`;
  if (h > 0) return `${h}ч`;
  return `${m}мин`;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

const COMMENTS_PAGE_SIZE = 3;
const MAX_TAGS = 5;

export default function EventPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrgId, eventId: rawEventId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const eventId = useMemo(() => Number(rawEventId), [rawEventId]);
  const isValid = Number.isFinite(organizationId) && organizationId > 0 && Number.isFinite(eventId) && eventId > 0;

  const { permissions } = useOrgMemberContext(isValid ? organizationId : 0);
  const canManageEvent = permissions.has("EVENT_MANAGE");
  const canWriteComment = permissions.has("EVENT_WRITE_COMMENT");

  const [event, setEvent] = useState<EventDTO | null>(null);
  const [sections, setSections] = useState<SectionDTO[]>([]);
  const [songs, setSongs] = useState<SongDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Comments
  const [comments, setComments] = useState<EventCommentDTO[]>([]);
  const [commentsPage, setCommentsPage] = useState(0);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);

  // Tags inline edit
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [tagSaving, setTagSaving] = useState(false);

  // Edit event
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Delete event
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync current organization
  useEffect(() => {
    if (!isValid) return;
    if (currentOrganization?.id === organizationId) return;
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) setCurrentOrganization(matched);
  }, [currentOrganization?.id, isValid, organizationId, organizations, setCurrentOrganization]);

  const loadEvent = useCallback(async (silent = false) => {
    if (!user || !isValid) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/events/{eventId}",
        {
          params: { path: { organizationId, eventId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          showAlert(String(t("events.notFound")), "error");
          navigate(`/organizations/${organizationId}/schedule`);
          return;
        }
        throw error;
      }
      const ev = data as unknown as EventDTO;
      setEvent(ev);

      // Load sections for scope display
      if (!sections.length) {
        const { data: sectData } = await client.GET(
          "/api/v1/organizations/{organizationId}/sections",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        setSections((sectData as unknown as SectionDTO[]) ?? []);
      }

      // Load songs
      if ((ev.songIds ?? []).length > 0) {
        const { data: songsData } = await client.GET(
          "/api/v1/organizations/{organizationId}/repertoire/songs/page",
          {
            params: {
              path: { organizationId },
              query: withFlatPagination({}, { page: 0, size: 100 }),
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        const allSongs = ((songsData as unknown as { content?: SongDTO[] })?.content ?? []);
        const songIdSet = new Set(ev.songIds ?? []);
        setSongs(allSongs.filter((s) => s.id != null && songIdSet.has(s.id)));
      } else {
        setSongs([]);
      }
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [eventId, isValid, navigate, organizationId, sections.length, showAlert, t, user]);

  useEffect(() => {
    void loadEvent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, organizationId]);

  const loadComments = useCallback(async (page: number) => {
    if (!user || !isValid) return;
    setCommentsLoading(true);
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/events/{eventId}/comments/page",
        {
          params: {
            path: { organizationId, eventId },
            query: withFlatPagination({}, { page, size: COMMENTS_PAGE_SIZE, sort: ["createdAt,desc"] }),
          },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      const paged = data as unknown as { content?: EventCommentDTO[]; page?: { totalPages?: number } };
      setComments(paged.content ?? []);
      setCommentsTotalPages(paged.page?.totalPages ?? 1);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setCommentsLoading(false);
    }
  }, [eventId, isValid, organizationId, showAlert, user]);

  useEffect(() => {
    void loadComments(commentsPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsPage, eventId, organizationId]);

  // Realtime comment subscription
  useEffect(() => {
    return onEventCommentCreated((detail) => {
      if (detail.organizationId !== organizationId || detail.eventId !== eventId) return;
      setCommentsPage(0);
      void loadComments(0);
    });
  }, [eventId, loadComments, organizationId]);

  // Event deleted subscription
  useEffect(() => {
    return onEventDeleted((detail) => {
      if (detail.organizationId !== organizationId || detail.eventId !== eventId) return;
      if (deleting) return;
      showAlert(String(t("events.eventDeleted")), "warning");
      navigate(`/organizations/${organizationId}/schedule`);
    });
  }, [deleting, eventId, navigate, organizationId, showAlert, t]);

  const updateEventTags = async (tags: string[]): Promise<EventDTO | null> => {
    if (!user) return null;
    const formData = new FormData();
    tags.forEach((tag) => formData.append("tags", tag));
    const { data, error } = await (client.PUT as unknown as (
      path: string,
      init: { params: { path: { organizationId: number; eventId: number } }; body: FormData; headers: { Authorization: string }; bodySerializer: (b: FormData) => FormData }
    ) => Promise<{ data?: unknown; error?: unknown }>)(
      "/api/v1/organizations/{organizationId}/events/{eventId}",
      {
        params: { path: { organizationId, eventId } },
        body: formData,
        headers: { Authorization: `Bearer ${user.token}` },
        bodySerializer: (b: FormData) => b,
      }
    );
    if (error) throw error;
    return data as unknown as EventDTO;
  };

  // Tag handlers
  const handleDeleteTag = async (tag: string) => {
    if (!event || !user) return;
    const updated = (event.tags ?? []).filter((tg) => tg !== tag);
    setTagSaving(true);
    try {
      const ev = await updateEventTags(updated);
      if (ev) setEvent(ev);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setTagSaving(false);
    }
  };

  const handleAddTag = async () => {
    const trimmed = newTagValue.trim().slice(0, 20);
    if (!trimmed || !event || !user) return;
    const current = event.tags ?? [];
    if (current.includes(trimmed) || current.length >= MAX_TAGS) {
      setAddTagOpen(false);
      setNewTagValue("");
      return;
    }
    setTagSaving(true);
    try {
      const ev = await updateEventTags([...current, trimmed]);
      if (ev) setEvent(ev);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setTagSaving(false);
      setAddTagOpen(false);
      setNewTagValue("");
    }
  };

  const handleDeleteEvent = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/events/{eventId}",
        {
          params: { path: { organizationId, eventId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      emitEventDeleted({ organizationId, eventId });
      showAlert(String(t("events.eventDeleted")), "success");
      navigate(`/organizations/${organizationId}/schedule`);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (!event) return null;

  const isCreator = profile?.id != null && event.createdByUserId === profile.id;
  const canEdit = isCreator || canManageEvent;
  const canComment = isCreator || canWriteComment;

  const eventTypeLabel =
    event.eventType === "REHEARSAL"
      ? t("organizations.events.rehearsal")
      : event.eventType === "CONCERT"
      ? t("organizations.events.concert")
      : t("organizations.events.other");

  const totalSetSeconds = songs.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);

  const normalizeUrl = (url?: string | null): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };
  const externalUrl = normalizeUrl(event.externalLink);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>

      {/* Top action bar */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<PeopleIcon />}
          onClick={() => navigate(`/organizations/${organizationId}/events/${eventId}/participants`)}
          sx={{
            borderRadius: "8px",
            borderColor: "#0f3eb5",
            color: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
          }}
        >
          {t("events.participants")}
        </Button>

        {canEdit && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditDialogOpen(true)}
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
            }}
          >
            {t("common.edit")}
          </Button>
        )}
      </Box>

      {/* Main info block */}
      <Box sx={{ border: "1px solid #dce6f9", borderRadius: "12px", backgroundColor: "#ffffff", p: { xs: 2, sm: 3 }, mb: 2 }}>
        {/* Title row */}
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 0.75 }}>
          <Typography
            sx={{ fontWeight: 700, fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", overflowWrap: "break-word", wordBreak: "normal", fontSize: { xs: "1.6rem", sm: "2rem" }, lineHeight: 1.2, flex: "1 1 200px", minWidth: 0 }}
          >
            {event.title}
            {externalUrl && (
              <Tooltip title={externalUrl}>
                <IconButton
                  component="a"
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ color: "#0f3eb5", verticalAlign: "middle", ml: 0.5 }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Typography>

          {event.myRsvpStatus != null && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", color: "#7795de" }}>
                {t("events.myRsvpLabel")}
              </Typography>
              <EventRsvpButton organizationId={organizationId} eventId={eventId} initialStatus={event.myRsvpStatus} />
            </Box>
          )}
        </Box>

        {/* Event type chip */}
        <Box sx={{ mb: 1 }}>
          <Chip
            label={eventTypeLabel}
            size="small"
            sx={{
              borderRadius: "24px",
              border: "1px solid #7795de",
              backgroundColor: "#e8f0ff",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}
          />
        </Box>

        {/* Time */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
          <AccessTimeIcon fontSize="small" sx={{ color: "#7795de" }} />
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontSize: "0.9rem", wordBreak: "break-word" }}>
            {formatDate(event.startTime)} – {formatDate(event.endTime)}
          </Typography>
        </Box>

        {/* Reminder */}
        {(event.remindBeforeMinutes ?? 0) > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
            <NotificationsActiveIcon fontSize="small" sx={{ color: "#7795de" }} />
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.87rem", wordBreak: "break-word" }}>
              {t("events.reminder", { minutes: event.remindBeforeMinutes })}
            </Typography>
          </Box>
        )}

        {/* Location */}
        {event.location && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
            <LocationOnIcon fontSize="small" sx={{ color: "#7795de" }} />
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontSize: "0.9rem", wordBreak: "break-word" }}>
              {event.location}
            </Typography>
          </Box>
        )}

        {/* Scope */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
          {event.includeAllOrganizationMembers ? (
            <Chip
              label={t("schedule.wholeOrganization")}
              size="small"
              sx={{
                backgroundColor: "#e8f0ff",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.72rem",
              }}
            />
          ) : (
            <>
              {(event.participantSectionIds ?? []).map((sid) => {
                const sec = sections.find((s) => s.id === sid);
                return (
                  <Chip
                    key={sid}
                    label={sec?.name ?? `#${sid}`}
                    size="small"
                    onClick={sec ? () => navigate(`/organizations/${organizationId}/sections/${sid}`) : undefined}
                    sx={{
                      backgroundColor: "#e8f0ff",
                      color: "#0f3eb5",
                      fontFamily: "Century Gothic, sans-serif",
                      fontSize: "0.72rem",
                      cursor: sec ? "pointer" : "default",
                    }}
                  />
                );
              })}
              {(event.participantUserIds ?? []).length > 0 && (
                <Chip
                  label={t("events.nParticipants", { count: event.participantUserIds!.length })}
                  size="small"
                  sx={{
                    backgroundColor: "#f0f4ff",
                    color: "#7795de",
                    fontFamily: "Century Gothic, sans-serif",
                    fontSize: "0.72rem",
                  }}
                />
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Tags block */}
      <Box sx={{ border: "1px solid #dce6f9", borderRadius: "12px", backgroundColor: "#ffffff", p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1rem", mr: 0.5 }}>
            {t("events.tagsLabel")}
          </Typography>

          {(event.tags ?? []).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              variant="outlined"
              onDelete={canEdit ? () => void handleDeleteTag(tag) : undefined}
              disabled={tagSaving}
              sx={{
                borderColor: "#7795de",
                color: "#1a2f63",
                fontFamily: "Century Gothic, sans-serif",
              }}
            />
          ))}

          {canEdit && !addTagOpen && (event.tags ?? []).length < MAX_TAGS && (
            <Chip
              icon={<AddIcon />}
              label={t("organizations.events.create.addTagPlaceholder").split(" ")[0]}
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

          {canEdit && addTagOpen && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
              <TextField
                size="small"
                autoFocus
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddTag();
                  if (e.key === "Escape") { setAddTagOpen(false); setNewTagValue(""); }
                }}
                sx={{ width: 160 }}
                slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif", fontSize: "0.875rem" } } }}
              />
              <Button size="small" variant="contained" onClick={() => void handleAddTag()} disabled={tagSaving || !newTagValue.trim()}
                sx={{ background: "#0f3eb5", textTransform: "none", fontFamily: "Century Gothic, sans-serif", "&:hover": { background: "#0c34a0" } }}>
                OK
              </Button>
              <Button size="small" onClick={() => { setAddTagOpen(false); setNewTagValue(""); }}
                sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}>
                {t("common.cancel")}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Description block */}
      <Box sx={{ border: "1px solid #dce6f9", borderRadius: "12px", backgroundColor: "#ffffff", p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.1rem", mb: 0.5 }}>
          {t("events.descriptionLabel")}
        </Typography>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: event.description ? "#1a2f63" : "#7795de",
            fontSize: "0.96rem",
            lineHeight: 1.45,
          }}
        >
          {event.description || t("events.noDescription")}
        </Typography>
      </Box>

      {/* Comments section */}
      <Box sx={{ border: "1px solid #dce6f9", borderRadius: "12px", backgroundColor: "#ffffff", p: { xs: 2, sm: 3 }, mb: 2, mt: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.15rem" }}>
            {t("events.commentsSection")}
          </Typography>
          {canComment && !showCommentForm && (
            <Button
              variant="outlined"
              onClick={() => setShowCommentForm(true)}
              sx={{
                borderRadius: "8px",
                borderColor: "#0f3eb5",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                textTransform: "none",
                "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
              }}
            >
              {t("events.writeComment")}
            </Button>
          )}
        </Box>

        {showCommentForm && (
          <EventCommentForm
            organizationId={organizationId}
            eventId={eventId}
            onCreated={() => {
              setShowCommentForm(false);
              setCommentsPage(0);
              void loadComments(0);
            }}
            onCancel={() => setShowCommentForm(false)}
          />
        )}

        {commentsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} sx={{ color: "#0f3eb5" }} />
          </Box>
        ) : comments.length === 0 && !showCommentForm ? (
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.9rem", py: 2, textAlign: "center" }}>
            {t("events.noComments")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: showCommentForm ? 1.5 : 0 }}>
            {comments.map((comment) => (
              <EventCommentCard
                key={comment.id}
                comment={comment}
                organizationId={organizationId}
                eventId={eventId}
                canDelete={
                  isCreator ||
                  (profile?.id != null && comment.authorUserId === profile.id)
                }
                onDeleted={() => void loadComments(commentsPage)}
              />
            ))}
          </Box>
        )}

        {commentsTotalPages > 1 && !commentsLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={commentsTotalPages}
              page={commentsPage + 1}
              onChange={(_, value) => setCommentsPage(value - 1)}
              color="primary"
            />
          </Box>
        )}
      </Box>

      {/* Songs section */}
      <Box sx={{ border: "1px solid #dce6f9", borderRadius: "12px", backgroundColor: "#ffffff", p: { xs: 2, sm: 3 }, mb: 2, mt: 4 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1 }}>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.1rem" }}>
            {t("events.songsSection")}
          </Typography>
          {totalSetSeconds > 0 && (
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.85rem" }}>
              {formatSetDuration(totalSetSeconds)}
            </Typography>
          )}
        </Box>

        {songs.length === 0 ? (
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.9rem" }}>
            {t("events.noSongs")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {songs.map((song) => (
              <Box
                key={song.id}
                onClick={() => navigate(`/organizations/${organizationId}/repertoire/songs/${song.id}`)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.5,
                  py: 1,
                  borderRadius: "8px",
                  cursor: "pointer",
                  "&:hover": { backgroundColor: "rgba(15,62,181,0.04)" },
                }}
              >
                <Box>
                  <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "0.92rem", wordBreak: "break-word" }}>
                    {song.title}
                  </Typography>
                  {song.composer && (
                    <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.82rem", wordBreak: "break-word" }}>
                      {song.composer}
                    </Typography>
                  )}
                </Box>
                <ChevronRightIcon sx={{ color: "#7795de" }} />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Files section */}
      <Box sx={{ border: "1px solid #dce6f9", borderRadius: "12px", backgroundColor: "#ffffff", p: { xs: 2, sm: 3 }, mb: 2 }}>
        <EventFileSection
          organizationId={organizationId}
          eventId={eventId}
          fileIds={event.fileIds ?? []}
          canManage={canEdit}
          onUpdated={() => void loadEvent(true)}
        />
      </Box>

      {/* Delete zone */}
      {canEdit && (
        <Box sx={{ mt: 6 }}>
          <Button
            color="error"
            variant="outlined"
            onClick={() => setDeleteOpen(true)}
            sx={{
              borderRadius: "8px",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
            }}
          >
            {t("events.deleteEvent")}
          </Button>
        </Box>
      )}

      {/* Edit event dialog */}
      {editDialogOpen && (
        <EditEventDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          event={event}
          organizationId={organizationId}
          onSaved={() => void loadEvent(true)}
        />
      )}

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => { if (!deleting) setDeleteOpen(false); }}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "error.main" }}>
          {t("events.deleteEvent")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("events.confirmDeleteEvent")}
          </Typography>
        </DialogContent>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
            sx={{ borderRadius: "8px", borderColor: "#7795de", color: "#7795de", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => void handleDeleteEvent()}
            disabled={deleting}
            sx={{ borderRadius: "8px", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
          >
            {deleting ? <CircularProgress size={18} /> : t("events.deleteEvent")}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
