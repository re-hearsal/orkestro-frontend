import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import type { components } from "../../api/schema";

type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

const PERMISSION_CODES = [
  "ORG_WRITE_INFO",
  "ORG_FUND_MANIPULATION",
  "ORG_JOIN_REQUEST_VIEW",
  "ORG_JOIN_REQUEST_MANAGE",
  "REPERTOIRE_CREATE_SONG",
  "REPERTOIRE_EDIT_SONG",
  "REPERTOIRE_DELETE_SONG",
  "REPERTOIRE_MANAGE_FILES",
  "REPERTOIRE_MANAGE_TAGS",
  "REPERTOIRE_MANAGE_INSTRUMENTATION",
  "EVENT_MARK_ATTENDANCE",
  "EVENT_MANAGE",
  "EVENT_MANAGE_DESCRIPTIONS",
  "EVENT_WRITE_COMMENT",
  "TASK_MANAGE",
] as const;

interface CreateRoleDialogProps {
  organizationId: number;
  open: boolean;
  onClose: () => void;
  onSaved: (role: TechnicalRoleDTO) => void;
  existingRole?: TechnicalRoleDTO;
}

export default function CreateRoleDialog({
  organizationId,
  open,
  onClose,
  onSaved,
  existingRole,
}: CreateRoleDialogProps) {
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
    if (!name.trim()) {
      setNameError(String(t("roles.form.nameRequired")));
      return false;
    }
    if (name.trim().length < 2) {
      setNameError(String(t("roles.form.nameTooShort")));
      return false;
    }
    if (name.trim().length > 64) {
      setNameError(String(t("roles.form.nameTooLong")));
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleTogglePermission = (code: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;

    setLoading(true);
    setApiError(null);

    try {
      const body = {
        name: name.trim(),
        permissionCodes: Array.from(selectedPermissions),
      };

      if (existingRole?.id != null) {
        const { data, error } = await client.PUT(
          "/api/v1/organizations/{organizationId}/roles/{roleId}",
          {
            params: { path: { organizationId, roleId: existingRole.id } },
            body,
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (error) {
          const apiErr = error as components["schemas"]["ApiErrorResponse"];
          setApiError(apiErr.message ?? String(t("roles.form.nameRequired")));
          return;
        }
        onSaved(data as unknown as TechnicalRoleDTO);
      } else {
        const { data, error } = await client.POST(
          "/api/v1/organizations/{organizationId}/roles",
          {
            params: { path: { organizationId } },
            body,
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (error) {
          const apiErr = error as components["schemas"]["ApiErrorResponse"];
          setApiError(apiErr.message ?? String(t("roles.form.nameRequired")));
          return;
        }
        onSaved(data as unknown as TechnicalRoleDTO);
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isEdit = existingRole != null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
    >
      <DialogTitle
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
        }}
      >
        {isEdit ? t("roles.editTitle") : t("roles.createTitle")}
      </DialogTitle>

      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <TextField
          label={t("roles.form.name")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          error={nameError != null}
          helperText={nameError}
          fullWidth
          disabled={loading}
          sx={{ mt: 1, mb: 2 }}
          slotProps={{
            inputLabel: { sx: { fontFamily: "Century Gothic, sans-serif" } },
            input: { sx: { fontFamily: "Century Gothic, sans-serif" } },
          }}
        />

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            mb: 1,
            fontSize: "0.95rem",
          }}
        >
          {t("roles.form.permissions")}
        </Typography>

        <FormGroup>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            {PERMISSION_CODES.map((code) => (
              <FormControlLabel
                key={code}
                control={
                  <Checkbox
                    checked={selectedPermissions.has(code)}
                    onChange={() => handleTogglePermission(code)}
                    disabled={loading}
                    sx={{
                      color: "#7795de",
                      "&.Mui-checked": { color: "#0f3eb5" },
                    }}
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

        {apiError && (
          <FormHelperText error sx={{ mt: 1, fontFamily: "Century Gothic, sans-serif" }}>
            {apiError}
          </FormHelperText>
        )}
      </DialogContent>

      <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          variant="outlined"
          sx={{
            borderRadius: "8px",
            borderColor: "#7795de",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
          }}
        >
          {t("organizations.leaveDialog.cancel")}
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={loading}
          variant="contained"
          sx={{
            borderRadius: "8px",
            backgroundColor: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            "&:hover": { backgroundColor: "#0c32a0" },
          }}
        >
          {loading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : (isEdit ? t("roles.editTitle") : t("roles.createTitle"))}
        </Button>
      </Box>
    </Dialog>
  );
}
