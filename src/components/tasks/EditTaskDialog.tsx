import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ruRU, enUS } from "@mui/x-date-pickers/locales";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ru";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";

type TaskDTO = components["schemas"]["TaskDTO"];
type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

interface Props {
  open: boolean;
  onClose: () => void;
  task: TaskDTO;
  organizationId: number;
  onUpdated: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export default function EditTaskDialog({ open, onClose, task, organizationId, onUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const dayjsLocale = i18n.language === "ru" ? "ru" : "en";
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Dayjs | null>(null);
  const [visibility, setVisibility] = useState<"ALL_MEMBERS" | "ROLE_RESTRICTED">("ALL_MEMBERS");
  const [roles, setRoles] = useState<TechnicalRoleDTO[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<TechnicalRoleDTO[]>([]);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const isDeadlinePast = deadline !== null && deadline.isBefore(dayjs());

  // Reset + pre-fill form when dialog opens
  useEffect(() => {
    if (open && task) {
      setTitle(task.title ?? "");
      setTitleError("");
      setDescription(task.description ?? "");
      setDeadline(task.deadline ? dayjs(task.deadline) : null);
      const vis = (task.visibility as "ALL_MEMBERS" | "ROLE_RESTRICTED" | undefined) ?? "ALL_MEMBERS";
      setVisibility(vis);
      setSelectedRoles([]);
      setAutocompleteKey((k) => k + 1);
      setSubmitting(false);
    }
  }, [open, task]);

  // Load roles when ROLE_RESTRICTED is selected
  useEffect(() => {
    if (visibility !== "ROLE_RESTRICTED" || !user || !open) {return;}
    void (async () => {
      const { data } = await client.GET("/api/v1/organizations/{organizationId}/roles", {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const allRoles = (data as unknown as TechnicalRoleDTO[]) ?? [];
      setRoles(allRoles);

      // Pre-select roles matching task.visibilityRoleIds
      const visibilityRoleIds = (task.visibilityRoleIds as number[] | undefined) ?? [];
      if (visibilityRoleIds.length > 0) {
        const preSelected = allRoles.filter((r) => r.id != null && visibilityRoleIds.includes(r.id));
        setSelectedRoles(preSelected);
      }
    })();
  }, [visibility, open, user, organizationId, task.visibilityRoleIds]);

  const handleAddRole = (role: TechnicalRoleDTO | null) => {
    if (!role?.id) {return;}
    if (selectedRoles.some((r) => r.id === role.id)) {
      setAutocompleteKey((k) => k + 1);
      return;
    }
    setSelectedRoles((prev) => [...prev, role]);
    setAutocompleteKey((k) => k + 1);
  };

  const handleRemoveRole = (roleId: number) => {
    setSelectedRoles((prev) => prev.filter((r) => r.id !== roleId));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setTitleError(`${String(t("tasks.form.title"))  } — ${  String(t("auth.errors.nameRequired"))}`);
      return;
    }
    if (!user) {return;}

    setSubmitting(true);
    try {
      const originalDeadline = task.deadline ?? null;
      const newDeadlineIso = deadline ? deadline.toISOString() : null;
      const clearDeadline = Boolean(originalDeadline && !deadline);

      const origVisRoleIds = [...((task.visibilityRoleIds as number[] | undefined) ?? [])].sort((a, b) => a - b);
      const curVisRoleIds = visibility === "ROLE_RESTRICTED" ? [...selectedRoles.map((r) => r.id!)].sort((a, b) => a - b) : [];
      const hasChanges =
        title.trim() !== (task.title ?? "") ||
        description.trim() !== (task.description ?? "") ||
        clearDeadline ||
        (newDeadlineIso !== null && newDeadlineIso !== originalDeadline) ||
        visibility !== ((task.visibility as "ALL_MEMBERS" | "ROLE_RESTRICTED" | undefined) ?? "ALL_MEMBERS") ||
        JSON.stringify(origVisRoleIds) !== JSON.stringify(curVisRoleIds);

      if (!hasChanges) {
        onClose();
        return;
      }

      const body: {
        title: string;
        description?: string;
        visibility: "ALL_MEMBERS" | "ROLE_RESTRICTED";
        visibilityRoleIds?: number[];
        deadline?: string;
        clearDeadline: boolean;
        fileIds: number[];
      } = {
        title: title.trim(),
        visibility,
        fileIds: (task.fileIds as number[] | undefined) ?? [],
        clearDeadline: clearDeadline,
      };

      if (description.trim() !== (task.description ?? "")) {
        body.description = description.trim();
      }
      if (newDeadlineIso) {
        body.deadline = newDeadlineIso;
      }
      if (visibility === "ROLE_RESTRICTED") {
        body.visibilityRoleIds = selectedRoles.map((r) => r.id!);
      }

      const putFn = client.PUT as unknown as (
        path: "/api/v1/organizations/{organizationId}/tasks/{taskId}",
        init: {
          params: { path: { organizationId: number; taskId: number } };
          body: typeof body;
          headers: { Authorization: string };
        }
      ) => Promise<{ error?: unknown }>;

      const { error } = await putFn(
        "/api/v1/organizations/{organizationId}/tasks/{taskId}",
        {
          params: { path: { organizationId, taskId: task.id! } },
          body,
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );

      if (error) {throw error;}
      onUpdated();
      onClose();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const availableRoles = roles.filter((r) => !selectedRoles.some((s) => s.id === r.id));

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={dayjsLocale}
      localeText={dayjsLocale === "ru" ? ruRU.components.MuiLocalizationProvider.defaultProps.localeText : enUS.components.MuiLocalizationProvider.defaultProps.localeText}
    >
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700 }}>
        {t("tasks.editButton")}
      </DialogTitle>

      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
          {/* Title */}
          <TextField
            label={t("tasks.form.title")}
            required
            fullWidth
            value={title}
            onChange={(e) => {
              setTitle(e.target.value.slice(0, 255));
              if (e.target.value.trim()) {setTitleError("");}
            }}
            error={Boolean(titleError)}
            helperText={titleError || `${title.length}/255`}
            slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
          />

          {/* Description */}
          <TextField
            label={t("tasks.form.description")}
            fullWidth
            multiline
            minRows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
            helperText={`${description.length}/5000`}
            slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
          />

          {/* Deadline */}
          <Box>
            <DateTimePicker
              label={t("tasks.form.deadline")}
              value={deadline}
              onChange={(val) => setDeadline(val)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: { "& .MuiInputBase-root": { fontFamily: "Century Gothic, sans-serif" } },
                },
              }}
            />
            {isDeadlinePast && (
              <Typography
                variant="caption"
                sx={{ color: "#d32f2f", fontFamily: "Century Gothic, sans-serif", mt: 0.5, display: "block" }}
              >
                {t("tasks.form.deadlinePast")}
              </Typography>
            )}
          </Box>

          {/* Visibility */}
          <TextField
            select
            label={t("tasks.form.visibility")}
            fullWidth
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "ALL_MEMBERS" | "ROLE_RESTRICTED")}
            slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
          >
            <MenuItem value="ALL_MEMBERS">{t("tasks.visibility.allMembers")}</MenuItem>
            <MenuItem value="ROLE_RESTRICTED">{t("tasks.visibility.roleRestricted")}</MenuItem>
          </TextField>

          {/* Role selection */}
          {visibility === "ROLE_RESTRICTED" && (
            <Box>
              <Autocomplete
                key={autocompleteKey}
                options={availableRoles}
                getOptionLabel={(r) => r.name ?? String(r.id)}
                onChange={(_, value) => handleAddRole(value)}
                blurOnSelect
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("tasks.assignees.add")}
                    size="small"
                    sx={{ mb: 1, fontFamily: "Century Gothic, sans-serif" }}
                  />
                )}
              />
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selectedRoles.map((role) => (
                  <Chip
                    key={role.id}
                    label={role.name}
                    size="small"
                    onDelete={() => handleRemoveRole(role.id!)}
                    sx={{ fontFamily: "Century Gothic, sans-serif" }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, '& > *': { m: '0 !important' } }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => { void handleSubmit(); }}
          disabled={submitting}
          sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", background: "#0f3eb5" }}
        >
          {t("tasks.editButton")}
        </Button>
      </DialogActions>
    </Dialog>
    </LocalizationProvider>
  );
}
