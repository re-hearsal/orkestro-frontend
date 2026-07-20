import { useCallback, useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
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
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ruRU, enUS } from "@mui/x-date-pickers/locales";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ru";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client, { type UnsafeApiMethod } from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import EventFileUpload from "../components/events/EventFileUpload";

type SectionDTO = components["schemas"]["SectionDTO"];
type SongDTO = components["schemas"]["SongDTO"];
type EventDescriptionTemplateDTO = components["schemas"]["EventDescriptionTemplateDTO"];
type EventType = "REHEARSAL" | "CONCERT" | "OTHER";

interface MemberSearchResult {
  userId?: number;
  name?: string;
}

interface DateRange {
  start: Dayjs | null;
  end: Dayjs | null;
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

export default function CreateEventPage() {
  const { t, i18n } = useTranslation();
  const { organizationId: rawOrgId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, setCurrentOrganization } = useOrganization();

  const organizationId = Number(rawOrgId);
  const dayjsLocale = i18n.language === "ru" ? "ru" : "en";

  useEffect(() => {
    if (!user || !organizationId) {return;}
    const org = organizations.find((o) => o.id === organizationId);
    if (org) {setCurrentOrganization(org);}
  }, [organizationId, organizations, setCurrentOrganization, user]);

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
  const [descriptionTemplateId, setDescriptionTemplateId] = useState<number | undefined>();
  const [location, setLocation] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Step 3 — Dates
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [duplicateEnabled, setDuplicateEnabled] = useState(false);
  const [duplicateDates, setDuplicateDates] = useState<DateRange[]>([]);
  const [sendRsvp, setSendRsvp] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number>(60);

  // Step 4 — Files
  const [files, setFiles] = useState<File[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const memberSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sections and songs once
  useEffect(() => {
    if (!user || !organizationId) {return;}
    let cancelled = false;

    const loadSections = async () => {
      const { data } = await client.GET("/api/v1/organizations/{organizationId}/sections", {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!cancelled && Array.isArray(data)) {setAllSections(data as SectionDTO[]);}
    };

    const loadSongs = async () => {
      const flatQuery = withFlatPagination({}, { page: 0, size: 200 });
      const { data } = await client.GET(
        "/api/v1/organizations/{organizationId}/repertoire/songs/page",
        {
          params: { path: { organizationId }, query: flatQuery as never },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (!cancelled) {
        const payload = (data as unknown as { content?: SongDTO[] }) ?? {};
        setAllSongs(payload.content ?? []);
      }
    };

    void Promise.all([loadSections(), loadSongs()]);
    return () => { cancelled = true; };
  }, [organizationId, user]);

  // Member search with debounce
  useEffect(() => {
    if (!memberSearchQuery.trim() || !user || !organizationId) {
      setMemberSearchResults([]);
      return;
    }

    if (memberSearchTimerRef.current) {clearTimeout(memberSearchTimerRef.current);}
    memberSearchTimerRef.current = setTimeout(async () => {
      setMemberSearchLoading(true);
      try {
        const query = withFlatPagination({ query: memberSearchQuery }, { page: 0, size: 10 });
        const { data } = await (client.GET as UnsafeApiMethod)(
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
            .filter((m) => m.userId !== profile?.id)
        );
      } catch {
        setMemberSearchResults([]);
      } finally {
        setMemberSearchLoading(false);
      }
    }, 300);
  }, [memberSearchQuery, organizationId, user, profile?.id]);

  // Load template when entering step 2
  const loadTemplate = useCallback(async () => {
    if (!user || !organizationId || !eventType) {return;}
    try {
      const { data } = await (client.GET as UnsafeApiMethod)(
        "/api/v1/organizations/{organizationId}/event-templates",
        {
          params: { path: { organizationId }, query: { eventType } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { content?: unknown[] })?.content)
        ? (data as { content: EventDescriptionTemplateDTO[] }).content
        : [];
      if (items.length > 0) {
        const tpl = items[0] as EventDescriptionTemplateDTO;
        if (tpl.content) {setDescription(tpl.content);}
        if (tpl.id) {setDescriptionTemplateId(tpl.id);}
      }
    } catch {
      // silently ignore template load failure
    }
  }, [eventType, organizationId, user]);

  const steps = [
    t("organizations.events.create.stepParticipants"),
    t("organizations.events.create.stepInfo"),
    t("organizations.events.create.stepDates"),
    t("organizations.events.create.stepFiles"),
  ];

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (s === 0) {
      if (!eventType) {newErrors.eventType = t("organizations.events.create.eventTypeRequired");}
    }
    if (s === 1) {
      if (!title.trim()) {newErrors.title = t("organizations.events.create.nameRequired");}
      if (title.trim().length > 30) {newErrors.title = t("organizations.events.create.nameMaxLength");}
    }
    if (s === 2) {
      if (!startTime) {
        newErrors.startTime = t("organizations.events.create.startTimeRequired");
      } else if (startTime.isBefore(dayjs())) {
        newErrors.startTime = t("organizations.events.create.startTimeInPast");
      }
      if (!endTime) {
        newErrors.endTime = t("organizations.events.create.endTimeRequired");
      } else if (startTime && endTime.isBefore(startTime)) {
        newErrors.endTime = t("organizations.events.create.endBeforeStart");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(step)) {return;}
    if (step === 0 && description === "") {
      await loadTemplate();
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleCreate = async () => {
    if (!validateStep(step)) {return;}
    if (!user || !eventType || !startTime || !endTime) {return;}

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("eventType", eventType);
      formData.append("startTime", startTime.toISOString());
      formData.append("endTime", endTime!.toISOString());
      if (description.trim()) {formData.append("description", description.trim());}
      if (location.trim()) {formData.append("location", location.trim());}
      if (externalLink.trim()) {formData.append("externalLink", externalLink.trim());}
      tags.forEach((tag) => formData.append("tags", tag));
      formData.append("includeAllOrganizationMembers", String(participantMode === "all"));
      if (participantMode === "bySection") {
        participantSectionIds.forEach((id) => formData.append("participantSectionIds", String(id)));
        participantUserIds.forEach((id) => formData.append("participantUserIds", String(id)));
      }
      songIds.forEach((id) => formData.append("songIds", String(id)));
      formData.append("sendRsvp", String(sendRsvp));
      if (reminderEnabled) {formData.append("remindBeforeMinutes", String(remindBeforeMinutes));}
      if (descriptionTemplateId) {formData.append("descriptionTemplateId", String(descriptionTemplateId));}
      files.forEach((file) => formData.append("files", file));

      const { data, error } = await (client.POST as UnsafeApiMethod)(
        "/api/v1/organizations/{organizationId}/events",
        {
          params: { path: { organizationId } },
          body: formData,
          headers: { Authorization: `Bearer ${user.token}` },
          bodySerializer: (body: FormData) => body,
        }
      );

      if (error) {throw error;}

      const newEventId = (data as { id?: number })?.id;

      if (duplicateEnabled && duplicateDates.length > 0 && newEventId) {
        const startTimes = duplicateDates
          .filter((d) => d.start != null)
          .map((d) => d.start!.toISOString() as string);

        if (startTimes.length > 0) {
          try {
            await (client.POST as UnsafeApiMethod)(
              "/api/v1/organizations/{organizationId}/events/{eventId}/duplicates",
              {
                params: { path: { organizationId, eventId: newEventId } },
                body: { startTimes },
                headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
              }
            );
          } catch {
            showAlert(t("organizations.events.create.duplicateError"), "error");
          }
        }
      }

      showAlert(t("organizations.events.create.createSuccess"), "success");
      navigate(`/organizations/${organizationId}/schedule`);
    } catch {
      showAlert(t("organizations.events.loadError"), "error");
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
      setMemberSearchQuery("");
      setMemberSearchResults([]);
    }
  };

  const addParticipantUser = (member: MemberSearchResult) => {
    if (!member.userId || participantUserIds.includes(member.userId)) {return;}
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
    if (!song.id || songIds.includes(song.id)) {return;}
    if (songIds.length >= 50) {
      showAlert(t("organizations.events.create.tooManySongs"), "error");
      return;
    }
    setSongIds([...songIds, song.id]);
    setSongs([...songs, song]);
  };

  const removeSong = (songId: number) => {
    setSongIds(songIds.filter((id) => id !== songId));
    setSongs(songs.filter((s) => s.id !== songId));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (tags.length >= 5) {
        showAlert(t("organizations.events.create.tooManyTags"), "error");
        return;
      }
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const addDuplicateDate = () => {
    if (duplicateDates.length >= 10) {
      showAlert(t("organizations.events.create.duplicateDateLimit"), "error");
      return;
    }
    setDuplicateDates([...duplicateDates, { start: null, end: null }]);
  };

  const updateDuplicateDate = (index: number, field: "start" | "end", value: Dayjs | null) => {
    const next = [...duplicateDates];
    next[index] = { ...next[index], [field]: value };
    setDuplicateDates(next);
  };

  const removeDuplicateDate = (index: number) => {
    setDuplicateDates(duplicateDates.filter((_, i) => i !== index));
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
      <Box sx={{ maxWidth: 720, mx: "auto", p: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h4"
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            mb: 3,
          }}
        >
          {t("organizations.events.create.title")}
        </Typography>

        <Stepper
          activeStep={step}
          alternativeLabel
          sx={{
            mb: 4,
            "& .MuiStepLabel-label": {
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.82rem",
              display: { xs: "none", sm: "block" },
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
                onChange={(_, val) => { if (val) {setParticipantMode(val);} }}
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
                  <Menu anchorEl={sectionMenuAnchor} open={Boolean(sectionMenuAnchor)} onClose={() => setSectionMenuAnchor(null)}>
                    {availableSectionsToAdd.map((section) => (
                      <MenuItem key={section.id} onClick={() => addSection(section.id!)} sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem" }}>
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
                  <Box sx={{ position: "relative", opacity: participantSectionIds.length === 0 ? 0.4 : 1, pointerEvents: participantSectionIds.length === 0 ? "none" : "auto" }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={t("organizations.events.create.searchParticipants")}
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      disabled={participantSectionIds.length === 0}
                      slotProps={{ input: { endAdornment: memberSearchLoading ? <CircularProgress size={16} /> : null } }}
                      sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                    />
                    {memberSearchResults.length > 0 && (
                      <Box sx={{ position: "absolute", zIndex: 10, width: "100%", bgcolor: "#fff", border: "1px solid #dce6f9", borderRadius: "8px", mt: 0.5, boxShadow: 2 }}>
                        {memberSearchResults.map((m) => (
                          <Box
                            key={m.userId}
                            onClick={() => addParticipantUser(m)}
                            sx={{ px: 1.5, py: 1, cursor: "pointer", fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem", "&:hover": { bgcolor: "#f0f4ff" } }}
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
                  if (reason !== "reset") {setSongSearchInput(newValue);}
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

            <Box sx={blockSx}>
              <Typography sx={titleSx}>{t("organizations.events.create.tagsLabel")}</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => setTags(tags.filter((t) => t !== tag))}
                    sx={{ fontFamily: "Century Gothic, sans-serif", backgroundColor: "#f0f4ff", color: "#0f3eb5", border: "1px solid #dce6f9" }}
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder={t("organizations.events.create.addTagPlaceholder")}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
              />
            </Box>
          </Box>
        )}

        {/* Step 2 — Dates */}
        {step === 2 && (
          <Box>
            <Box sx={blockSx}>
              <Typography sx={titleSx}>{t("organizations.events.create.startTime")}</Typography>
              <DateTimePicker
                value={startTime}
                onChange={(val) => {
                  setStartTime(val);
                  if (val) {setEndTime(val.add(3, "hour"));}
                }}
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
              <FormControlLabel
                control={
                  <Switch
                    checked={duplicateEnabled}
                    onChange={(e) => setDuplicateEnabled(e.target.checked)}
                    sx={{ "& .MuiSwitch-thumb": { bgcolor: duplicateEnabled ? "#0f3eb5" : undefined } }}
                  />
                }
                label={
                  <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", color: "#0f3eb5" }}>
                    {t("organizations.events.create.duplicateSwitch")}
                  </Typography>
                }
              />
              {duplicateEnabled && (
                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.82rem", color: "#7795de", mb: 1 }}>
                    {t("organizations.events.create.duplicateHint")}
                  </Typography>
                  {duplicateDates.map((range, index) => (
                    <Box key={index} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5, alignItems: "flex-start" }}>
                      <DateTimePicker
                        label={t("organizations.events.create.startTime")}
                        value={range.start}
                        onChange={(val) => updateDuplicateDate(index, "start", val)}
                        slotProps={{
                          textField: {
                            size: "small",
                            sx: { flex: "1 1 200px", minWidth: 0, "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } },
                          },
                        }}
                      />
                      <DateTimePicker
                        label={t("organizations.events.create.endTime")}
                        value={range.end}
                        onChange={(val) => updateDuplicateDate(index, "end", val)}
                        slotProps={{
                          textField: {
                            size: "small",
                            sx: { flex: "1 1 200px", minWidth: 0, "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } },
                          },
                        }}
                      />
                      <IconButton size="small" onClick={() => removeDuplicateDate(index)} sx={{ color: "#d32f2f", mt: 0.5 }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    variant="outlined"
                    onClick={addDuplicateDate}
                    sx={{ fontFamily: "Century Gothic, sans-serif", textTransform: "none", borderColor: "#7795de", color: "#0f3eb5", fontSize: "0.78rem" }}
                  >
                    {t("organizations.events.create.addDate")}
                  </Button>
                </Box>
              )}
            </Box>

            <Box sx={blockSx}>
              <FormControlLabel
                control={<Switch checked={sendRsvp} onChange={(e) => setSendRsvp(e.target.checked)} />}
                label={
                  <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", color: "#0f3eb5" }}>
                    {t("organizations.events.create.sendRsvp")}
                  </Typography>
                }
              />
            </Box>

            <Box sx={blockSx}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
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
                    sx={{ width: { xs: "100%", sm: 200 }, "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Step 3 — Files */}
        {step === 3 && (
          <Box sx={blockSx}>
            <EventFileUpload
              files={files}
              onChange={(f) => {
                if (f.length > 100) {
                  showAlert(t("organizations.events.create.tooManyFiles"), "error");
                  return;
                }
                setFiles(f);
              }}
              maxFiles={100}
            />
          </Box>
        )}

        {/* Navigation buttons */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
          <Button
            variant="outlined"
            onClick={step === 0 ? () => navigate(`/organizations/${organizationId}/schedule`) : handleBack}
            disabled={saving}
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
              borderColor: "#7795de",
              color: "#7795de",
            }}
          >
            {t("organizations.events.create.back")}
          </Button>

          {step < 3 ? (
            <Button
              variant="contained"
              onClick={() => void handleNext()}
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
              onClick={() => void handleCreate()}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : undefined}
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                textTransform: "none",
                bgcolor: "#0f3eb5",
                "&:hover": { bgcolor: "#0c32a0" },
              }}
            >
              {t("organizations.events.create.create")}
            </Button>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
