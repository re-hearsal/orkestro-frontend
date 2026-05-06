import { Box, Chip, Typography } from "@mui/material";
import type { EventProps } from "react-big-calendar";
import { useTranslation } from "react-i18next";
import type { CalendarEvent } from "./types";

function formatTime(dateTime?: string | Date): string {
  if (!dateTime) return "--:--";
  const date = typeof dateTime === "string" ? new Date(dateTime) : dateTime;
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

interface WeekEventCardProps extends EventProps<CalendarEvent> {
  index?: number;
}

export default function WeekEventCard({ event }: WeekEventCardProps & { continuesPrior?: boolean }) {
  const { t } = useTranslation();

  const eventData = event.resource;

  const getTypeLabel = () => {
    if (eventData.eventType === "REHEARSAL") return t("organizations.events.rehearsal");
    if (eventData.eventType === "CONCERT") return t("organizations.events.concert");
    return t("organizations.events.other");
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        height: "100%",
        background: "#ffffff",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <Box sx={{ flex: 1, p: 0.5, minWidth: 0 }}>
        <Box sx={{ borderRadius: "8px", border: "1px solid #7795de", bgcolor: "#fff", p: 0.75, height: "100%" }}>
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              color: "#0f3eb5",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </Typography>
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.7rem",
              color: "#7795de",
            }}
          >
            {formatTime(event.start)} – {formatTime(event.end)}
          </Typography>
          {eventData.location && (
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.7rem",
                color: "#0f3eb5",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {eventData.location}
            </Typography>
          )}
          <Chip
            size="small"
            label={getTypeLabel()}
            sx={{
              mt: 0.25,
              height: 16,
              fontSize: "0.6rem",
              color: "#0f3eb5",
              backgroundColor: "#e8f0ff",
              border: "1px solid #7795de",
              fontFamily: "Century Gothic, sans-serif",
              "& .MuiChip-label": { px: 0.75 },
            }}
          />
          {eventData.tags && eventData.tags.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, mt: 0.25 }}>
              {eventData.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: "0.58rem",
                    backgroundColor: "#f0f4ff",
                    color: "#0f3eb5",
                    border: "1px solid #dce6f9",
                    fontFamily: "Century Gothic, sans-serif",
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
