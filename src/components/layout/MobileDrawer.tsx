import { useState } from "react";
import {
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LanguageIcon from "@mui/icons-material/Language";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrganization } from "../../hooks/useOrganization";
import { useOrgMemberContext } from "../../hooks/useOrgMemberContext";
import { useNotifications } from "../../hooks/useNotifications";
import OrgSwitcherDropdown from "./OrgSwitcherDropdown";
import NotificationsDropdown from "./NotificationsDropdown";
import WriteInfoMessageDialog from "../organizations/WriteInfoMessageDialog";
import { NAV_ITEMS, type NavItemDef } from "./navItems";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const DRAWER_BG = "#0f3eb5";

const textSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#fff",
};

const itemIconSx = { minWidth: 30, color: "#fff" };

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { organizations, currentOrganization } = useOrganization();
  const { unreadCount } = useNotifications();
  const hasOrganizations = organizations.length > 0;
  const activeOrganizationId = currentOrganization?.id ?? null;

  const {
    permissions,
    role,
    loading,
    initialized,
    error,
  } = useOrgMemberContext(activeOrganizationId ?? 0);

  const canViewFund =
    activeOrganizationId !== null && initialized && !loading && error == null;
  const canViewJoinRequests =
    activeOrganizationId !== null && permissions.has("ORG_JOIN_REQUEST_VIEW");
  const hasWriteInfoAccess =
    activeOrganizationId !== null &&
    (permissions.has("ORG_WRITE_INFO") || role !== undefined);

  const [orgAnchor, setOrgAnchor] = useState<null | HTMLElement>(null);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [writeMessageOpen, setWriteMessageOpen] = useState(false);

  const isSectionsRoute = location.pathname.includes("/sections");
  const isFundRoute = location.pathname.includes("/fund");
  const isRepertoireRoute = location.pathname.includes("/repertoire");
  const isTasksRoute = location.pathname.includes("/tasks");
  const isScheduleRoute = location.pathname.includes("/schedule");
  const isFeedbackRoute = location.pathname.includes("/feedback");
  const isJoinRequestsRoute = location.pathname.includes("/join-requests");

  const activeForKey: Record<string, boolean> = {
    organizations:
      location.pathname.startsWith("/organizations") &&
      !isJoinRequestsRoute &&
      !isFundRoute &&
      !isRepertoireRoute &&
      !isSectionsRoute &&
      !isScheduleRoute &&
      !isFeedbackRoute &&
      !isTasksRoute,
    schedule: isScheduleRoute,
    feedback: isFeedbackRoute,
    fund: isFundRoute,
    repertoire: isRepertoireRoute,
    tasks: isTasksRoute,
    sections: isSectionsRoute,
    joinRequests: isJoinRequestsRoute,
  };

  const isVisible = (item: NavItemDef): boolean => {
    if (item.requiresOrg && (!hasOrganizations || activeOrganizationId === null))
      return false;
    if (item.requiresFund && !canViewFund) return false;
    if (item.requiresJoinRequestView && !canViewJoinRequests) return false;
    return true;
  };

  const itemSx = (active: boolean) => ({
    borderRadius: "8px",
    minHeight: 44,
    py: 0.5,
    px: 1,
    color: "#fff",
    ...(active && { backgroundColor: "rgba(255,255,255,0.15)" }),
    "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
  });

  return (
    <>
      <Drawer
        variant="temporary"
        anchor="left"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              width: "min(280px, 85vw)",
              background: DRAWER_BG,
              display: "flex",
              flexDirection: "column",
              pt: 2,
              pb: 2,
              px: 1.5,
            },
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, px: 1 }}>
          <img src="/img/logo_white.svg" alt="logo" style={{ height: 40 }} />
          <Box
            component="span"
            sx={{
              fontFamily: "cs-mollwish-2, sans-serif",
              color: "#fff",
              fontSize: "1.4rem",
              letterSpacing: 2,
            }}
          >
            ORKESTRO
          </Box>
        </Box>

        {/* Org-switcher + notifications row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, mb: 1 }}>
          {hasOrganizations && currentOrganization ? (
            <Box
              component="button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                setOrgAnchor(e.currentTarget)
              }
              sx={{
                flex: 1,
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                fontSize: "0.88rem",
                py: 1,
                px: 1.5,
                textAlign: "left",
                cursor: "pointer",
                minHeight: 44,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                "&:hover": { background: "rgba(255,255,255,0.25)" },
              }}
            >
              {currentOrganization.name} ▾
            </Box>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}
          {hasOrganizations && currentOrganization && hasWriteInfoAccess && (
            <IconButton
              onClick={() => {
                setWriteMessageOpen(true);
                onClose();
              }}
              sx={{
                color: "#fff",
                minWidth: 44,
                minHeight: 44,
                "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
              }}
            >
              <EditNoteIcon />
            </IconButton>
          )}
          <IconButton
            onClick={(e) => setNotifAnchor(e.currentTarget)}
            sx={{
              color: "#fff",
              minWidth: 44,
              minHeight: 44,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
            }}
          >
            <Badge badgeContent={unreadCount} color="error" showZero={false}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", mb: 1 }} />

        {/* Nav links */}
        <List disablePadding sx={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            if (!isVisible(item)) return null;
            const path = item.getPath(activeOrganizationId);
            const active = activeForKey[item.key] ?? false;

            return (
              <ListItemButton
                key={item.key}
                component={Link}
                to={path}
                onClick={onClose}
                sx={itemSx(active)}
              >
                <ListItemIcon sx={itemIconSx}>
                  <item.icon />
                </ListItemIcon>
                <ListItemText
                  sx={{ my: 0 }}
                  primary={t(item.labelKey)}
                  slotProps={{ primary: { sx: textSx } }}
                />
              </ListItemButton>
            );
          })}
        </List>

        {/* Language switcher */}
        <Box sx={{ mt: "auto" }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", mb: 1 }} />
          <ListItemButton
            onClick={() =>
              i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru")
            }
            sx={itemSx(false)}
          >
            <ListItemIcon sx={itemIconSx}>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText
              sx={{ my: 0 }}
              primary={t("language.current")}
              slotProps={{ primary: { sx: textSx } }}
            />
          </ListItemButton>
        </Box>
      </Drawer>

      <OrgSwitcherDropdown
        anchorEl={orgAnchor}
        onClose={() => setOrgAnchor(null)}
      />
      <NotificationsDropdown
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
      />
      {hasOrganizations && currentOrganization && (
        <WriteInfoMessageDialog
          open={writeMessageOpen}
          onClose={() => setWriteMessageOpen(false)}
          organizationId={currentOrganization.id ?? 0}
        />
      )}
    </>
  );
}
