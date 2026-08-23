import { useCallback, useEffect, useState } from "react";
import { useAppAlert } from "../../hooks/useAppAlert";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Popover,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import type { components } from "../../api/schema";
import { getLocalizedRoleName } from "../../utils/roleNameI18n";
import ConfirmDialog from "../common/ConfirmDialog";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

const SECTION_PERMISSION_CODES = [
  "SECTION_EDIT",
  "SECTION_DELETE",
  "SECTION_MEMBER_ADD",
  "SECTION_MEMBER_REMOVE",
  "SECTION_ASSIGN_TECH_ROLE",
  "SECTION_TECH_ROLE_MANAGE",
] as const;

interface SectionRolesManagerProps {
  sectionId: number;
  canManage?: boolean;
}

interface RoleDialogProps {
  sectionId: number;
  open: boolean;
  onClose: () => void;
  onSaved: (role: TechnicalRoleDTO) => void;
  existingRole?: TechnicalRoleDTO;
}

function CreateSectionRoleDialog({ sectionId, open, onClose, onSaved, existingRole }: RoleDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(existingRole?.name ?? "");
      setSelectedPermissions(new Set(existingRole?.permissionCodes ?? []));
      setNameError(null);
      setApiError(null);
    }
  }, [open, existingRole]);

  const validate = (): boolean => {
    if (!name.trim()) { setNameError(String(t("roles.form.nameRequired"))); return false; }
    if (name.trim().length < 2) { setNameError(String(t("roles.form.nameTooShort"))); return false; }
    if (name.trim().length > 64) { setNameError(String(t("roles.form.nameTooLong"))); return false; }
    setNameError(null);
    return true;
  };

  const handleTogglePermission = (code: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {next.delete(code);} else {next.add(code);}
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!validate() || !user) {return;}
    setLoading(true);
    setApiError(null);
    try {
      const body = { name: name.trim(), permissionCodes: Array.from(selectedPermissions) };
      if (existingRole?.id != null) {
        const { data, error } = await client.PUT(
          "/api/v1/sections/{sectionId}/roles/{roleId}",
          { params: { path: { sectionId, roleId: existingRole.id } }, body, headers: { Authorization: `Bearer ${user.token}` } }
        );
        if (error) { setApiError((error as components["schemas"]["ApiErrorResponse"]).message ?? String(t("roles.form.nameRequired"))); return; }
        onSaved(data as unknown as TechnicalRoleDTO);
      } else {
        const { data, error } = await client.POST(
          "/api/v1/sections/{sectionId}/roles",
          { params: { path: { sectionId } }, body, headers: { Authorization: `Bearer ${user.token}` } }
        );
        if (error) { setApiError((error as components["schemas"]["ApiErrorResponse"]).message ?? String(t("roles.form.nameRequired"))); return; }
        onSaved(data as unknown as TechnicalRoleDTO);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isEdit = existingRole != null;

  return (
    <Dialog open={open} onClose={() => { if (!loading) {onClose();} }} fullWidth maxWidth="sm" fullScreen={fullScreen} slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}>
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}>
        {isEdit ? t("roles.editTitle") : t("roles.createTitle")}
      </DialogTitle>
      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <TextField
          label={t("roles.form.name")}
          value={name}
          onChange={(e) => { setName(e.target.value); if (nameError) {setNameError(null);} }}
          error={nameError != null}
          helperText={nameError}
          fullWidth
          disabled={loading}
          sx={{ mt: 1, mb: 2 }}
        />
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", mb: 1, fontSize: "0.95rem" }}>
          {t("roles.form.permissions")}
        </Typography>
        <FormGroup>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            {SECTION_PERMISSION_CODES.map((code) => (
              <FormControlLabel
                key={code}
                control={
                  <Checkbox
                    checked={selectedPermissions.has(code)}
                    onChange={() => handleTogglePermission(code)}
                    disabled={loading}
                    sx={{ color: "#7795de", "&.Mui-checked": { color: "#0f3eb5" } }}
                  />
                }
                label={
                  <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem" }}>
                    {t(`permissions.${code}`)}
                  </Typography>
                }
                sx={{ width: "50%", minWidth: 200 }}
              />
            ))}
          </Box>
        </FormGroup>
        {apiError && <FormHelperText error sx={{ mt: 1 }}>{apiError}</FormHelperText>}
      </DialogContent>
      <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: "8px", borderColor: "#7795de", color: "#7795de", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={loading} variant="contained" sx={{ borderRadius: "8px", backgroundColor: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", textTransform: "none", "&:hover": { backgroundColor: "#0c32a0" } }}>
          {loading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : (isEdit ? t("roles.editTitle") : t("roles.createTitle"))}
        </Button>
      </Box>
    </Dialog>
  );
}

export default function SectionRolesManager({ sectionId, canManage = false }: SectionRolesManagerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const [roles, setRoles] = useState<TechnicalRoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverRole, setPopoverRole] = useState<TechnicalRoleDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<TechnicalRoleDTO | undefined>(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!user) {return;}
    setLoading(true);
    try {
      const { data, error } = await client.GET("/api/v1/sections/{sectionId}/roles", {
        params: { path: { sectionId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!error && data != null) {setRoles(data as unknown as TechnicalRoleDTO[]);}
    } finally {
      setLoading(false);
    }
  }, [sectionId, user]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const handleChipClick = (event: React.MouseEvent<HTMLElement>, role: TechnicalRoleDTO) => {
    (event.currentTarget as HTMLElement).blur();
    setAnchorEl(event.currentTarget);
    setPopoverRole(role);
  };

  const handlePopoverClose = () => {
    if (deleting) {return;}
    setAnchorEl(null);
    setPopoverRole(null);
  };

  const handleDelete = async () => {
    if (!user || !popoverRole?.id) {return;}
    setDeleting(true);
    try {
      const { error } = await client.DELETE("/api/v1/sections/{sectionId}/roles/{roleId}", {
        params: { path: { sectionId, roleId: popoverRole.id } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (error) {
        showAlert((error as components["schemas"]["ApiErrorResponse"]).message ?? String(t("roles.deleteError")), "warning");
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== popoverRole.id));
      setAnchorEl(null);
      setPopoverRole(null);
      setDeleteConfirmOpen(false);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : String(t("roles.deleteError")), "warning");
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
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
    setDialogOpen(false);
    setEditingRole(undefined);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.05rem", mb: 1.5 }}>
        {t("sections.sectionRoles")}
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
              sx={{ borderRadius: "24px", border: "1px solid #7795de", backgroundColor: "#ffffff", fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontWeight: 600, cursor: "pointer", "&:hover": { backgroundColor: "rgba(119,149,222,0.1)" } }}
            />
          ))}
          {roles.length === 0 && (
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.85rem" }}>—</Typography>
          )}
          {canManage && (
            <Chip
              label="+"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setEditingRole(undefined); setDialogOpen(true); }}
              sx={{ borderRadius: "24px", border: "1px solid #7795de", backgroundColor: "#ffffff", fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontWeight: 700, fontSize: "1.1rem", cursor: "pointer", "&:hover": { backgroundColor: "rgba(119,149,222,0.1)" } }}
            />
          )}
        </Box>
      )}

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { borderRadius: "16px", p: 2, minWidth: 220, maxWidth: 320 } } }}
      >
        {popoverRole && (
          <Box>
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", mb: 1 }}>
              {getLocalizedRoleName(popoverRole.name, t)}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
              {(popoverRole.permissionCodes ?? []).map((code) => (
                <Chip
                  key={code}
                  label={t(`permissions.${code}`)}
                  size="small"
                  sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.75rem", color: "#7795de", border: "1px solid #7795de", borderRadius: "12px", backgroundColor: "#ffffff" }}
                />
              ))}
              {(popoverRole.permissionCodes ?? []).length === 0 && (
                <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.85rem" }}>—</Typography>
              )}
            </Box>
            {popoverRole.system !== true && canManage && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" variant="outlined" onClick={(e) => handleEdit(e)} sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", borderRadius: "8px", borderColor: "#0f3eb5", color: "#0f3eb5", fontSize: "0.8rem" }}>
                  {t("roles.editTitle")}
                </Button>
                <Button
                  size="small" variant="outlined" color="error" disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(true)}
                  sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", borderRadius: "8px", fontSize: "0.8rem" }}
                >
                  {deleting ? <CircularProgress size={14} /> : t("roles.deleteButton")}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Popover>

      <CreateSectionRoleDialog
        sectionId={sectionId}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingRole(undefined); }}
        onSaved={handleSaved}
        existingRole={editingRole}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        message={String(t("roles.deleteConfirm"))}
        confirmLabel={String(t("roles.deleteButton"))}
        loading={deleting}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
