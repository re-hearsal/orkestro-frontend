import { useState } from "react";
import { Avatar, Badge, Box, Button, Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
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
  const { organizations, currentOrganization } = useOrganization();
  const hasOrganizations = organizations.length > 0;
  const navigate = useNavigate();
  const name = profile?.name ?? "";
  const initials = name ? getInitials(name) : "";

  const orgId = currentOrganization?.id ?? 0;
  const { permissions: orgPermissions, role: orgRole } = useOrgMemberContext(orgId);
  // Button is shown to any org member — dialog filters writable targets by actual permissions.
  // ORG_WRITE_INFO is org-level; SECTION_WRITE_INFO is section-level (not in orgPermissions),
  // so we show the button whenever the user has any role in the org.
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
        px: 3,
        gap: 2,
      }}
    >
      {hasOrganizations && currentOrganization && (
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

      {hasOrganizations && currentOrganization && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
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

      {hasOrganizations && currentOrganization && hasWriteInfoAccess && (
        <IconButton
          onClick={() => setWriteMessageOpen(true)}
          sx={{
            bgcolor: "transparent",
            color: "#fff",
            "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            p: 0.5,
          }}
        >
          <EditNoteIcon sx={{ color: "#0f3eb5", fontSize: 26 }} />
        </IconButton>
      )}

      <IconButton
        onClick={(e) => setNotifAnchor(e.currentTarget)}
        sx={{
          bgcolor: "transparent",
          color: "#fff",
          "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
          p: 0.5,
        }}
      >
        <Badge badgeContent={unreadCount} color="error" showZero={false}>
          <NotificationsIcon sx={{ color: "#0f3eb5" }} />
        </Badge>
      </IconButton>

      <NotificationsDropdown anchorEl={notifAnchor} onClose={() => setNotifAnchor(null)} />

      {hasOrganizations && currentOrganization && (
        <WriteInfoMessageDialog
          open={writeMessageOpen}
          onClose={() => setWriteMessageOpen(false)}
          organizationId={currentOrganization.id ?? 0}
        />
      )}

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
