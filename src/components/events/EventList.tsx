import { useEffect, useMemo, useState } from "react";
import { Box, Chip, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { withFlatPagination } from "../../utils/pagination";

type EventCalendarGroupedResponseDTO = components["schemas"]["EventCalendarGroupedResponseDTO"];
type EventCalendarDTO = components["schemas"]["EventCalendarDTO"];
type EventType = EventCalendarDTO["eventType"];
type ApiErrorResponse = components["schemas"]["ApiErrorResponse"];

type GetOrganizationCalendarRequest = {
  params: {
    path: {
      organizationId: number;
    };
    query: {
      from?: string;
      to?: string;
      scope?: string;
      tags?: string[];
      includeOrgWide: boolean;
      page?: number;
      size?: number;
    };
  };
  headers: {
    Authorization: string;
  };
};

type GetOrganizationCalendarResponse = {
  data?: EventCalendarGroupedResponseDTO;
  error?: ApiErrorResponse;
};

interface EventListProps {
  organizationId: number;
  from?: string;
  to?: string;
  scope?: string;
  tags?: string[];
}

type CalendarScope = "section" | "sections" | "organization";

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return null;
}

function getDayNumber(startTime?: string): string {
  if (!startTime) {
    return "--";
  }

  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return String(date.getDate()).padStart(2, "0");
}

function formatTime(dateTime?: string): string {
  if (!dateTime) {
    return "--:--";
  }

  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function resolveScope(scope?: string): CalendarScope {
  const normalized = scope?.trim().toLowerCase();
  if (normalized === "section" || normalized === "sections" || normalized === "organization") {
    return normalized;
  }

  return "organization";
}

export default function EventList({ organizationId, from, to, scope, tags }: EventListProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const [calendarData, setCalendarData] =
    useState<EventCalendarGroupedResponseDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const getOrganizationCalendar = client.GET as unknown as (
    path: "/api/v1/organizations/{organizationId}/events/calendar",
    init: GetOrganizationCalendarRequest
  ) => Promise<GetOrganizationCalendarResponse>;

  useEffect(() => {
    if (!user || !Number.isFinite(organizationId) || organizationId <= 0) {
      setCalendarData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadEvents = async () => {
      setLoading(true);

      try {
        const query = withFlatPagination(
          {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            scope: resolveScope(scope),
            ...(tags && tags.length > 0 ? { tags } : {}),
            includeOrgWide: true,
          },
          { page: 0, size: 5 }
        );

        const { data, error: responseError } = await getOrganizationCalendar(
          "/api/v1/organizations/{organizationId}/events/calendar",
          {
            params: {
              path: { organizationId },
              query,
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (responseError) {
          throw responseError;
        }

        if (!cancelled) {
          setCalendarData((data as unknown as EventCalendarGroupedResponseDTO) ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          showAlert(getErrorMessage(err) ?? String(t("organizations.events.loadError")), "warning");
          setCalendarData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [from, getOrganizationCalendar, organizationId, scope, showAlert, t, tags, to, user]);

  const events = useMemo(() => {
    const now = Date.now();
    const source = [calendarData?.organizationWideEvents ?? []].flatMap((items) => items);

    return source
      .slice()
      .filter((e) => {
        const endMs = e.endTime ? new Date(e.endTime).getTime() : Number.POSITIVE_INFINITY;
        return endMs > now;
      })
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })
      .slice(0, 5);
  }, [calendarData]);

  const getTypeLabel = (eventType?: EventType): string => {
    if (eventType === "REHEARSAL") {
      return String(t("organizations.events.rehearsal"));
    }
    if (eventType === "CONCERT") {
      return String(t("organizations.events.concert"));
    }
    return String(t("organizations.events.other"));
  };

  const getMonthLabel = (startTime?: string): string => {
    if (!startTime) {
      return "";
    }

    const date = new Date(startTime);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const locale = i18n.language === "ru" ? "ru-RU" : "en-US";
    return date
      .toLocaleString(locale, { month: "short" })
      .replace(".", "")
      .toUpperCase();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2, display: "flex", flexDirection: "column" }}>
      {events.length === 0 && (
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
          }}
        >
          {String(t("organizations.events.empty"))}
        </Typography>
      )}

      {events.length > 0 && (
        <Box sx={{ borderRadius: "12px", border: "1px solid #dce6f9", overflow: "hidden" }}>
          {events.map((event, index) => {
            const isBlueRow = index % 2 === 0;
            const dateColor = isBlueRow ? "#ffffff" : "#0f3eb5";

            return (
              <Box
                key={`${event.id ?? index}-${event.startTime ?? ""}`}
                sx={{
                  display: "flex",
                  alignItems: "stretch",
                  background: isBlueRow
                    ? "linear-gradient(to right, #0f3eb5, #ffffff)"
                    : "#ffffff",
                  ...(index < events.length - 1 ? { borderBottom: "1px solid #dce6f9" } : {}),
                }}
              >
                <Box
                  sx={{
                    width: { xs: 72, sm: 88 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 1,
                    py: 1,
                    gap: 0.2,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontWeight: 700,
                      fontSize: { xs: "1.5rem", sm: "2rem" },
                      color: dateColor,
                      lineHeight: 1,
                    }}
                  >
                    {getDayNumber(event.startTime)}
                  </Typography>

                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      letterSpacing: "0.06em",
                      color: dateColor,
                      lineHeight: 1,
                    }}
                  >
                    {getMonthLabel(event.startTime)}
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, p: 1.25 }}>
                  <Box sx={{ borderRadius: "12px", boxShadow: 1, bgcolor: "#fff", p: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 2,
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            fontFamily: "Century Gothic, sans-serif",
                            fontWeight: 700,
                            color: "#0f3eb5",
                          }}
                        >
                          {event.title ?? ""}
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.5,
                            fontFamily: "Century Gothic, sans-serif",
                            color: "#7795de",
                          }}
                        >
                          {formatTime(event.startTime)} – {formatTime(event.endTime)}
                        </Typography>

                        {event.location && (
                          <Typography
                            sx={{
                              mt: 1,
                              fontFamily: "Century Gothic, sans-serif",
                              color: "#0f3eb5",
                              fontSize: "0.9rem",
                            }}
                          >
                            {event.location}
                          </Typography>
                        )}
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 0.75,
                          minWidth: { xs: 96, sm: 140 },
                        }}
                      >
                        <Chip
                          size="small"
                          label={getTypeLabel(event.eventType)}
                          sx={{
                            color: "#0f3eb5",
                            backgroundColor: "#e8f0ff",
                            border: "1px solid #7795de",
                            fontFamily: "Century Gothic, sans-serif",
                          }}
                        />

                        {event.tags && event.tags.length > 0 && (
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                              gap: 0.75,
                            }}
                          >
                            {event.tags.map((tag) => (
                              <Chip
                                key={`${event.id ?? "event"}-${tag}`}
                                label={tag}
                                size="small"
                                sx={{
                                  backgroundColor: "#f0f4ff",
                                  color: "#0f3eb5",
                                  border: "1px solid #dce6f9",
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
