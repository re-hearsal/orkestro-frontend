import { useEffect, useRef, useState, useMemo } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import PersonIcon from "@mui/icons-material/Person";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { isBlobUrl, toRenderableImageSource } from "../../utils/imageSource";
import { getLocalizedRoleName } from "../../utils/roleNameI18n";
import { navigateToUser } from "../../utils/navigateToUser";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

export interface SectionMemberCardData {
  id?: number;
  name?: string;
  birthDate?: string;
  profileImageFileId?: number;
  instruments: string[];
  role?: { id: number; name: string };
}

interface SectionMemberCardProps {
  member: SectionMemberCardData;
  sectionId: number;
  canAssignRole?: boolean;
  availableRoles?: TechnicalRoleDTO[];
  canRemoveMember?: boolean;
  currentUserId?: number;
  onMemberRemoved?: () => void;
}

export default function SectionMemberCard({
  member,
  sectionId,
  canAssignRole = false,
  availableRoles = [],
  canRemoveMember = false,
  currentUserId,
  onMemberRemoved,
}: SectionMemberCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [currentRole, setCurrentRole] = useState<{ id: number; name: string } | undefined>(member.role);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuAnchorUser, setMenuAnchorUser] = useState<HTMLElement | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const canOpenRoleMenu = canAssignRole && Boolean(member.id);

  useEffect(() => {
    setCurrentRole(member.role);
  }, [member.role]);

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
        if (cancelled || !data) return;
        revoke();
        const nextUrl = await toRenderableImageSource(data as unknown as Blob);
        objectUrlRef.current = nextUrl;
        if (!cancelled) setAvatarUrl(nextUrl);
      } catch {
        if (!cancelled) { revoke(); setAvatarUrl(null); }
      }
    };

    void loadAvatar();
    return () => { cancelled = true; revoke(); };
  }, [member.profileImageFileId, user]);

  const nonSystemRoles = useMemo(() => availableRoles.filter((r) => r.system !== true), [availableRoles]);
  const otherRoles = useMemo(() => nonSystemRoles.filter((r) => r.id !== currentRole?.id), [nonSystemRoles, currentRole]);

  const extractErrorMessage = (err: unknown): string => {
    if (err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string") {
      return (err as Record<string, unknown>).message as string;
    }
    return String(t("organizations.members.loadError"));
  };

  const handleUserClick = (event: React.MouseEvent<HTMLElement>) => {
    if (canRemoveMember) {
      setMenuAnchorUser(event.currentTarget);
    } else {
      navigateToUser(member.id, currentUserId, navigate);
    }
  };

  const handleAssignRole = async (role: TechnicalRoleDTO) => {
    if (!user || !member.id || !role.id) return;
    setMenuAnchor(null);
    setRoleLoading(true);
    try {
      if (currentRole) {
        const { error: deleteError } = await client.DELETE(
          "/api/v1/sections/{sectionId}/members/{userId}/roles/{roleId}",
          { params: { path: { sectionId, userId: member.id, roleId: currentRole.id } }, headers: { Authorization: `Bearer ${user.token}` } }
        );
        if (deleteError) throw deleteError;
      }
      const { error: postError } = await client.POST(
        "/api/v1/sections/{sectionId}/members/{userId}/roles/{roleId}",
        { params: { path: { sectionId, userId: member.id, roleId: role.id } }, headers: { Authorization: `Bearer ${user.token}` } }
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
    if (!user || !member.id || !currentRole) return;
    setMenuAnchor(null);
    setRoleLoading(true);
    try {
      const { error: deleteError } = await client.DELETE(
        "/api/v1/sections/{sectionId}/members/{userId}/roles/{roleId}",
        { params: { path: { sectionId, userId: member.id, roleId: currentRole.id } }, headers: { Authorization: `Bearer ${user.token}` } }
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

  const handleRemoveMember = async () => {
    if (!user || !member.id) return;
    setRemoving(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/sections/{sectionId}/members/{userId}",
        { params: { path: { sectionId, userId: member.id } }, headers: { Authorization: `Bearer ${user.token}` } }
      );
      if (error) throw error;
      setRemoveDialogOpen(false);
      setMenuAnchorUser(null);
      showAlert(String(t("organizations.members.removed")), "success");
      onMemberRemoved?.();
    } catch (err) {
      showAlert(extractErrorMessage(err), "warning");
    } finally {
      setRemoving(false);
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
        onClick={handleUserClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
          flex: 1,
          minWidth: 0,
          "&:hover": { backgroundColor: "rgba(15,62,181,0.06)" },
          borderRadius: "50px",
          px: 0.5,
        }}
      >
        <Box
          sx={{
            width: 44, height: 44, minWidth: 44,
            borderRadius: "50%", overflow: "hidden",
            border: "1px solid #7795de", backgroundColor: "#e8f0ff",
            display: "flex", alignItems: "center", justifyContent: "center",
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
        </Box>
      </Box>

      {roleLoading && <CircularProgress size={18} sx={{ color: "#7795de", flexShrink: 0 }} />}

      {!roleLoading && (
        <>
          {currentRole ? (
            <Chip
              label={getLocalizedRoleName(currentRole.name, t)}
              size="small"
              onClick={canOpenRoleMenu ? (e) => setMenuAnchor(e.currentTarget) : undefined}
              sx={{
                borderRadius: "24px",
                border: "1px solid #7795de",
                backgroundColor: "#ffffff",
                color: "#7795de",
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 600,
                flexShrink: 0,
                cursor: canOpenRoleMenu ? "pointer" : "default",
                "&:hover": canOpenRoleMenu ? { backgroundColor: "rgba(119,149,222,0.1)" } : {},
              }}
            />
          ) : (
            canOpenRoleMenu ? (
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                title={String(t("organizations.members.assignRole"))}
                sx={{ color: "#7795de", flexShrink: 0, minWidth: 44, minHeight: 44 }}
              >
                <AddCircleOutlineIcon fontSize="small" />
              </IconButton>
            ) : null
          )}

          {canOpenRoleMenu && (
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 160 } } }}
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
                  sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem", color: "error.main" }}
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

      <Menu
        anchorEl={menuAnchorUser}
        open={Boolean(menuAnchorUser)}
        onClose={() => setMenuAnchorUser(null)}
        slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 180 } } }}
      >
        <MenuItem
          onClick={() => { setMenuAnchorUser(null); navigateToUser(member.id, currentUserId, navigate); }}
          sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem" }}
        >
          {t("users.viewProfile")}
        </MenuItem>
        {member.id !== currentUserId && (
          <MenuItem
            onClick={() => { setMenuAnchorUser(null); setRemoveDialogOpen(true); }}
            sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem", color: "error.main" }}
          >
            {t("sections.removeMember")}
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
      >
        <DialogTitle sx={{ color: "error.main", fontFamily: "Century Gothic, sans-serif" }}>
          {t("sections.removeMember")}
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("organizations.members.removeConfirmText", { name: member.name ?? "" })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, '& > *': { m: '0 !important' } }}>
          <Button
            onClick={() => setRemoveDialogOpen(false)}
            disabled={removing}
            sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de" }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void handleRemoveMember()}
            disabled={removing}
            color="error"
            variant="outlined"
            sx={{ fontFamily: "Century Gothic, sans-serif", borderRadius: "8px" }}
          >
            {removing ? <CircularProgress size={16} /> : t("sections.removeMember")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
