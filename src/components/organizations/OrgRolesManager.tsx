import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Popover,
  Typography,
  Button,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import type { components } from "../../api/schema";
import { getLocalizedRoleName } from "../../utils/roleNameI18n";
import CreateRoleDialog from "./CreateRoleDialog";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

interface OrgRolesManagerProps {
  organizationId: number;
}

export default function OrgRolesManager({ organizationId }: OrgRolesManagerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [roles, setRoles] = useState<TechnicalRoleDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverRole, setPopoverRole] = useState<TechnicalRoleDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<TechnicalRoleDTO | undefined>(undefined);

  const loadRoles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/roles",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (!error && data != null) {
        setRoles(data as unknown as TechnicalRoleDTO[]);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, user]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const handleChipClick = (event: React.MouseEvent<HTMLElement>, role: TechnicalRoleDTO) => {
    (event.currentTarget as HTMLElement).blur();
    setAnchorEl(event.currentTarget);
    setPopoverRole(role);
  };

  const handlePopoverClose = () => {
    if (deleting) return;
    setAnchorEl(null);
    setPopoverRole(null);
  };

  const handleDelete = async () => {
    if (!user || !popoverRole?.id) return;
    setDeleting(true);
    try {
      await client.DELETE("/api/v1/organizations/{organizationId}/roles/{roleId}", {
        params: { path: { organizationId, roleId: popoverRole.id } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setRoles((prev) => prev.filter((r) => r.id !== popoverRole.id));
      setAnchorEl(null);
      setPopoverRole(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).blur();
    setEditingRole(popoverRole ?? undefined);
    setDialogOpen(true);
    setAnchorEl(null);
    setPopoverRole(null);
  };

  const handleSaved = (saved: TechnicalRoleDTO) => {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setDialogOpen(false);
    setEditingRole(undefined);
  };

  const popoverOpen = Boolean(anchorEl);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          fontSize: "1.05rem",
          mb: 1.5,
        }}
      >
        {t("roles.rolesSection")}
      </Typography>

      {loading ? (
        <CircularProgress size={20} sx={{ color: "#7795de" }} />
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          {roles.map((role) => (
            <Chip
              key={role.id}
              label={getLocalizedRoleName(role.name, t)}
              onClick={(e) => handleChipClick(e, role)}
              sx={{
                borderRadius: "24px",
                border: "1px solid #7795de",
                backgroundColor: "#ffffff",
                fontFamily: "Century Gothic, sans-serif",
                color: "#0f3eb5",
                fontWeight: 600,
                cursor: "pointer",
                "&:hover": { backgroundColor: "rgba(119,149,222,0.1)" },
              }}
            />
          ))}

          <Chip
            label="+"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              setEditingRole(undefined);
              setDialogOpen(true);
            }}
            sx={{
              borderRadius: "24px",
              border: "1px solid #7795de",
              backgroundColor: "#ffffff",
              fontFamily: "Century Gothic, sans-serif",
              color: "#7795de",
              fontWeight: 700,
              fontSize: "1.1rem",
              cursor: "pointer",
              "&:hover": { backgroundColor: "rgba(119,149,222,0.1)" },
            }}
          />
        </Box>
      )}

      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { borderRadius: "16px", p: 2, minWidth: 220, maxWidth: 320 },
          },
        }}
      >
        {popoverRole && (
          <Box>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                color: "#0f3eb5",
                mb: 1,
              }}
            >
              {getLocalizedRoleName(popoverRole.name, t)}
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
              {(popoverRole.permissionCodes ?? []).map((code) => (
                <Chip
                  key={code}
                  label={t(`permissions.${code}`)}
                  size="small"
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    fontSize: "0.75rem",
                    color: "#7795de",
                    border: "1px solid #7795de",
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                  }}
                />
              ))}
              {(popoverRole.permissionCodes ?? []).length === 0 && (
                <Typography
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    color: "#7795de",
                    fontSize: "0.85rem",
                  }}
                >
                  —
                </Typography>
              )}
            </Box>

            {popoverRole.system !== true && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => handleEdit(e)}
                  sx={{
                    textTransform: "none",
                    fontFamily: "Century Gothic, sans-serif",
                    borderRadius: "8px",
                    borderColor: "#0f3eb5",
                    color: "#0f3eb5",
                    fontSize: "0.8rem",
                  }}
                >
                  {t("roles.editTitle")}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    if (window.confirm(String(t("roles.deleteConfirm")))) {
                      void handleDelete();
                    }
                  }}
                  disabled={deleting}
                  sx={{
                    textTransform: "none",
                    fontFamily: "Century Gothic, sans-serif",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                  }}
                >
                  {deleting ? <CircularProgress size={14} /> : t("roles.deleteButton")}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Popover>

      <CreateRoleDialog
        organizationId={organizationId}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingRole(undefined);
        }}
        onSaved={handleSaved}
        existingRole={editingRole}
      />
    </Box>
  );
}
