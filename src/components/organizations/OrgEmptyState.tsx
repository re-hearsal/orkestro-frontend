import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function OrgEmptyState() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        textAlign: "center",
        px: 4,
        py: 8,
        gap: 4,
      }}
    >
      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          fontSize: { xs: "1.4rem", sm: "1.8rem", md: "2.2rem" },
          color: "#0f3eb5",
          maxWidth: 600,
        }}
      >
        {t("organizations.emptyState.text")}
      </Typography>
      <Button
        variant="outlined"
        onClick={() => navigate("/organizations/create")}
        sx={{
          borderRadius: "24px",
          borderColor: "#0f3eb5",
          color: "#0f3eb5",
          bgcolor: "#fff",
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          px: 4,
          py: 1.2,
          textTransform: "none",
          "&:hover": {
            bgcolor: "#f0f4ff",
            borderColor: "#0f3eb5",
          },
        }}
      >
        {t("organizations.emptyState.createButton")}
      </Button>
    </Box>
  );
}
