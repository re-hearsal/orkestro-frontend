import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, CircularProgress, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import PersonIcon from "@mui/icons-material/Person";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { isBlobUrl, toRenderableImageSource } from "../../utils/imageSource";
import { getLocalizedRoleName } from "../../utils/roleNameI18n";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

export interface OrgMemberCardData {
  id?: number;
  name?: string;
  birthDate?: string;
  profileImageFileId?: number;
  instruments: string[];
  role?: { id: number; name: string };
}

interface OrgMemberCardProps {
  member: OrgMemberCardData;
  organizationId?: number;
  canAssignRole?: boolean;
  availableRoles?: TechnicalRoleDTO[];
}

export default function OrgMemberCard({
  member,
  organizationId,
  canAssignRole = false,
  availableRoles = [],
}: OrgMemberCardProps) {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());

  const [currentRole, setCurrentRole] = useState<{ id: number; name: string } | undefined>(
    member.role
  );
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    const revoke = () => {
      if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };

    if (!user || member.profileImageFileId == null) {
      revoke();
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;

    const loadAvatar = async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: member.profileImageFileId as number } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });

        if (cancelled || !data) {
          return;
        }

        revoke();
        const nextUrl = await toRenderableImageSource(data as unknown as Blob);
        objectUrlRef.current = nextUrl;

        if (!cancelled) {
          setAvatarUrl(nextUrl);
        }
      } catch {
        if (!cancelled) {
          revoke();
          setAvatarUrl(null);
        }
      }
    };

    void loadAvatar();

    return () => {
      cancelled = true;
      revoke();
    };
  }, [member.profileImageFileId, user]);

  const formattedBirthDate = useMemo(() => {
    if (!member.birthDate) {
      return "";
    }

    const parsed = new Date(member.birthDate);
    if (Number.isNaN(parsed.getTime())) {
      return member.birthDate;
    }

    return parsed.toLocaleDateString(i18n.language === "ru" ? "ru-RU" : "en-GB");
  }, [i18n.language, member.birthDate]);

  const nonSystemRoles = useMemo(
    () => availableRoles.filter((r) => r.system !== true),
    [availableRoles]
  );

  const otherRoles = useMemo(
    () => nonSystemRoles.filter((r) => r.id !== currentRole?.id),
    [nonSystemRoles, currentRole]
  );

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (!canAssignRole || !organizationId || !member.id) return;
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const extractErrorMessage = (err: unknown): string => {
    if (err && typeof err === "object") {
      if ("message" in err && typeof (err as Record<string, unknown>).message === "string") {
        return (err as Record<string, unknown>).message as string;
      }
    }
    return String(t("organizations.members.loadError"));
  };

  const handleAssignRole = async (role: TechnicalRoleDTO) => {
    if (!user || !organizationId || !member.id || !role.id) return;
    handleMenuClose();
    setRoleLoading(true);
    try {
      if (currentRole) {
        const { error: deleteError } = await client.DELETE(
          "/api/v1/organizations/{organizationId}/members/{userId}/roles/{roleId}",
          {
            params: {
              path: { organizationId, userId: member.id, roleId: currentRole.id },
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (deleteError) throw deleteError;
      }
      const { error: postError } = await client.POST(
        "/api/v1/organizations/{organizationId}/members/{userId}/roles/{roleId}",
        {
          params: {
            path: { organizationId, userId: member.id, roleId: role.id },
          },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (postError) throw postError;
      setCurrentRole({ id: role.id, name: role.name ?? "" });
      showAlert(String(t("organizations.members.roleAssigned")), "success");
    } catch (err) {
      showAlert(extractErrorMessage(err), "warning");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!user || !organizationId || !member.id || !currentRole) return;
    handleMenuClose();
    setRoleLoading(true);
    try {
      const { error: deleteError } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/members/{userId}/roles/{roleId}",
        {
          params: {
            path: { organizationId, userId: member.id, roleId: currentRole.id },
          },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (deleteError) throw deleteError;
      setCurrentRole(undefined);
      showAlert(String(t("organizations.members.roleRemoved")), "success");
    } catch (err) {
      showAlert(extractErrorMessage(err), "warning");
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: "50px",
        border: "1px solid #7795de",
        backgroundColor: "#ffffff",
        px: 1.5,
        py: 0.85,
        display: "flex",
        alignItems: "center",
        gap: 1,
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          minWidth: 44,
          borderRadius: "50%",
          overflow: "hidden",
          border: "1px solid #7795de",
          backgroundColor: "#e8f0ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {avatarUrl ? (
          <Box
            component="img"
            src={avatarUrl}
            alt={member.name ?? ""}
            onError={() => setAvatarUrl(null)}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <PersonIcon sx={{ color: "#7795de" }} />
        )}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#0f3eb5",
            fontWeight: 700,
            fontSize: "0.92rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {member.name ?? ""}
        </Typography>

        {formattedBirthDate && (
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              color: "#7795de",
              fontSize: "0.7rem",
            }}
          >
            {formattedBirthDate}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        {member.instruments.map((instrumentName) => {
          const iconKey = instrumentName.trim().toLowerCase();
          const iconFailed = failedIcons.has(iconKey);

          return (
            <Box
              key={`${member.id ?? member.name}-${instrumentName}`}
              sx={{
                width: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0f3eb5",
              }}
            >
              {iconFailed ? (
                <MusicNoteIcon sx={{ fontSize: 15 }} />
              ) : (
                <Box
                  component="img"
                  src={`/icons/${instrumentName}.svg`}
                  alt={instrumentName}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    setFailedIcons((prev) => {
                      const next = new Set(prev);
                      next.add(iconKey);
                      return next;
                    });
                  }}
                  sx={{ width: 15, height: 15, objectFit: "contain", display: "block" }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {roleLoading && (
        <CircularProgress size={18} sx={{ color: "#7795de", flexShrink: 0 }} />
      )}

      {!roleLoading && (
        <>
          {currentRole ? (
            <Chip
              label={getLocalizedRoleName(currentRole.name, t)}
              size="small"
              onClick={canAssignRole && organizationId && member.id ? handleMenuOpen : undefined}
              sx={{
                borderRadius: "24px",
                border: "1px solid #7795de",
                backgroundColor: "#ffffff",
                color: "#7795de",
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 600,
                flexShrink: 0,
                cursor: canAssignRole && organizationId && member.id ? "pointer" : "default",
                "&:hover": canAssignRole && organizationId && member.id
                  ? { backgroundColor: "rgba(119,149,222,0.1)" }
                  : {},
              }}
            />
          ) : (
            canAssignRole && organizationId && member.id && (
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                title={String(t("organizations.members.assignRole"))}
                sx={{ color: "#7795de", flexShrink: 0, p: 0.25 }}
              >
                <AddCircleOutlineIcon fontSize="small" />
              </IconButton>
            )
          )}

          {canAssignRole && organizationId && member.id && (
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={handleMenuClose}
              slotProps={{
                paper: { sx: { borderRadius: "12px", minWidth: 160 } },
              }}
            >
              {otherRoles.map((role) => (
                <MenuItem
                  key={role.id}
                  onClick={() => void handleAssignRole(role)}
                  sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem" }}
                >
                  {getLocalizedRoleName(role.name, t)}
                </MenuItem>
              ))}

              {currentRole && (
                <MenuItem
                  onClick={() => void handleRemoveRole()}
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    fontSize: "0.88rem",
                    color: "error.main",
                  }}
                >
                  {t("organizations.members.removeRole")}
                </MenuItem>
              )}

              {otherRoles.length === 0 && !currentRole && (
                <MenuItem disabled sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.85rem" }}>
                  {t("organizations.members.assignRole")}
                </MenuItem>
              )}
            </Menu>
          )}
        </>
      )}
    </Box>
  );
}
