import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ruRU, enUS } from "@mui/x-date-pickers/locales";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ru";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import FeedbackRow, { type EventFeedbackRowDTO } from "../components/events/FeedbackRow";

const PAGE_SIZE = 20;

const SORT_OPTIONS = ["commentCreatedAt", "eventStartTime", "rating"] as const;
const EVENT_TYPE_OPTIONS = ["all", "REHEARSAL", "CONCERT", "OTHER"] as const;

type EventType = "REHEARSAL" | "CONCERT" | "OTHER";

interface FeedbackPage {
  content?: EventFeedbackRowDTO[];
  page?: {
    totalElements?: number;
    totalPages?: number;
    number?: number;
    size?: number;
  };
}

export default function FeedbackPage() {
  const { t, i18n } = useTranslation();
  const dayjsLocale = i18n.language === "ru" ? "ru" : "en";
  const localeText = dayjsLocale === "ru"
    ? ruRU.components.MuiLocalizationProvider.defaultProps.localeText
    : enUS.components.MuiLocalizationProvider.defaultProps.localeText;
  const { organizationId: rawOrgId } = useParams();
  const { user } = useAuth();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const isValid = Number.isFinite(organizationId) && organizationId > 0;

  // Sync current organization
  useEffect(() => {
    if (!isValid) return;
    if (currentOrganization?.id === organizationId) return;
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) setCurrentOrganization(matched);
  }, [currentOrganization?.id, isValid, organizationId, organizations, setCurrentOrganization]);

  // Filter state
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType | "all">("all");
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>("commentCreatedAt");
  const [page, setPage] = useState(0);

  // Data state
  const [loading, setLoading] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackPage | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const resetFilters = () => {
    setTitle("");
    setEventType("all");
    setDateFrom(null);
    setDateTo(null);
    setTags([]);
    setSortField("commentCreatedAt");
    setPage(0);
  };

  const handleFilterChange = (fn: () => void) => {
    fn();
    setPage(0);
  };

  // Load available tags
  useEffect(() => {
    if (!user || !isValid) return;
    void (async () => {
      try {
        const { data } = await client.GET(
          "/api/v1/organizations/{organizationId}/events/tags",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (data) setAvailableTags(data as string[]);
      } catch {
        // ignore
      }
    })();
  }, [isValid, organizationId, user]);

  const loadFeedback = useCallback(async () => {
    if (!user || !isValid) return;
    setLoading(true);
    try {
      const query: Record<string, unknown> = {};
      if (title.trim()) query.title = title.trim();
      if (eventType !== "all") query.eventType = eventType;
      if (dateFrom?.isValid()) query.from = dateFrom.startOf("day").toISOString();
      if (dateTo?.isValid()) query.to = dateTo.endOf("day").toISOString();
      if (tags.length > 0) query.tags = tags;
      if (sortField) query.sortField = sortField;

      const params = withFlatPagination(query, { page, size: PAGE_SIZE });

      const { data } = await client.GET(
        "/api/v1/organizations/{organizationId}/events/feedback",
        {
          params: {
            path: { organizationId },
            query: params as Parameters<typeof client.GET>[1]["params"]["query"],
          },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (data) {
        setFeedbackData(data as unknown as FeedbackPage);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, eventType, isValid, organizationId, page, sortField, tags, title, user]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const rows = feedbackData?.content ?? [];
  const totalPages = feedbackData?.page?.totalPages ?? 0;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f3eb5", mb: 2, fontFamily: "Century Gothic, sans-serif" }}>
        {t("sidebar.feedback")}
      </Typography>

      {/* Filter panel */}
      <Box
        sx={{
          border: "1px solid #dce6f9",
          borderRadius: "10px",
          p: 2,
          mb: 3,
          backgroundColor: "#fff",
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "flex-start",
        }}
      >
        <TextField
          size="small"
          label={t("searchByTitle")}
          value={title}
          onChange={(e) => handleFilterChange(() => setTitle(e.target.value))}
          sx={{ minWidth: 0, flex: { xs: "1 1 100%", sm: "1 1 200px" } }}
          slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
        />

        <TextField
          select
          size="small"
          label={t("organizations.events.create.eventType")}
          value={eventType}
          onChange={(e) => handleFilterChange(() => setEventType(e.target.value as EventType | "all"))}
          sx={{ minWidth: 0, flex: { xs: "1 1 100%", sm: "1 1 150px" } }}
          slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
        >
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt} sx={{ fontFamily: "Century Gothic, sans-serif" }}>
              {opt === "all" ? t("eventType.all") : t(`eventType.${opt}`)}
            </MenuItem>
          ))}
        </TextField>

        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dayjsLocale} localeText={localeText}>
          <Box sx={{ display: "flex", gap: 1, flex: { xs: "1 1 100%", sm: "1 1 260px" }, flexWrap: "wrap" }}>
            <DatePicker
              label={t("dateFrom")}
              value={dateFrom}
              onChange={(val) => handleFilterChange(() => setDateFrom(val))}
              slotProps={{ textField: { size: "small", sx: { flex: 1, minWidth: 130 } } }}
            />
            <DatePicker
              label={t("dateTo")}
              value={dateTo}
              onChange={(val) => handleFilterChange(() => setDateTo(val))}
              slotProps={{ textField: { size: "small", sx: { flex: 1, minWidth: 130 } } }}
            />
          </Box>
        </LocalizationProvider>

        <Autocomplete
          multiple
          size="small"
          options={availableTags}
          value={tags}
          onChange={(_, newValue) => handleFilterChange(() => setTags(newValue))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Теги"
              sx={{ "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } }}
            />
          )}
          sx={{ minWidth: 0, flex: { xs: "1 1 100%", sm: "1 1 180px" } }}
        />

        <TextField
          select
          size="small"
          label={t("sortBy")}
          value={sortField}
          onChange={(e) => handleFilterChange(() => setSortField(e.target.value))}
          sx={{ minWidth: 0, flex: { xs: "1 1 100%", sm: "1 1 160px" } }}
          slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
        >
          {SORT_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt} sx={{ fontFamily: "Century Gothic, sans-serif" }}>
              {t(`sort.${opt}`)}
            </MenuItem>
          ))}
        </TextField>

        <Button
          variant="outlined"
          onClick={resetFilters}
          sx={{
            borderRadius: "8px",
            borderColor: "#7795de",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            alignSelf: "center",
          }}
        >
          {t("resetFilters")}
        </Button>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : rows.length === 0 ? (
        <Typography
          sx={{
            textAlign: "center",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            py: 6,
          }}
        >
          {t("feedback.empty")}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {rows.map((row, idx) => (
            <FeedbackRow key={row.commentId ?? idx} row={row} organizationId={organizationId} />
          ))}
        </Box>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(_, value) => setPage(value - 1)}
            color="primary"
            sx={{ "& .MuiPaginationItem-root": { fontFamily: "Century Gothic, sans-serif" } }}
          />
        </Box>
      )}
    </Box>
  );
}
