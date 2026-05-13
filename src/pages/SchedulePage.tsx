import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Chip, Divider, GlobalStyles, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import ScheduleFilters from "../components/schedule/ScheduleFilters";
import ScheduleExport from "../components/schedule/ScheduleExport";
import EventHoverPopup from "../components/schedule/EventHoverPopup";
import WeekEventCard from "../components/schedule/WeekEventCard";
import MonthEventCell from "../components/schedule/MonthEventCell";
import type { CalendarEvent, SectionDTO } from "../components/schedule/types";
import { useMobileAction } from "../context/MobileActionContext";

type EventCalendarGroupedResponseDTO = components["schemas"]["EventCalendarGroupedResponseDTO"];
type EventCalendarDTO = components["schemas"]["EventCalendarDTO"];

type CalendarView = "month" | "week";

function buildLocalizer(lang: string) {
  const locale = lang === "ru" ? ru : enUS;
  return dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
    getDay,
    locales: { [lang]: locale },
  });
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatRangeLabel(view: CalendarView, date: Date, lang: string): string {
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  if (view === "month") {
    return date.toLocaleString(locale, { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  }
  const { start, end } = getWeekRange(date);
  const startStr = start.toLocaleString(locale, { day: "numeric", month: "short" }).replace(".", "");
  const endStr = end.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  return `${startStr} – ${endStr}`;
}

function buildCalendarEvents(data: EventCalendarGroupedResponseDTO): CalendarEvent[] {
  const sectionMap = new Map<number, number[]>();
  for (const group of data.sectionGroups ?? []) {
    if (group.sectionId == null) continue;
    for (const ev of group.events ?? []) {
      if (ev.id == null) continue;
      const existing = sectionMap.get(ev.id) ?? [];
      existing.push(group.sectionId);
      sectionMap.set(ev.id, existing);
    }
  }

  const allEventsMap = new Map<number, EventCalendarDTO>();
  for (const ev of data.organizationWideEvents ?? []) {
    if (ev.id != null) allEventsMap.set(ev.id, ev);
  }
  for (const group of data.sectionGroups ?? []) {
    for (const ev of group.events ?? []) {
      if (ev.id != null) allEventsMap.set(ev.id, ev);
    }
  }

  const result: CalendarEvent[] = [];
  for (const [id, ev] of allEventsMap) {
    if (!ev.startTime || !ev.endTime) continue;
    result.push({
      id,
      title: ev.title ?? "",
      start: new Date(ev.startTime),
      end: new Date(ev.endTime),
      resource: { ...ev, sectionIds: sectionMap.get(id) ?? [] },
    });
  }
  return result;
}

const rbcGlobalStyles = {
  ".rbc-calendar-wrapper .rbc-calendar": {
    fontFamily: "Century Gothic, sans-serif",
    color: "#0f3eb5",
    backgroundColor: "#ffffff",
    border: "1px solid #7795de",
    borderRadius: "12px",
    overflow: "hidden",
  },
  ".rbc-calendar-wrapper .rbc-toolbar": { display: "none" },
  ".rbc-calendar-wrapper .rbc-month-view, .rbc-calendar-wrapper .rbc-time-view": { border: "none" },
  ".rbc-calendar-wrapper .rbc-header": {
    fontFamily: "Century Gothic, sans-serif",
    fontWeight: 700,
    fontSize: "0.82rem",
    color: "#0f3eb5",
    borderBottom: "1px solid #7795de",
    backgroundColor: "#f5f5f5",
    padding: "6px 0",
    textTransform: "none",
    borderColor: "#dce6f9",
  },
  ".rbc-calendar-wrapper .rbc-date-cell": {
    fontFamily: "Century Gothic, sans-serif",
    color: "#7795de",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  ".rbc-calendar-wrapper .rbc-today": {
    backgroundColor: "rgba(15,62,181,0.06)",
  },
  ".rbc-calendar-wrapper .rbc-date-cell.rbc-now button, .rbc-calendar-wrapper .rbc-date-cell.rbc-now a": {
    color: "#0f3eb5",
    fontWeight: 800,
    fontSize: "0.9rem",
  },
  ".rbc-calendar-wrapper .rbc-day-bg + .rbc-day-bg": { borderColor: "#dce6f9" },
  ".rbc-calendar-wrapper .rbc-month-row + .rbc-month-row": { borderColor: "#dce6f9" },
  ".rbc-calendar-wrapper .rbc-off-range-bg": { backgroundColor: "#efefef" },
  ".rbc-calendar-wrapper .rbc-event": {
    backgroundColor: "#0f3eb5",
    border: "none",
    borderRadius: "6px",
    padding: "1px 6px",
    fontFamily: "Century Gothic, sans-serif",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#ffffff",
  },
  ".rbc-calendar-wrapper .rbc-event.rbc-selected": { backgroundColor: "#0c32a0" },
  ".rbc-calendar-wrapper .rbc-time-slot, .rbc-calendar-wrapper .rbc-timeslot-group": {
    borderColor: "#dce6f9",
    fontFamily: "Century Gothic, sans-serif",
    fontSize: "0.75rem",
    color: "#7795de",
  },
  ".rbc-calendar-wrapper .rbc-current-time-indicator": { backgroundColor: "#0f3eb5", height: "2px" },
  ".rbc-calendar-wrapper .rbc-month-row": { overflow: "visible" },
  ".rbc-calendar-wrapper .rbc-row-content": { overflow: "visible" },
  ".rbc-calendar-wrapper .rbc-show-more": {
    fontFamily: "Century Gothic, sans-serif",
    color: "#7795de",
    fontSize: "0.75rem",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 4px",
  },
  ".rbc-calendar-wrapper .rbc-show-more:hover": { color: "#0f3eb5" },
  ".rbc-calendar-wrapper .rbc-overlay": {
    backgroundColor: "#ffffff",
    border: "1px solid #dce6f9",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(15,62,181,0.12)",
    padding: "8px",
    zIndex: 10,
  },
  ".rbc-calendar-wrapper .rbc-overlay-header": {
    fontFamily: "Century Gothic, sans-serif",
    fontWeight: 700,
    color: "#0f3eb5",
    fontSize: "0.85rem",
    borderBottom: "1px solid #dce6f9",
    marginBottom: "6px",
    paddingBottom: "4px",
  },
  ".rbc-calendar-wrapper .rbc-time-header-content, .rbc-calendar-wrapper .rbc-time-content": {
    borderColor: "#dce6f9",
  },
  ".rbc-calendar-wrapper .rbc-day-slot .rbc-events-container": { marginRight: 0 },
  ".rbc-calendar-wrapper .rbc-event-label": { display: "none" },
  ".rbc-calendar-wrapper .rbc-day-slot .rbc-event": {
    backgroundColor: "transparent",
    border: "none",
    padding: 0,
  },
};

interface AgendaViewProps {
  events: CalendarEvent[];
  lang: string;
  noEventsLabel: string;
  onEventClick: (event: CalendarEvent, target: HTMLElement) => void;
}

function AgendaView({ events, lang, noEventsLabel, onEventClick }: AgendaViewProps) {
  const locale = lang === "ru" ? "ru-RU" : "en-US";

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of sorted) {
      const key = ev.start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
      const existing = map.get(key) ?? [];
      existing.push(ev);
      map.set(key, existing);
    }
    return map;
  }, [events, locale]);

  if (grouped.size === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 6, color: "#7795de" }}>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.95rem" }}>
          {noEventsLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from(grouped.entries()).map(([dateLabel, dayEvents]) => (
        <Box key={dateLabel}>
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#7795de",
              textTransform: "capitalize",
              mb: 0.75,
            }}
          >
            {dateLabel}
          </Typography>
          <Divider sx={{ borderColor: "#dce6f9", mb: 1 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {dayEvents.map((ev) => {
              const timeStr = ev.start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
              return (
                <Box
                  key={ev.id}
                  onClick={(e) => onEventClick(ev, e.currentTarget as HTMLElement)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1,
                    borderRadius: "8px",
                    background: "rgba(15,62,181,0.06)",
                    cursor: "pointer",
                    "&:active": { background: "rgba(15,62,181,0.12)" },
                  }}
                >
                  <Chip
                    label={timeStr}
                    size="small"
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      background: "#0f3eb5",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "#0f3eb5",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.title}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function SchedulePage() {
  const { t, i18n } = useTranslation();
  const { organizationId: rawOrgId } = useParams<{ organizationId: string }>();

  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, setCurrentOrganization } = useOrganization();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);

  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sections, setSections] = useState<SectionDTO[]>([]);
  const [mySections, setMySections] = useState<SectionDTO[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sectionMode, setSectionMode] = useState<"all" | "bySection">("all");
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);

  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localizer = useMemo(() => buildLocalizer(i18n.language), [i18n.language]);

  useEffect(() => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) return;
    const org = organizations.find((o) => o.id === organizationId);
    if (org) setCurrentOrganization(org);
  }, [organizationId, organizations, setCurrentOrganization, user]);

  useEffect(() => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) return;
    let cancelled = false;

    const loadSections = async () => {
      const { data } = await client.GET("/api/v1/organizations/{organizationId}/sections", {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (cancelled || !Array.isArray(data)) return;
      const all = data as SectionDTO[];
      setSections(all);

      const membershipFlags = await Promise.all(
        all.map(async (section) => {
          if (typeof section.id !== "number") return false;
          const query = withFlatPagination({ query: user.username }, { page: 0, size: 1 });
          const { data: membersData, error } = await client.GET(
            "/api/v1/sections/{sectionId}/members/page",
            {
              params: { path: { sectionId: section.id }, query: query as never },
              headers: { Authorization: `Bearer ${user.token}` },
            }
          );
          if (error) return false;
          const paged = (membersData as unknown as { content?: unknown[] }) ?? {};
          return Array.isArray(paged.content) && paged.content.length > 0;
        })
      );
      if (!cancelled) {
        setMySections(all.filter((_, i) => membershipFlags[i]));
      }
    };

    const loadTags = async () => {
      const { data } = await client.GET("/api/v1/organizations/{organizationId}/events/tags", {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!cancelled && Array.isArray(data)) {
        setAllTags(data as string[]);
      }
    };

    void Promise.all([loadSections(), loadTags()]);
    return () => { cancelled = true; };
  }, [organizationId, user]);

  const loadEvents = useCallback(async () => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) return;

    const range = isMobile ? getWeekRange(currentDate) : view === "month" ? getMonthRange(currentDate) : getWeekRange(currentDate);

    try {
      const query = withFlatPagination(
        {
          from: range.start.toISOString(),
          to: range.end.toISOString(),
          ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
        },
        { page: 0, size: 200 }
      );

      const { data, error } = await (client.GET as Function)(
        "/api/v1/organizations/{organizationId}/events/calendar/me",
        {
          params: { path: { organizationId }, query },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );

      if (error) throw error;

      const built = buildCalendarEvents(data as EventCalendarGroupedResponseDTO);
      setEvents(built);
    } catch {
      showAlert(t("organizations.events.loadError"), "error");
    }
  }, [currentDate, isMobile, organizationId, selectedTags, showAlert, t, user, view]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (sectionMode === "all" || selectedSectionIds.length === 0) return events;
    return events.filter((e) => {
      const sectionIds = e.resource.sectionIds ?? [];
      return sectionIds.some((id) => selectedSectionIds.includes(id));
    });
  }, [events, sectionMode, selectedSectionIds]);

  const navigate_period = (direction: -1 | 1) => {
    const next = new Date(currentDate);
    if (!isMobile && view === "month") {
      next.setMonth(next.getMonth() + direction);
    } else {
      next.setDate(next.getDate() + direction * 7);
    }
    setCurrentDate(next);
  };

  const openPopup = (event: CalendarEvent, target: HTMLElement) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setPopupEvent(event);
    setPopupAnchor(target);
    setPopupOpen(true);
  };

  const scheduleHide = () => {
    hideTimerRef.current = setTimeout(() => setPopupOpen(false), 150);
  };

  const cancelHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const rangeLabel = formatRangeLabel(isMobile ? "week" : view, currentDate, i18n.language);

  useMobileAction(null);

  const calendarFormats = useMemo(() => {
    if (i18n.language !== "ru") return {};
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return {
      weekdayFormat: (date: Date) => cap(format(date, "EEEE", { locale: ru })),
      dayFormat: (date: Date) =>
        `${cap(format(date, "EEEE", { locale: ru }))} ${format(date, "d")}`,
    };
  }, [i18n.language]);

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <GlobalStyles styles={rbcGlobalStyles} />

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* Left panel — hidden on mobile */}
        <Box sx={{ width: "15%", flexShrink: 0, display: { xs: "none", md: "block" } }}>
          <ScheduleFilters
            allTags={allTags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            sections={mySections}
            sectionMode={sectionMode}
            onSectionModeChange={setSectionMode}
            selectedSectionIds={selectedSectionIds}
            onSelectedSectionsChange={setSelectedSectionIds}
          />
          <ScheduleExport />
        </Box>

        {/* Right panel */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: { xs: "center", md: "space-between" },
              flexWrap: "wrap",
              mb: 1.5,
              gap: 1,
            }}
          >
            {/* Date label + navigation */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton size="small" onClick={() => navigate_period(-1)} sx={{ color: "#0f3eb5" }}>
                <ChevronLeftIcon />
              </IconButton>
              <Typography
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "#0f3eb5",
                  minWidth: { xs: "auto", sm: 180 },
                  textAlign: "center",
                }}
              >
                {rangeLabel}
              </Typography>
              <IconButton size="small" onClick={() => navigate_period(1)} sx={{ color: "#0f3eb5" }}>
                <ChevronRightIcon />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {/* View toggle — hidden on mobile (agenda is shown instead) */}
              <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5 }}>
                <Button
                  variant={view === "month" ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setView("month")}
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    textTransform: "none",
                    fontSize: "0.82rem",
                  }}
                >
                  {t("schedule.viewMonth")}
                </Button>
                <Button
                  variant={view === "week" ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setView("week")}
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    textTransform: "none",
                    fontSize: "0.82rem",
                  }}
                >
                  {t("schedule.viewWeek")}
                </Button>
              </Box>

            </Box>
          </Box>

          {/* Calendar — desktop only */}
          {!isMobile && (
            <Box className="rbc-calendar-wrapper" sx={{ height: view === "month" ? 600 : 700 }}>
              <Calendar<CalendarEvent>
                localizer={localizer}
                events={filteredEvents}
                popup
                view={view}
                onView={() => { }}
                date={currentDate}
                onNavigate={() => { }}
                toolbar={false}
                step={60}
                timeslots={1}
                style={{ height: "100%" }}
                culture={i18n.language === "ru" ? "ru" : "en"}
                formats={calendarFormats}
                components={{
                  event: view === "week" ? WeekEventCard : MonthEventCell,
                }}
                onSelectEvent={(event, e) => {
                  openPopup(event, e.currentTarget as HTMLElement);
                }}
                eventPropGetter={() =>
                  view === "week"
                    ? { style: { background: "transparent", border: "none", padding: 0 } }
                    : {}
                }
              />
            </Box>
          )}

          {/* Agenda list — mobile only */}
          {isMobile && (
            <AgendaView
              events={filteredEvents}
              lang={i18n.language}
              noEventsLabel={t("schedule.noEvents")}
              onEventClick={openPopup}
            />
          )}
        </Box>
      </Box>

      <EventHoverPopup
        event={popupEvent}
        anchorEl={popupAnchor}
        open={popupOpen}
        sections={sections}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      />
    </Box>
  );
}
