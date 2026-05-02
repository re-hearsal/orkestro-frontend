import { Avatar, Box, Typography } from "@mui/material";
import type { components } from "../../api/schema";

type SectionDTO = components["schemas"]["SectionDTO"];

interface SectionCardProps {
  section: SectionDTO;
  onClick: () => void;
  showAvatar?: boolean;
}

export default function SectionCard({ section, onClick, showAvatar = true }: SectionCardProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        borderRadius: "50px",
        border: "1px solid #7795de",
        backgroundColor: "#ffffff",
        px: 1.5,
        py: 0.85,
        cursor: "pointer",
        "&:hover": {
          backgroundColor: "rgba(119,149,222,0.08)",
        },
      }}
    >
      {showAvatar && (
        <Avatar sx={{ width: 32, height: 32, bgcolor: "#0f3eb5", fontSize: "0.85rem" }}>
          {section.name?.[0]?.toUpperCase() ?? "S"}
        </Avatar>
      )}
      <Typography
        sx={{
          fontSize: "0.92rem",
          fontWeight: 700,
          color: "#0f3eb5",
          fontFamily: "Century Gothic, sans-serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {section.name}
      </Typography>
    </Box>
  );
}
