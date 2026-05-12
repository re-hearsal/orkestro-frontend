import { useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ruRU, enUS } from "@mui/x-date-pickers/locales";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ru";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { withFlatPagination } from "../../utils/pagination";

type EventDTO = components["schemas"]["EventDTO"];
type SectionDTO = components["schemas"]["SectionDTO"];
type SongDTO = components["schemas"]["SongDTO"];
type EventType = "REHEARSAL" | "CONCERT" | "OTHER";

interface MemberSearchResult {
  userId?: number;
  name?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  event: EventDTO;
  organizationId: number;
  onSaved: () => void;
}

const titleSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontWeight: 700,
  color: "#0f3eb5",
  fontSize: "0.9rem",
  mb: 0.75,
};

const blockSx = {
  border: "1px solid #dce6f9",
  borderRadius: "10px",
  p: 2,
  mb: 2,
};

export default function EditEventDialog({ open, onClose, event, organizationId, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const dayjsLocale = i18n.language === "ru" ? "ru" : "en";

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — Participants
  const [eventType, setEventType] = useState<EventType | "">("");
  const [participantMode, setParticipantMode] = useState<"all" | "bySection">("all");
  const [participantSectionIds, setParticipantSectionIds] = useState<number[]>([]);
  const [participantUserIds, setParticipantUserIds] = useState<number[]>([]);
  const [participantUsers, setParticipantUsers] = useState<MemberSearchResult[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<MemberSearchResult[]>([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [songIds, setSongIds] = useState<number[]>([]);
  const [songs, setSongs] = useState<SongDTO[]>([]);
  const [allSongs, setAllSongs] = useState<SongDTO[]>([]);
  const [songSearchInput, setSongSearchInput] = useState("");
  const [allSections, setAllSections] = useState<SectionDTO[]>([]);
  const [sectionMenuAnchor, setSectionMenuAnchor] = useState<HTMLElement | null>(null);

  // Step 2 — Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [externalLink, setExternalLink] = useState("");

  // Step 3 — Dates & Settings
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number>(60);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const memberSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-initialize from event when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setErrors({});
    setEventType((event.eventType as EventType) ?? "");
    setParticipantMode(event.includeAllOrganizationMembers ? "all" : "bySection");
    setParticipantSectionIds(event.participantSectionIds ?? []);
    setParticipantUserIds(event.participantUserIds ?? []);
    setParticipantUsers([]);
    setSongIds(event.songIds ?? []);
    setSongs([]);
    setTitle(event.title ?? "");
    setDescription(event.description ?? "");
    setLocation(event.location ?? "");
    setExternalLink(event.externalLink ?? "");
    setStartTime(event.startTime ? dayjs(event.startTime) : null);
    setEndTime(event.endTime ? dayjs(event.endTime) : null);
    setReminderEnabled((event.remindBeforeMinutes ?? 0) > 0);
    setRemindBeforeMinutes(event.remindBeforeMinutes && event.remindBeforeMinutes > 0 ? event.remindBeforeMinutes : 60);
    setMemberSearchQuery("");
    setMemberSearchResults([]);
    setSongSearchInput("");
  }, [open, event]);

  // Load sections, songs, and pre-fill user names when dialog opens
  useEffect(() => {
    if (!open || !user || !organizationId) return;
    let cancelled = false;

    const loadData = async () => {
      const [sectResult, songsResult] = await Promise.all([
        client.GET("/api/v1/organizations/{organizationId}/sections", {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        client.GET("/api/v1/organizations/{organizationId}/repertoire/songs/page", {
          params: {
            path: { organizationId },
            query: withFlatPagination({}, { page: 0, size: 200 }) as never,
          },
          headers: { Authorization: `Bearer ${user.token}` },
        }),
      ]);

      if (cancelled) return;

      if (Array.isArray(sectResult.data)) setAllSections(sectResult.data as SectionDTO[]);

      const allSongsContent = ((songsResult.data as unknown as { content?: SongDTO[] })?.content ?? []);
      setAllSongs(allSongsContent);

      const eventSongIds = event.songIds ?? [];
      if (eventSongIds.length > 0) {
        setSongs(allSongsContent.filter((s) => s.id != null && eventSongIds.includes(s.id)));
      }

      const eventUserIds = event.participantUserIds ?? [];
      if (eventUserIds.length > 0) {
        try {
          const { data: membersData } = await (client.GET as Function)(
            "/api/v1/organizations/{organizationId}/members/page",
            {
              params: {
                path: { organizationId },
                query: withFlatPagination({}, { page: 0, size: 500 }),
              },
              headers: { Authorization: `Bearer ${user.token}` },
            }
          );
          if (cancelled) return;
          const members = Array.isArray((membersData as { content?: unknown[] })?.content)
            ? (membersData as { content: Record<string, unknown>[] }).content
            : [];
          const matched = members
            .filter((m) => eventUserIds.includes(m.id as number))
            .map((m) => ({ userId: m.id as number, name: m.name as string }));
          setParticipantUsers(
            matched.length > 0
              ? matched
              : eventUserIds.map((id) => ({ userId: id, name: `#${id}` }))
          );
        } catch {
          setParticipantUsers(eventUserIds.map((id) => ({ userId: id, name: `#${id}` })));
        }
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [open, organizationId, user, event.songIds, event.participantUserIds]);

  // Member search with debounce
  useEffect(() => {
    if (!memberSearchQuery.trim() || !user || !organizationId) {
      setMemberSearchResults([]);
      return;
    }
    if (memberSearchTimerRef.current) clearTimeout(memberSearchTimerRef.current);
    memberSearchTimerRef.current = setTimeout(async () => {
      setMemberSearchLoading(true);
      try {
        const query = withFlatPagination({ query: memberSearchQuery }, { page: 0, size: 10 });
        const { data } = await (client.GET as Function)(
          "/api/v1/organizations/{organizationId}/members/page",
          {
            params: { path: { organizationId }, query },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        const content = Array.isArray((data as { content?: unknown[] })?.content)
          ? (data as { content: Record<string, unknown>[] }).content
          : [];
        setMemberSearchResults(
          content
            .map((m) => ({ userId: m.id as number, name: m.name as string }))
            .filter((m) => m.userId !== profile?.id && !participantUserIds.includes(m.userId!))
        );
      } catch {
        setMemberSearchResults([]);
      } finally {
        setMemberSearchLoading(false);
      }
    }, 300);
  }, [memberSearchQuery, organizationId, user, profile?.id, participantUserIds]);

  const steps = [
    t("organizations.events.create.stepParticipants"),
    t("organizations.events.create.stepInfo"),
    t("organizations.events.create.stepDates"),
  ];

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 0) {
      if (!eventType) newErrors.eventType = t("organizations.events.create.eventTypeRequired");
    }
    if (s === 1) {
      if (!title.trim()) newErrors.title = t("organizations.events.create.nameRequired");
      if (title.trim().length > 30) newErrors.title = t("organizations.events.create.nameMaxLength");
    }
    if (s === 2) {
      if (!startTime) newErrors.startTime = t("organizations.events.create.startTimeRequired");
      if (!endTime) {
        newErrors.endTime = t("organizations.events.create.endTimeRequired");
      } else if (startTime && endTime.isBefore(startTime)) {
        newErrors.endTime = t("organizations.events.create.endBeforeStart");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleSave = async () => {
    if (!validateStep(step)) return;
    if (!user || !startTime || !endTime) return;

    setSaving(true);
    try {
      const origIncludeAllCheck = event.includeAllOrganizationMembers ?? false;
      const newIncludeAllCheck = participantMode === "all";
      const origSectionsSortedCheck = [...(event.participantSectionIds ?? [])].sort((a, b) => a - b);
      const origUsersSortedCheck = [...(event.participantUserIds ?? [])].sort((a, b) => a - b);
      const curSectionsSortedCheck = [...participantSectionIds].sort((a, b) => a - b);
      const curUsersSortedCheck = [...participantUserIds].sort((a, b) => a - b);
      const origSongsSortedCheck = [...(event.songIds ?? [])].sort((a, b) => a - b);
      const curSongsSortedCheck = [...songIds].sort((a, b) => a - b);
      const origRemindCheck = event.remindBeforeMinutes ?? 0;
      const newRemindCheck = reminderEnabled ? remindBeforeMinutes : 0;

      const hasChanges =
        title.trim() !== (event.title ?? "") ||
        startTime.toISOString() !== (event.startTime ?? "") ||
        endTime.toISOString() !== (event.endTime ?? "") ||
        (eventType && eventType !== event.eventType) ||
        description.trim() !== (event.description ?? "") ||
        location.trim() !== (event.location ?? "") ||
        externalLink.trim() !== (event.externalLink ?? "") ||
        newIncludeAllCheck !== origIncludeAllCheck ||
        JSON.stringify(curSectionsSortedCheck) !== JSON.stringify(origSectionsSortedCheck) ||
        JSON.stringify(curUsersSortedCheck) !== JSON.stringify(origUsersSortedCheck) ||
        JSON.stringify(origSongsSortedCheck) !== JSON.stringify(curSongsSortedCheck) ||
        newRemindCheck !== origRemindCheck;

      if (!hasChanges) {
        onClose();
        return;
      }

      const formData = new FormData();

      // Required fields — always send
      formData.append("title", title.trim());
      formData.append("startTime", startTime.toISOString());
      formData.append("endTime", endTime.toISOString());

      // eventType — only if changed
      if (eventType && eventType !== event.eventType) {
        formData.append("eventType", eventType);
      }

      // Optional strings — only if changed from original (allows clearing to "")
      const trimmedDesc = description.trim();
      if (trimmedDesc !== (event.description ?? "")) {
        formData.append("description", trimmedDesc);
      }
      const trimmedLoc = location.trim();
      if (trimmedLoc !== (event.location ?? "")) {
        formData.append("location", trimmedLoc);
      }
      const trimmedLink = externalLink.trim();
      if (trimmedLink !== (event.externalLink ?? "")) {
        formData.append("externalLink", trimmedLink);
      }

      // Participants — only if mode or lists changed (avoids expensive participant rebuild)
      const origIncludeAll = event.includeAllOrganizationMembers ?? false;
      const newIncludeAll = participantMode === "all";
      const origSectionsSorted = [...(event.participantSectionIds ?? [])].sort((a, b) => a - b);
      const origUsersSorted = [...(event.participantUserIds ?? [])].sort((a, b) => a - b);
      const curSectionsSorted = [...participantSectionIds].sort((a, b) => a - b);
      const curUsersSorted = [...participantUserIds].sort((a, b) => a - b);
      const participantsChanged =
        newIncludeAll !== origIncludeAll ||
        JSON.stringify(curSectionsSorted) !== JSON.stringify(origSectionsSorted) ||
        JSON.stringify(curUsersSorted) !== JSON.stringify(origUsersSorted);
      if (participantsChanged) {
        formData.append("includeAllOrganizationMembers", String(newIncludeAll));
        if (!newIncludeAll) {
          participantSectionIds.forEach((id) => formData.append("participantSectionIds", String(id)));
          participantUserIds.forEach((id) => formData.append("participantUserIds", String(id)));
        }
      }

      // Songs — only if list changed
      const origSongsSorted = [...(event.songIds ?? [])].sort((a, b) => a - b);
      const curSongsSorted = [...songIds].sort((a, b) => a - b);
      if (JSON.stringify(origSongsSorted) !== JSON.stringify(curSongsSorted)) {
        songIds.forEach((id) => formData.append("songIds", String(id)));
      }

      // Reminder — only if changed
      const origRemind = event.remindBeforeMinutes ?? 0;
      const newRemind = reminderEnabled ? remindBeforeMinutes : 0;
      if (newRemind !== origRemind) {
        formData.append("remindBeforeMinutes", String(newRemind));
      }

      const { error } = await (client.PUT as unknown as (
        path: string,
        init: {
          params: { path: { organizationId: number; eventId: number } };
          body: FormData;
          headers: { Authorization: string };
          bodySerializer: (b: FormData) => FormData;
        }
      ) => Promise<{ data?: unknown; error?: unknown }>)(
        "/api/v1/organizations/{organizationId}/events/{eventId}",
        {
          params: { path: { organizationId, eventId: event.id! } },
          body: formData,
          headers: { Authorization: `Bearer ${user.token}` },
          bodySerializer: (b: FormData) => b,
        }
      );

      if (error) throw error;
      showAlert(t("events.editSaveSuccess"), "success");
      onSaved();
      onClose();
    } catch {
      showAlert(t("events.editSaveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const addSection = (sectionId: number) => {
    if (!participantSectionIds.includes(sectionId)) {
      setParticipantSectionIds([...participantSectionIds, sectionId]);
    }
    setSectionMenuAnchor(null);
  };

  const removeSection = (sectionId: number) => {
    const next = participantSectionIds.filter((id) => id !== sectionId);
    setParticipantSectionIds(next);
    if (next.length === 0) {
      setParticipantUserIds([]);
      setParticipantUsers([]);
    }
  };

  const addParticipantUser = (member: MemberSearchResult) => {
    if (!member.userId || participantUserIds.includes(member.userId)) return;
    setParticipantUserIds([...participantUserIds, member.userId]);
    setParticipantUsers([...participantUsers, member]);
    setMemberSearchQuery("");
    setMemberSearchResults([]);
  };

  const removeParticipantUser = (userId: number) => {
    setParticipantUserIds(participantUserIds.filter((id) => id !== userId));
    setParticipantUsers(participantUsers.filter((u) => u.userId !== userId));
  };

  const addSong = (song: SongDTO) => {
    if (!song.id || songIds.includes(song.id)) return;
    setSongIds([...songIds, song.id]);
    setSongs([...songs, song]);
  };

  const removeSong = (songId: number) => {
    setSongIds(songIds.filter((id) => id !== songId));
    setSongs(songs.filter((s) => s.id !== songId));
  };

  const availableSectionsToAdd = allSections.filter(
    (s) => s.id != null && !participantSectionIds.includes(s.id!)
  );
  const availableSongsToAdd = allSongs.filter((s) => s.id != null && !songIds.includes(s.id!));

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={dayjsLocale}
      localeText={dayjsLocale === "ru" ? ruRU.components.MuiLocalizationProvider.defaultProps.localeText : enUS.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <Dialog
        open={open}
        onClose={saving ? undefined : onClose}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {t("events.editDialogTitle")}
            <IconButton size="small" onClick={onClose} disabled={saving} sx={{ minWidth: 44, minHeight: 44 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
          <Stepper
            activeStep={step}
            sx={{
              mb: 3,
              "& .MuiStepLabel-label": {
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.82rem",
              },
            }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step 0 — Participants */}
          {step === 0 && (
            <Box>
              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.eventType")}</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  error={!!errors.eventType}
                  helperText={errors.eventType}
                  sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                >
                  <MenuItem value="CONCERT">{t("organizations.events.concert")}</MenuItem>
                  <MenuItem value="REHEARSAL">{t("organizations.events.rehearsal")}</MenuItem>
                  <MenuItem value="OTHER">{t("organizations.events.other")}</MenuItem>
                </TextField>
              </Box>

              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.participantsMode")}</Typography>
                <ToggleButtonGroup
                  value={participantMode}
                  exclusive
                  size="small"
                  onChange={(_, val) => { if (val) setParticipantMode(val); }}
                  sx={{ mb: 1.5 }}
                >
                  <ToggleButton value="all" sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.78rem", textTransform: "none" }}>
                    {t("organizations.events.create.allOrganization")}
                  </ToggleButton>
                  <ToggleButton value="bySection" sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.78rem", textTransform: "none" }}>
                    {t("organizations.events.create.bySection")}
                  </ToggleButton>
                </ToggleButtonGroup>

                {participantMode === "bySection" && (
                  <Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                      {participantSectionIds.map((sectionId) => {
                        const section = allSections.find((s) => s.id === sectionId);
                        return (
                          <Chip
                            key={sectionId}
                            label={section?.name ?? `#${sectionId}`}
                            size="small"
                            onDelete={() => removeSection(sectionId)}
                            sx={{ fontFamily: "Century Gothic, sans-serif", backgroundColor: "#e8f0ff", color: "#0f3eb5", border: "1px solid #7795de" }}
                          />
                        );
                      })}
                    </Box>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      variant="outlined"
                      disabled={availableSectionsToAdd.length === 0}
                      onClick={(e) => setSectionMenuAnchor(e.currentTarget)}
                      sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.78rem", textTransform: "none", borderColor: "#7795de", color: "#0f3eb5", mb: 2 }}
                    >
                      {t("organizations.events.create.addSection")}
                    </Button>
                    <Menu
                      anchorEl={sectionMenuAnchor}
                      open={Boolean(sectionMenuAnchor)}
                      onClose={() => setSectionMenuAnchor(null)}
                    >
                      {availableSectionsToAdd.map((section) => (
                        <MenuItem
                          key={section.id}
                          onClick={() => addSection(section.id!)}
                          sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem" }}
                        >
                          {section.name}
                        </MenuItem>
                      ))}
                    </Menu>

                    <Typography sx={{ ...titleSx, mt: 1, opacity: participantSectionIds.length === 0 ? 0.4 : 1 }}>
                      {t("organizations.events.create.additionalParticipants")}
                    </Typography>
                    {participantSectionIds.length === 0 && (
                      <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.8rem", color: "#7795de", mb: 1 }}>
                        {t("organizations.events.create.additionalParticipantsHint")}
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                      {participantUsers.map((u) => (
                        <Chip
                          key={u.userId}
                          label={u.name ?? `#${u.userId}`}
                          size="small"
                          onDelete={() => removeParticipantUser(u.userId!)}
                          sx={{ fontFamily: "Century Gothic, sans-serif", backgroundColor: "#f0f4ff", color: "#0f3eb5", border: "1px solid #dce6f9" }}
                        />
                      ))}
                    </Box>
                    <Box
                      sx={{
                        position: "relative",
                        opacity: participantSectionIds.length === 0 ? 0.4 : 1,
                        pointerEvents: participantSectionIds.length === 0 ? "none" : "auto",
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={t("organizations.events.create.searchParticipants")}
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        disabled={participantSectionIds.length === 0}
                        slotProps={{
                          input: { endAdornment: memberSearchLoading ? <CircularProgress size={16} /> : null },
                        }}
                        sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                      />
                      {memberSearchResults.length > 0 && (
                        <Box
                          sx={{
                            position: "absolute",
                            zIndex: 10,
                            width: "100%",
                            bgcolor: "#fff",
                            border: "1px solid #dce6f9",
                            borderRadius: "8px",
                            mt: 0.5,
                            boxShadow: 2,
                          }}
                        >
                          {memberSearchResults.map((m) => (
                            <Box
                              key={m.userId}
                              onClick={() => addParticipantUser(m)}
                              sx={{
                                px: 1.5,
                                py: 1,
                                cursor: "pointer",
                                fontFamily: "Century Gothic, sans-serif",
                                fontSize: "0.88rem",
                                "&:hover": { bgcolor: "#f0f4ff" },
                              }}
                            >
                              {m.name ?? `#${m.userId}`}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>

              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.songs")}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                  {songs.map((song) => (
                    <Chip
                      key={song.id}
                      label={song.title ?? `#${song.id}`}
                      size="small"
                      onDelete={() => removeSong(song.id!)}
                      sx={{ fontFamily: "Century Gothic, sans-serif", backgroundColor: "#f0f4ff", color: "#0f3eb5", border: "1px solid #dce6f9" }}
                    />
                  ))}
                </Box>
                <Autocomplete
                  options={availableSongsToAdd}
                  getOptionLabel={(option) => option.title ?? `#${option.id}`}
                  value={null}
                  inputValue={songSearchInput}
                  onInputChange={(_, newValue, reason) => {
                    if (reason !== "reset") setSongSearchInput(newValue);
                  }}
                  onChange={(_, value) => {
                    if (value) {
                      addSong(value);
                      setSongSearchInput("");
                    }
                  }}
                  size="small"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={t("organizations.events.create.addSong")}
                      sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                    />
                  )}
                  noOptionsText={t("repertoire.notFound") ?? "No songs found"}
                />
              </Box>
            </Box>
          )}

          {/* Step 1 — Info */}
          {step === 1 && (
            <Box>
              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.nameLabel")}</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 30))}
                  error={!!errors.title}
                  helperText={errors.title ?? `${title.length}/30`}
                  sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                />
              </Box>

              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.descriptionLabel")}</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  helperText={`${description.length}/2000`}
                  sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                />
              </Box>

              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.locationLabel")}</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                />
              </Box>

              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.externalLinkLabel")}</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                />
              </Box>
            </Box>
          )}

          {/* Step 2 — Dates & Settings */}
          {step === 2 && (
            <Box>
              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.startTime")}</Typography>
                <DateTimePicker
                  value={startTime}
                  onChange={(val) => setStartTime(val)}
                  slotProps={{
                    textField: {
                      size: "small",
                      fullWidth: true,
                      error: !!errors.startTime,
                      helperText: errors.startTime,
                      sx: { "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } },
                    },
                  }}
                />
              </Box>

              <Box sx={blockSx}>
                <Typography sx={titleSx}>{t("organizations.events.create.endTime")}</Typography>
                <DateTimePicker
                  value={endTime}
                  onChange={(val) => setEndTime(val)}
                  slotProps={{
                    textField: {
                      size: "small",
                      fullWidth: true,
                      error: !!errors.endTime,
                      helperText: errors.endTime,
                      sx: { "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } },
                    },
                  }}
                />
              </Box>

              <Box sx={blockSx}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={reminderEnabled}
                        onChange={(e) => setReminderEnabled(e.target.checked)}
                      />
                    }
                    label={
                      <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", color: "#0f3eb5" }}>
                        {t("organizations.events.create.reminderSwitch")}
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                  {reminderEnabled && (
                    <TextField
                      type="number"
                      size="small"
                      label={t("organizations.events.create.reminderMinutes")}
                      value={remindBeforeMinutes}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(1440, Number(e.target.value)));
                        setRemindBeforeMinutes(v);
                      }}
                      slotProps={{ htmlInput: { min: 0, max: 1440 } }}
                      sx={{ width: 200, "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {/* Navigation buttons */}
          <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "space-between" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mt: 2 }}>
            <Button
              variant="outlined"
              onClick={step === 0 ? onClose : handleBack}
              disabled={saving}
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                textTransform: "none",
                borderColor: "#7795de",
                color: "#7795de",
              }}
            >
              {step === 0 ? t("common.cancel") : t("organizations.events.create.back")}
            </Button>

            {step < 2 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={saving}
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  textTransform: "none",
                  bgcolor: "#0f3eb5",
                  "&:hover": { bgcolor: "#0c32a0" },
                }}
              >
                {t("organizations.events.create.next")}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => void handleSave()}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : undefined}
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  textTransform: "none",
                  bgcolor: "#0f3eb5",
                  "&:hover": { bgcolor: "#0c32a0" },
                }}
              >
                {t("common.save")}
              </Button>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </LocalizationProvider>
  );
}
