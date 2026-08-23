import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useOrgMemberContext } from "../../hooks/useOrgMemberContext";
import { useOrganization } from "../../hooks/useOrganization";
import { withFlatPagination } from "../../utils/pagination";
import {
  JOIN_REQUESTS_UPDATED_EVENT,
  type JoinRequestsUpdatedDetail,
} from "../../utils/joinRequestsEvents";
import { NAV_ITEMS, type NavItemDef } from "./navItems";

type SectionDTO = components["schemas"]["SectionDTO"];

interface PagedModelLike {
  content?: unknown[];
}

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
  const { organizations, currentOrganization } = useOrganization();
  const hasOrganizations = organizations.length > 0;

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
  const [mySections, setMySections] = useState<SectionDTO[]>([]);
  const [sectionsExpanded, setSectionsExpanded] = useState(false);

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
    void Promise.resolve().then(() => setSectionsExpanded(false));
  }, [activeOrganizationId]);

  useEffect(() => {
    if (!userToken || activeOrganizationId === null || !user?.username) {
      return;
    }

    let cancelled = false;

    const loadMySections = async () => {
      try {
        const { data, error } = await client.GET("/api/v1/organizations/{organizationId}/sections", {
          params: { path: { organizationId: activeOrganizationId } },
          headers: { Authorization: `Bearer ${userToken}` },
        });

        if (error || !Array.isArray(data)) {
          if (!cancelled) {
            setMySections([]);
          }
          return;
        }

        const sections = data as SectionDTO[];

        const membershipFlags = await Promise.all(
          sections.map(async (section) => {
            if (typeof section.id !== "number") {
              return false;
            }

            const query = withFlatPagination(
              { query: user.username },
              { page: 0, size: 1 }
            ) as unknown as {
              query?: string;
              pageable: components["schemas"]["Pageable"];
            };

            const { data: membersData, error: membersError } = await client.GET(
              "/api/v1/sections/{sectionId}/members/page",
              {
                params: { path: { sectionId: section.id }, query },
                headers: { Authorization: `Bearer ${userToken}` },
              }
            );

            if (membersError) {
              return false;
            }

            const paged = (membersData as unknown as PagedModelLike) ?? {};
            return Array.isArray(paged.content) && paged.content.length > 0;
          })
        );

        if (!cancelled) {
          setMySections(sections.filter((_, index) => membershipFlags[index]));
        }
      } catch {
        if (!cancelled) {
          setMySections([]);
        }
      }
    };

    void loadMySections();

    return () => {
      cancelled = true;
      setMySections([]);
    };
  }, [activeOrganizationId, user?.username, userToken]);

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

  const isTasksRoute = useMemo(
    () => location.pathname.includes("/tasks"),
    [location.pathname]
  );

  const isScheduleRoute = useMemo(
    () => location.pathname.includes("/schedule"),
    [location.pathname]
  );

  const isSectionsRoute = useMemo(
    () => location.pathname.includes("/sections"),
    [location.pathname]
  );

  const isFeedbackRoute = useMemo(
    () => location.pathname.includes("/feedback"),
    [location.pathname]
  );

  const visibleSections = sectionsExpanded ? mySections : mySections.slice(0, 3);
  const hiddenSectionsCount = Math.max(0, mySections.length - 3);

  const activeForKey: Record<string, boolean> = {
    organizations:
      location.pathname.startsWith("/organizations") &&
      !isJoinRequestsRoute &&
      !isFundRoute &&
      !isRepertoireRoute &&
      !isSectionsRoute &&
      !isScheduleRoute &&
      !isFeedbackRoute,
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
      {return false;}
    if (item.requiresFund && !canViewFund) {return false;}
    if (item.requiresJoinRequestView && !canViewJoinRequests) {return false;}
    return true;
  };

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

  const nestedItemSx = (active: boolean) => ({
    borderRadius: "8px",
    minHeight: 28,
    py: 0.15,
    px: 1,
    pl: 2,
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
        display: { xs: "none", md: "flex" },
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
            whiteSpace: "nowrap",
          }}
        >
          ORKESTRO
        </Box>
      </Box>

      <List disablePadding sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <Box sx={{ height: "50%", display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
          {NAV_ITEMS.filter((item) => !item.isBottom).map((item) => {
            if (!isVisible(item)) {return null;}
            const path = item.getPath(activeOrganizationId);
            const active = activeForKey[item.key] ?? false;

            return (
              <Fragment key={item.key}>
                <ListItemButton component={Link} to={path} sx={topItemSx(active)}>
                  <ListItemIcon sx={itemIconSx}>
                    <item.icon />
                  </ListItemIcon>
                  <ListItemText
                    sx={{ my: 0 }}
                    primary={t(item.labelKey)}
                    slotProps={{ primary: { sx: textSx } }}
                  />
                </ListItemButton>

                {item.key === "sections" && (
                  <>
                    {visibleSections.map((section) => {
                      if (section.id == null) {return null;}
                      const sectionPath = `/organizations/${activeOrganizationId}/sections/${section.id}`;
                      const sectionActive = location.pathname.startsWith(sectionPath);
                      return (
                        <ListItemButton
                          key={section.id}
                          component={Link}
                          to={sectionPath}
                          sx={nestedItemSx(sectionActive)}
                        >
                          <ListItemText
                            sx={{ my: 0 }}
                            primary={section.name ?? `#${section.id}`}
                            slotProps={{
                              primary: {
                                sx: { ...textSx, fontSize: "0.82rem", fontWeight: 500 },
                              },
                            }}
                          />
                        </ListItemButton>
                      );
                    })}

                    {hiddenSectionsCount > 0 && !sectionsExpanded && (
                      <ListItemButton
                        sx={nestedItemSx(false)}
                        onClick={() => setSectionsExpanded(true)}
                      >
                        <ListItemText
                          sx={{ my: 0 }}
                          primary={t("sections.showMore", { count: hiddenSectionsCount })}
                          slotProps={{
                            primary: {
                              sx: { ...textSx, fontSize: "0.8rem", fontWeight: 500, color: "#7795de" },
                            },
                          }}
                        />
                      </ListItemButton>
                    )}

                    {mySections.length > 3 && sectionsExpanded && (
                      <ListItemButton
                        sx={nestedItemSx(false)}
                        onClick={() => setSectionsExpanded(false)}
                      >
                        <ListItemText
                          sx={{ my: 0 }}
                          primary={t("sections.collapse")}
                          slotProps={{
                            primary: {
                              sx: { ...textSx, fontSize: "0.8rem", fontWeight: 500, color: "#7795de" },
                            },
                          }}
                        />
                      </ListItemButton>
                    )}
                  </>
                )}
              </Fragment>
            );
          })}
        </Box>

        {hasOrganizations && (
          <Box sx={{ mt: "auto" }}>
            {NAV_ITEMS.filter((item) => item.isBottom && isVisible(item)).map((item) => {
              const path = item.getPath(activeOrganizationId);
              const active = activeForKey[item.key] ?? false;
              const iconEl =
                item.key === "joinRequests" ? (
                  <Badge
                    badgeContent={pendingJoinRequestsCount}
                    color="error"
                    overlap="circular"
                    showZero={false}
                  >
                    <item.icon />
                  </Badge>
                ) : (
                  <item.icon />
                );

              return (
                <ListItemButton key={item.key} component={Link} to={path} sx={bottomItemSx(active)}>
                  <ListItemIcon sx={itemIconSx}>{iconEl}</ListItemIcon>
                  <ListItemText
                    sx={{ my: 0 }}
                    primary={t(item.labelKey)}
                    slotProps={{ primary: { sx: textSx } }}
                  />
                </ListItemButton>
              );
            })}

            <ListItemButton
              onClick={() => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru")}
              sx={{ ...bottomItemSx(false), mb: 0 }}
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
        )}
      </List>
    </Box>
  );
}
