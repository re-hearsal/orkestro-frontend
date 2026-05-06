import { Box, Chip, Popover, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CalendarEvent, SectionDTO } from "./types";

function formatDate(dateTime?: string | Date): string {
  if (!dateTime) return "";
  const date = typeof dateTime === "string" ? new Date(dateTime) : dateTime;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(dateTime?: string | Date): string {
  if (!dateTime) return "--:--";
  const date = typeof dateTime === "string" ? new Date(dateTime) : dateTime;
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

interface EventHoverPopupProps {
  event: CalendarEvent | null;
  anchorEl: HTMLElement | null;
  open: boolean;
  sections: SectionDTO[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function EventHoverPopup({
  event,
  anchorEl,
  open,
  sections,
  onMouseEnter,
  onMouseLeave,
}: EventHoverPopupProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();

  if (!event) return null;

  const eventData = event.resource;
  const sectionIds = eventData.sectionIds ?? [];

  const getTypeLabel = () => {
    if (eventData.eventType === "REHEARSAL") return t("organizations.events.rehearsal");
    if (eventData.eventType === "CONCERT") return t("organizations.events.concert");
    return t("organizations.events.other");
  };

  const getSectionName = (sectionId: number): string | null => {
    const found = sections.find((s) => s.id === sectionId);
    return found?.name ?? null;
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      disableRestoreFocus
      sx={{
        pointerEvents: "none",
        "& .MuiPopover-paper": {
          pointerEvents: "auto",
          borderRadius: "16px",
          p: 2,
          maxWidth: 320,
          boxShadow: "0 4px 20px rgba(15,62,181,0.15)",
        },
      }}
      slotProps={{
        paper: {
          onMouseEnter,
          onMouseLeave,
        },
      }}
    >
      <Box>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 0.75 }}>
          <Typography
            onClick={() => {
              if (organizationId && eventData.id) {
                navigate(`/organizations/${organizationId}/events/${eventData.id}`);
              }
            }}
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
              fontSize: "1rem",
              lineHeight: 1.2,
              cursor: organizationId && eventData.id ? "pointer" : "default",
              "&:hover": organizationId && eventData.id ? { textDecoration: "underline" } : {},
            }}
          >
            {event.title}
          </Typography>
          <Chip
            size="small"
            label={getTypeLabel()}
            sx={{
              flexShrink: 0,
              color: "#0f3eb5",
              backgroundColor: "#e8f0ff",
              border: "1px solid #7795de",
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.72rem",
            }}
          />
        </Box>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
            fontSize: "0.85rem",
            mb: 0.5,
          }}
        >
          {(() => {
            const startDate = formatDate(event.start);
            const endDate = formatDate(event.end);
            const isMultiDay = startDate !== endDate;
            return isMultiDay
              ? `${startDate} ${formatTime(event.start)} – ${endDate} ${formatTime(event.end)}`
              : `${startDate} ${formatTime(event.start)} – ${formatTime(event.end)}`;
          })()}
        </Typography>

        {eventData.location && (
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              color: "#0f3eb5",
              fontSize: "0.9rem",
              mb: 0.75,
            }}
          >
            {eventData.location}
          </Typography>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: eventData.tags && eventData.tags.length > 0 ? 0.75 : 0 }}>
          {sectionIds.length === 0 ? (
            <Chip
              size="small"
              label={t("schedule.wholeOrganization")}
              sx={{
                backgroundColor: "#e8f0ff",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.72rem",
              }}
            />
          ) : (
            sectionIds.map((sectionId) => {
              const name = getSectionName(sectionId);
              const isClickable = name !== null;
              return (
                <Chip
                  key={sectionId}
                  size="small"
                  label={name ?? `#${sectionId}`}
                  onClick={
                    isClickable && organizationId
                      ? () => navigate(`/organizations/${organizationId}/sections/${sectionId}`)
                      : undefined
                  }
                  sx={{
                    backgroundColor: "#e8f0ff",
                    color: "#0f3eb5",
                    fontFamily: "Century Gothic, sans-serif",
                    fontSize: "0.72rem",
                    cursor: isClickable ? "pointer" : "default",
                    "&:hover": isClickable ? { backgroundColor: "#d0e0ff" } : {},
                  }}
                />
              );
            })
          )}
        </Box>

        {eventData.tags && eventData.tags.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {eventData.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  backgroundColor: "#f0f4ff",
                  color: "#0f3eb5",
                  border: "1px solid #dce6f9",
                  fontFamily: "Century Gothic, sans-serif",
                  fontSize: "0.72rem",
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Popover>
  );
}
