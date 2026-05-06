import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Pagination,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import EventParticipantCard, { type EventParticipantRow } from "../components/events/EventParticipantCard";

type EventDTO = components["schemas"]["EventDTO"];

interface PagedParticipantsResponse {
  content?: EventParticipantRow[];
  page?: { totalPages?: number; totalElements?: number };
}

const PAGE_SIZE = 20;

export default function EventParticipantsPage() {
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
  const canMarkAttendance = permissions.has("EVENT_MARK_ATTENDANCE");

  const [event, setEvent] = useState<EventDTO | null>(null);
  const [participants, setParticipants] = useState<EventParticipantRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCreator = !!profile?.id && !!event?.createdByUserId && profile.id === event.createdByUserId;
  const canExport = isCreator || canMarkAttendance;

  // Sync current organization
  useEffect(() => {
    if (!isValid) return;
    if (currentOrganization?.id === organizationId) return;
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) setCurrentOrganization(matched);
  }, [currentOrganization?.id, isValid, organizationId, organizations, setCurrentOrganization]);

  // Load event title
  useEffect(() => {
    if (!user || !isValid) return;
    void (async () => {
      try {
        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/events/{eventId}",
          {
            params: { path: { organizationId, eventId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (error) return;
        setEvent(data as unknown as EventDTO);
      } catch {
        // ignore
      }
    })();
  }, [user, isValid, organizationId, eventId]);

  const loadParticipants = useCallback(
    async (pageNum: number, query: string) => {
      if (!user || !isValid) return;
      setLoading(true);
      try {
        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/events/{eventId}/participants",
          {
            params: {
              path: { organizationId, eventId },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              query: withFlatPagination(query ? { name: query } : {}, { page: pageNum, size: PAGE_SIZE }) as any,
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (error) throw error;
        const payload = (data as unknown as PagedParticipantsResponse) ?? {};
        setParticipants(payload.content ?? []);
        setPage(pageNum);
        setTotalPages(payload.page?.totalPages ?? 0);
      } catch {
        // keep existing on error
      } finally {
        setLoading(false);
      }
    },
    [isValid, organizationId, eventId, user]
  );

  useEffect(() => {
    void loadParticipants(0, searchQuery);
  }, [loadParticipants, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value.trim());
    }, 400);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    void loadParticipants(newPage - 1, searchQuery);
  };

  const handleAttendanceUpdated = (userId: number, status: "UNKNOWN" | "ATTENDED" | "ABSENT" | "EXCUSED") => {
    setParticipants((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, attendanceStatus: status } : p))
    );
  };

  const handleExportCsv = async () => {
    if (!user) return;
    setCsvLoading(true);
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/events/{eventId}/attendance/matrix.csv",
        {
          params: { path: { organizationId, eventId } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        }
      );
      if (error || !data) throw error ?? new Error("Empty response");
      const blob = data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showAlert(String(t("events.exportCsvError")), "error");
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: "auto" }}>
      {/* Back button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/organizations/${organizationId}/events/${eventId}`)}
        sx={{
          mb: 2,
          color: "#7795de",
          fontFamily: "Century Gothic, sans-serif",
          textTransform: "none",
          fontSize: "0.9rem",
        }}
      >
        {event?.name ?? String(t("common.back"))}
      </Button>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography
          variant="h4"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}
        >
          {t("events.participants")}
        </Typography>

        {canExport && (
          <Button
            variant="outlined"
            startIcon={csvLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={() => void handleExportCsv()}
            disabled={csvLoading}
            sx={{
              color: "#0f3eb5",
              borderColor: "#0f3eb5",
              borderRadius: "8px",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
              fontSize: "0.9rem",
            }}
          >
            {t("events.exportCsv")}
          </Button>
        )}
      </Box>

      {/* Search */}
      <TextField
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder={String(t("events.searchParticipants"))}
        size="small"
        fullWidth
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#7795de" }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Content */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : participants.length === 0 ? (
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
            textAlign: "center",
            py: 6,
          }}
        >
          {t("events.noParticipants")}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Column headers — widths mirror EventParticipantCard chip widths */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, pb: 0.5 }}>
            <Box sx={{ width: 32, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }} />
            <Box sx={{ width: "1px", bgcolor: "transparent", flexShrink: 0, mx: 0.5 }} />
            <Typography
              sx={{
                width: 100,
                flexShrink: 0,
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#7795de",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "center",
              }}
            >
              {t("events.colRsvp")}
            </Typography>
            <Box sx={{ width: "1px", bgcolor: "transparent", flexShrink: 0 }} />
            <Typography
              sx={{
                width: 175,
                flexShrink: 0,
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#7795de",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "center",
              }}
            >
              {t("events.colAttendance")}
            </Typography>
          </Box>

          {participants.map((p) => (
            <EventParticipantCard
              key={p.userId}
              participant={p}
              organizationId={organizationId}
              eventId={eventId}
              canMarkAttendance={isCreator || canMarkAttendance}
              onAttendanceUpdated={handleAttendanceUpdated}
            />
          ))}
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={handlePageChange}
            sx={{
              "& .MuiPaginationItem-root": {
                fontFamily: "Century Gothic, sans-serif",
                color: "#0f3eb5",
              },
              "& .MuiPaginationItem-root.Mui-selected": {
                backgroundColor: "#0f3eb5",
                color: "#fff",
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
