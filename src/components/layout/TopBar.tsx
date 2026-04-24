import { useState } from "react";
import { Avatar, Badge, Box, Button, Divider, ListItemIcon, Menu, MenuItem, Typography } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useOrganization } from "../../hooks/useOrganization";
import OrgSwitcherDropdown from "./OrgSwitcherDropdown";

interface TopBarProps {
  unreadCount: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TopBar({ unreadCount }: TopBarProps) {
  const { t } = useTranslation();
  const { profile, avatarUrl, logout } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const name = profile?.name ?? "";
  const initials = name ? getInitials(name) : "";

  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  const [orgAnchor, setOrgAnchor] = useState<null | HTMLElement>(null);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleProfile = () => {
    handleClose();
    navigate("/settings");
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate("/");
  };

  return (
    <Box
      sx={{
        height: 64,
        background: "linear-gradient(to right, #0f3eb5, #7795de 40%, #dce6f9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        px: 3,
        gap: 2,
      }}
    >
      {currentOrganization && (
        <Button
          onClick={(e) => setOrgAnchor(e.currentTarget)}
          sx={{
            mr: "auto",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            fontSize: "0.95rem",
            color: "#fff",
            textTransform: "none",
            bgcolor: "rgba(255,255,255,0.15)",
            borderRadius: 3,
            px: 2,
            "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
          }}
        >
          <Box
            component={Link}
            to="/organizations"
            onClick={(e) => e.stopPropagation()}
            sx={{
              color: "inherit",
              textDecoration: "none",
              mr: 0.5,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {currentOrganization.name}
          </Box>
          ▾
        </Button>
      )}

      <OrgSwitcherDropdown anchorEl={orgAnchor} onClose={() => setOrgAnchor(null)} />

      <Badge badgeContent={unreadCount} color="error" showZero={false}>
        <NotificationsIcon sx={{ color: "#fff" }} />
      </Badge>

      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          color: "#0f3eb5",
          fontSize: "1.1rem",
          fontWeight: 700,
        }}
      >
        {name}
      </Typography>

      <Avatar
        src={avatarUrl ?? undefined}
        onClick={handleOpen}
        sx={{
          width: 36,
          height: 36,
          bgcolor: "rgba(15,62,181,0.5)",
          fontSize: "0.9rem",
          cursor: "pointer",
          transition: "opacity 0.2s",
          "&:hover": { opacity: 0.85 },
        }}
      >
        {initials}
      </Avatar>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              mt: 1,
              minWidth: 180,
              borderRadius: 2,
              overflow: "visible",
              "&::before": {
                content: '""',
                display: "block",
                position: "absolute",
                top: -6,
                right: 14,
                width: 12,
                height: 12,
                bgcolor: "background.paper",
                transform: "rotate(45deg)",
                zIndex: 0,
              },
            },
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <PersonIcon fontSize="small" sx={{ color: "#0f3eb5" }} />
          </ListItemIcon>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem" }}>
            {t("user.profile")}
          </Typography>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: "error.main" }} />
          </ListItemIcon>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", color: "error.main" }}>
            {t("user.logout")}
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
