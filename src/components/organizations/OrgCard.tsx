import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { components } from "../../api/schema";
import { getOrgAvatarSvgDataUri } from "../../utils/orgAvatarSvg";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];

interface OrgCardProps {
  org: OrganizationDTO;
  leaders: string[];
  onClick: () => void;
  imageUrl?: string;
}

export default function OrgCard({ org, leaders, onClick, imageUrl }: OrgCardProps) {
  const { t } = useTranslation();
  const fallbackAvatarUrl = getOrgAvatarSvgDataUri(org.name ?? "");
  const previewUrl = imageUrl ?? fallbackAvatarUrl;

  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: "24px",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        height: { xs: 120, sm: 140 },
        maxHeight: { xs: 120, sm: 140 },
        cursor: "pointer",
        boxShadow: "0 2px 12px rgba(15,62,181,0.10)",
        transition: "box-shadow 0.2s, transform 0.15s",
        "&:hover": {
          boxShadow: "0 6px 24px rgba(15,62,181,0.18)",
          transform: "translateY(-2px)",
        },
        bgcolor: "#fff",
        border: "1px solid #dce6f9",
      }}
    >
      {/* Text content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          px: 4,
          py: 3,
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            fontSize: { xs: "1.3rem", sm: "1.6rem" },
            color: "#0f3eb5",
            mb: 0.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {org.name}
        </Typography>
        {leaders.length > 0 && (
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.9rem",
              color: "#7795de",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t("organizations.card.organizers")}: {leaders.join(", ")}
          </Typography>
        )}
      </Box>

      {/* Image with fade mask on left edge */}
      <Box
        sx={{
          width: { xs: 120, sm: 180, md: 240 },
          height: "100%",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#e8f0ff",
        }}
      >
        {/* Fade mask */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "60%",
            background: "linear-gradient(to right, #fff 0%, transparent 100%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
        <Box
          component="img"
          src={previewUrl}
          alt={org.name}
          onError={(event) => {
            event.currentTarget.src = fallbackAvatarUrl;
          }}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            display: "block",
          }}
        />
      </Box>
    </Box>
  );
}
