import { Box, Typography } from "@mui/material";
import type { EventProps } from "react-big-calendar";
import type { CalendarEvent } from "./types";

export default function MonthEventCell({ event }: EventProps<CalendarEvent>) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
      <Typography
        component="span"
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#ffffff",
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.title}
      </Typography>
    </Box>
  );
}
