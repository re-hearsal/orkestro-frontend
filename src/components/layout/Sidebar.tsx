import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import LanguageIcon from "@mui/icons-material/Language";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useOrgMemberContext } from "../../hooks/useOrgMemberContext";
import { useOrganization } from "../../hooks/useOrganization";
import {
  JOIN_REQUESTS_UPDATED_EVENT,
  type JoinRequestsUpdatedDetail,
} from "../../utils/joinRequestsEvents";

const textSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontSize: "0.98rem",
  lineHeight: 1.1,
  fontWeight: 600,
  color: "#fff",
};

const itemIconSx = {
  minWidth: 30,
  color: "#fff",
};

function parsePendingCount(raw: unknown): number {
  let source = raw;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return 0;
    }
  }

  return Array.isArray(source) ? source.length : 0;
}

export default function Sidebar() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const currentOrganizationId = currentOrganization?.id ?? 0;
  const activeOrganizationId = currentOrganization?.id ?? null;
  const userToken = user?.token ?? null;

  const {
    permissions,
    loading: memberContextLoading,
    initialized: memberContextInitialized,
    error: memberContextError,
  } = useOrgMemberContext(currentOrganizationId);
  const canViewJoinRequests =
    activeOrganizationId !== null && permissions.has("ORG_JOIN_REQUEST_VIEW");
  const canViewFund =
    activeOrganizationId !== null &&
    memberContextInitialized &&
    !memberContextLoading &&
    memberContextError == null;

  const [pendingJoinRequestsCount, setPendingJoinRequestsCount] = useState(0);

  const loadPendingJoinRequestsCount = useCallback(async () => {
    if (!userToken || !canViewJoinRequests || activeOrganizationId === null) {
      return;
    }

    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/join-requests/pending",
        {
          params: { path: { organizationId: activeOrganizationId } },
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );

      if (error) {
        setPendingJoinRequestsCount(0);
        return;
      }

      setPendingJoinRequestsCount(parsePendingCount(data));
    } catch {
      setPendingJoinRequestsCount(0);
    }
  }, [activeOrganizationId, canViewJoinRequests, userToken]);

  useEffect(() => {
    if (!canViewJoinRequests) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPendingJoinRequestsCount();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canViewJoinRequests, loadPendingJoinRequestsCount]);

  useEffect(() => {
    if (!canViewJoinRequests || activeOrganizationId === null) {
      return;
    }

    const handleJoinRequestUpdate = (event: Event) => {
      const detail = (event as CustomEvent<JoinRequestsUpdatedDetail>).detail;

      if (detail?.organizationId !== undefined && detail.organizationId !== activeOrganizationId) {
        return;
      }

      if (typeof detail?.pendingCount === "number") {
        setPendingJoinRequestsCount(Math.max(0, detail.pendingCount));
        return;
      }

      void loadPendingJoinRequestsCount();
    };

    window.addEventListener(JOIN_REQUESTS_UPDATED_EVENT, handleJoinRequestUpdate as EventListener);

    return () => {
      window.removeEventListener(JOIN_REQUESTS_UPDATED_EVENT, handleJoinRequestUpdate as EventListener);
    };
  }, [activeOrganizationId, canViewJoinRequests, loadPendingJoinRequestsCount]);

  const joinRequestsPath = activeOrganizationId
    ? `/organizations/${activeOrganizationId}/join-requests`
    : "/organizations";

  const isJoinRequestsRoute = useMemo(
    () => location.pathname.includes("/join-requests"),
    [location.pathname]
  );

  const isFundRoute = useMemo(
    () => location.pathname.includes("/fund"),
    [location.pathname]
  );

  const isRepertoireRoute = useMemo(
    () => location.pathname.includes("/repertoire"),
    [location.pathname]
  );

  const fundPath = activeOrganizationId
    ? `/organizations/${activeOrganizationId}/fund`
    : "/organizations";

  const repertoirePath = activeOrganizationId
    ? `/organizations/${activeOrganizationId}/repertoire`
    : "/organizations";

  const isActive = (path: string) => location.pathname.startsWith(path);

  const topItemSx = (active: boolean) => ({
    borderRadius: "8px",
    minHeight: 32,
    py: 0.25,
    px: 1,
    color: "#fff",
    ...(active && { backgroundColor: "rgba(255,255,255,0.15)" }),
    "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
  });

  const bottomItemSx = (active: boolean) => ({
    borderRadius: "8px",
    mb: 0.15,
    minHeight: 32,
    py: 0.25,
    px: 1,
    color: "#fff",
    ...(active && { backgroundColor: "rgba(255,255,255,0.15)" }),
    "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
  });

  return (
    <Box
      sx={{
        width: 220,
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        background: "#0f3eb5",
        display: "flex",
        flexDirection: "column",
        pt: 2,
        pb: 0.6,
        px: 1.5,
      }}
    >
      {/* Logo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3, px: 1 }}>
        <img src="/img/logo_white.svg" alt="logo" style={{ height: 48 }} />
        <Box
          component="span"
          sx={{
            fontFamily: "cs-mollwish-2, sans-serif",
            color: "#fff",
            fontSize: "1.6rem",
            letterSpacing: 2,
          }}
        >
          ORKESTRO
        </Box>
      </Box>

      {/* All nav items in one list */}
      <List disablePadding sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <Box sx={{ height: "50%", display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
            <ListItemButton
              component={Link}
              to="/organizations"
              sx={topItemSx(isActive("/organizations") && !isJoinRequestsRoute && !isFundRoute && !isRepertoireRoute)}
            >
            <ListItemIcon sx={itemIconSx}>
              <GroupsIcon />
            </ListItemIcon>
            <ListItemText sx={{ my: 0 }} primary={t("nav.organizations")} slotProps={{ primary: { sx: textSx } }} />
          </ListItemButton>

          {canViewJoinRequests && (
            <ListItemButton component={Link} to={joinRequestsPath} sx={topItemSx(isJoinRequestsRoute)}>
              <ListItemIcon sx={itemIconSx}>
                <Badge
                  badgeContent={pendingJoinRequestsCount}
                  color="error"
                  overlap="circular"
                  showZero={false}
                >
                  <GroupAddIcon />
                </Badge>
              </ListItemIcon>
              <ListItemText sx={{ my: 0 }} primary={t("sidebar.joinRequests")} slotProps={{ primary: { sx: textSx } }} />
            </ListItemButton>
          )}

          {canViewFund && (
            <ListItemButton component={Link} to={fundPath} sx={topItemSx(isFundRoute)}>
              <ListItemIcon sx={itemIconSx}>
                <AccountBalanceWalletIcon />
              </ListItemIcon>
              <ListItemText sx={{ my: 0 }} primary={t("sidebar.fund")} slotProps={{ primary: { sx: textSx } }} />
            </ListItemButton>
          )}

          {activeOrganizationId !== null && (
            <ListItemButton component={Link} to={repertoirePath} sx={topItemSx(isRepertoireRoute)}>
              <ListItemIcon sx={itemIconSx}>
                <LibraryMusicIcon />
              </ListItemIcon>
              <ListItemText sx={{ my: 0 }} primary={t("sidebar.repertoire")} slotProps={{ primary: { sx: textSx } }} />
            </ListItemButton>
          )}

          <ListItemButton component={Link} to="/calendar" sx={topItemSx(isActive("/calendar"))}>
            <ListItemIcon sx={itemIconSx}>
              <CalendarMonthIcon />
            </ListItemIcon>
            <ListItemText sx={{ my: 0 }} primary={t("nav.calendar")} slotProps={{ primary: { sx: textSx } }} />
          </ListItemButton>
        </Box>

        <Box sx={{ mt: "auto" }}>
          <ListItemButton component={Link} to="/settings" sx={bottomItemSx(isActive("/settings"))}>
            <ListItemIcon sx={itemIconSx}>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText sx={{ my: 0 }} primary={t("nav.settings")} slotProps={{ primary: { sx: textSx } }} />
          </ListItemButton>

          <ListItemButton
            onClick={() => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru")}
            sx={{ ...bottomItemSx(false), mb: 0 }}
          >
            <ListItemIcon sx={itemIconSx}>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText sx={{ my: 0 }} primary={t("language.current")} slotProps={{ primary: { sx: textSx } }} />
          </ListItemButton>
        </Box>
      </List>
    </Box>
  );
}
