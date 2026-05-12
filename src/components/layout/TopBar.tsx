import { useState } from "react";
import { Avatar, Badge, Box, Button, Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography, useMediaQuery, useTheme } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AddIcon from "@mui/icons-material/Add";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useOrganization } from "../../hooks/useOrganization";
import { useOrgMemberContext } from "../../hooks/useOrgMemberContext";
import OrgSwitcherDropdown from "./OrgSwitcherDropdown";
import NotificationsDropdown from "./NotificationsDropdown";
import WriteInfoMessageDialog from "../organizations/WriteInfoMessageDialog";
import { useMobileActionValue } from "../../context/MobileActionContext";

interface TopBarProps {
  unreadCount: number;
}

function CalendarPlusIcon({ fontSize = 22 }: { fontSize?: number }) {
  return (
    <Box sx={{ position: "relative", width: fontSize, height: fontSize, display: "flex" }}>
      <CalendarMonthIcon sx={{ fontSize }} />
      <AddIcon
        sx={{
          fontSize: fontSize * 0.55,
          position: "absolute",
          bottom: -2,
          right: -3,
          bgcolor: "currentColor",
          color: "inherit",
          borderRadius: "50%",
          background: "transparent",
          stroke: "currentColor",
          strokeWidth: 1,
        }}
      />
    </Box>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TopBar({ unreadCount }: TopBarProps) {
  const { t } = useTranslation();
  const { profile, avatarUrl, logout } = useAuth();
  const { organizations, currentOrganization } = useOrganization();
  const hasOrganizations = organizations.length > 0;
  const navigate = useNavigate();
  const name = profile?.name ?? "";
  const initials = name ? getInitials(name) : "";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const mobileAction = useMobileActionValue();

  const orgId = currentOrganization?.id ?? 0;
  const { permissions: orgPermissions, role: orgRole } = useOrgMemberContext(orgId);
  const hasWriteInfoAccess = orgPermissions.has("ORG_WRITE_INFO") || orgRole !== undefined;

  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  const [orgAnchor, setOrgAnchor] = useState<null | HTMLElement>(null);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [writeMessageOpen, setWriteMessageOpen] = useState(false);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleProfile = () => {
    handleClose();
    navigate("/profile");
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
        px: { xs: 1.5, md: 3 },
        gap: { xs: 1, md: 2 },
      }}
    >
      {/* Logo — visible on mobile only (sidebar is hidden) */}
      {isMobile && (
        <Box
          component={Link}
          to="/organizations"
          sx={{ display: "flex", alignItems: "center", gap: 0.75, mr: "auto", textDecoration: "none" }}
        >
          <img src="/img/logo_white.svg" alt="logo" style={{ height: 36 }} />
          <Box
            component="span"
            sx={{
              fontFamily: "cs-mollwish-2, sans-serif",
              color: "#fff",
              fontSize: "1.1rem",
              letterSpacing: 2,
            }}
          >
            ORKESTRO
          </Box>
        </Box>
      )}

      {/* Desktop: org-switcher button */}
      {!isMobile && hasOrganizations && currentOrganization && (
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

      {/* Mobile: page-registered action button (e.g. add item) — left of create-event */}
      {isMobile && mobileAction && (
        <IconButton
          onClick={mobileAction.onClick}
          aria-label={mobileAction.ariaLabel}
          sx={{
            color: "#fff",
            minWidth: 44,
            minHeight: 44,
            bgcolor: "#0f3eb5",
            border: "1.5px solid rgba(255,255,255,0.4)",
            borderRadius: 2,
            "&:hover": { bgcolor: "#0c34a0" },
          }}
        >
          {mobileAction.icon}
        </IconButton>
      )}

      {/* Create event button — full text on desktop, icon-only on mobile */}
      {hasOrganizations && currentOrganization && (
        <>
          {!isMobile && (
            <Button
              variant="contained"
              startIcon={<CalendarPlusIcon fontSize={20} />}
              onClick={() => navigate(`/organizations/${currentOrganization.id}/events/create`)}
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                textTransform: "none",
                bgcolor: "#0f3eb5",
                color: "#fff",
                borderRadius: 2,
                boxShadow: "none",
                border: "1.5px solid rgba(255,255,255,0.4)",
                px: 2,
                "&:hover": { bgcolor: "#0c34a0", boxShadow: "none" },
              }}
            >
              {t("schedule.createEvent")}
            </Button>
          )}
          {isMobile && (
            <IconButton
              onClick={() => navigate(`/organizations/${currentOrganization.id}/events/create`)}
              aria-label={t("schedule.createEvent")}
              sx={{
                color: "#fff",
                minWidth: 44,
                minHeight: 44,
                bgcolor: "#0f3eb5",
                border: "1.5px solid rgba(255,255,255,0.4)",
                borderRadius: 2,
                "&:hover": { bgcolor: "#0c34a0" },
              }}
            >
              <CalendarPlusIcon fontSize={22} />
            </IconButton>
          )}
        </>
      )}

      {/* Desktop: write info message button */}
      {!isMobile && hasOrganizations && currentOrganization && hasWriteInfoAccess && (
        <IconButton
          onClick={() => setWriteMessageOpen(true)}
          sx={{
            bgcolor: "transparent",
            color: "#fff",
            minWidth: 44,
            minHeight: 44,
            "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
          }}
        >
          <EditNoteIcon sx={{ color: "#0f3eb5", fontSize: 26 }} />
        </IconButton>
      )}

      {/* Desktop: notifications bell */}
      {!isMobile && (
        <IconButton
          onClick={(e) => setNotifAnchor(e.currentTarget)}
          sx={{
            bgcolor: "transparent",
            color: "#fff",
            minWidth: 44,
            minHeight: 44,
            "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
          }}
        >
          <Badge badgeContent={unreadCount} color="error" showZero={false}>
            <NotificationsIcon sx={{ color: "#0f3eb5" }} />
          </Badge>
        </IconButton>
      )}

      <NotificationsDropdown anchorEl={notifAnchor} onClose={() => setNotifAnchor(null)} />

      {hasOrganizations && currentOrganization && (
        <WriteInfoMessageDialog
          open={writeMessageOpen}
          onClose={() => setWriteMessageOpen(false)}
          organizationId={currentOrganization.id ?? 0}
        />
      )}

      {/* Name — hidden on mobile */}
      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          color: "#0f3eb5",
          fontSize: "1.1rem",
          fontWeight: 700,
          display: { xs: "none", md: "block" },
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
        disableAutoFocusItem
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
        <MenuItem onClick={handleProfile} sx={{ borderRadius: "8px 8px 0 0" }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" sx={{ color: "#0f3eb5" }} />
          </ListItemIcon>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem" }}>
            {t("user.profile")}
          </Typography>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleLogout} sx={{ borderRadius: "0 0 8px 8px" }}>
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
