import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";

type TaskDTO = components["schemas"]["TaskDTO"];
type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

interface Props {
  task: TaskDTO;
  organizationId: number;
  canManage: boolean;
  onUpdated: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export default function TaskVisibilitySection({
  task,
  organizationId,
  canManage,
  onUpdated,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const [roles, setRoles] = useState<TechnicalRoleDTO[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>(
    (task.visibilityRoleIds as number[] | undefined) ?? []
  );
  const [autocompleteKey, setAutocompleteKey] = useState(0);

  const visibility = (task.visibility as "ALL_MEMBERS" | "ROLE_RESTRICTED" | undefined) ?? "ALL_MEMBERS";

  // Sync local state when task changes
  useEffect(() => {
    setSelectedRoleIds((task.visibilityRoleIds as number[] | undefined) ?? []);
  }, [task.visibilityRoleIds]);

  const loadRoles = async () => {
    if (!user || rolesLoaded) return;
    try {
      const { data } = await client.GET("/api/v1/organizations/{organizationId}/roles", {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setRoles((data as unknown as TechnicalRoleDTO[]) ?? []);
      setRolesLoaded(true);
    } catch {
      setRolesLoaded(true);
    }
  };

  // Load roles on mount if visibility is ROLE_RESTRICTED (needed for read-only display)
  useEffect(() => {
    if (visibility === "ROLE_RESTRICTED" && !rolesLoaded) {
      void loadRoles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility, rolesLoaded]);

  const putVisibility = async (
    newVisibility: "ALL_MEMBERS" | "ROLE_RESTRICTED",
    roleIds?: number[]
  ) => {
    if (!user) return;
    try {
      const body: { visibility: "ALL_MEMBERS" | "ROLE_RESTRICTED"; visibilityRoleIds?: number[] } = {
        visibility: newVisibility,
      };
      if (newVisibility === "ROLE_RESTRICTED") {
        body.visibilityRoleIds = roleIds ?? selectedRoleIds;
      }

      const putFn = client.PUT as unknown as (
        path: "/api/v1/organizations/{organizationId}/tasks/{taskId}/visibility",
        init: {
          params: { path: { organizationId: number; taskId: number } };
          body: typeof body;
          headers: { Authorization: string };
        }
      ) => Promise<{ error?: unknown }>;

      const { error } = await putFn(
        "/api/v1/organizations/{organizationId}/tasks/{taskId}/visibility",
        {
          params: { path: { organizationId, taskId: task.id! } },
          body,
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      onUpdated();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    }
  };

  const handleVisibilityChange = async (newValue: "ALL_MEMBERS" | "ROLE_RESTRICTED") => {
    if (newValue === "ROLE_RESTRICTED") {
      await loadRoles();
    }
    await putVisibility(newValue, newValue === "ROLE_RESTRICTED" ? selectedRoleIds : undefined);
  };

  const handleAddRole = async (role: TechnicalRoleDTO | null) => {
    if (!role?.id) return;
    setAutocompleteKey((k) => k + 1);
    if (selectedRoleIds.includes(role.id)) return;
    const next = [...selectedRoleIds, role.id];
    setSelectedRoleIds(next);
    await putVisibility("ROLE_RESTRICTED", next);
  };

  const handleRemoveRole = async (roleId: number) => {
    const next = selectedRoleIds.filter((id) => id !== roleId);
    setSelectedRoleIds(next);
    await putVisibility("ROLE_RESTRICTED", next);
  };

  const getRoleById = (id: number): TechnicalRoleDTO | undefined =>
    roles.find((r) => r.id === id);

  const selectedRoleObjects = selectedRoleIds.map((id) => getRoleById(id)).filter(Boolean) as TechnicalRoleDTO[];
  const availableRoles = roles.filter((r) => r.id != null && !selectedRoleIds.includes(r.id));

  // Read-only mode
  if (!canManage) {
    return (
      <Box>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            fontSize: "1.1rem",
            mb: 0.5,
          }}
        >
          {t("tasks.form.visibility")}
        </Typography>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#1a2f63", mb: 1 }}>
          {visibility === "ALL_MEMBERS"
            ? t("tasks.visibility.allMembers")
            : t("tasks.visibility.roleRestricted")}
        </Typography>
        {visibility === "ROLE_RESTRICTED" && selectedRoleObjects.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selectedRoleObjects.map((role) => (
              <Chip
                key={role.id}
                label={role.name}
                size="small"
                sx={{ fontFamily: "Century Gothic, sans-serif" }}
              />
            ))}
          </Box>
        )}
        {visibility === "ROLE_RESTRICTED" && selectedRoleObjects.length === 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selectedRoleIds.map((id) => (
              <Chip
                key={id}
                label={`#${id}`}
                size="small"
                sx={{ fontFamily: "Century Gothic, sans-serif" }}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Editable mode
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          fontSize: "1.1rem",
          mb: 1,
        }}
      >
        {t("tasks.form.visibility")}
      </Typography>

      <TextField
        select
        fullWidth
        value={visibility}
        onChange={(e) => {
          void handleVisibilityChange(e.target.value as "ALL_MEMBERS" | "ROLE_RESTRICTED");
        }}
        slotProps={{ input: { sx: { fontFamily: "Century Gothic, sans-serif" } } }}
        size="small"
      >
        <MenuItem value="ALL_MEMBERS">{t("tasks.visibility.allMembers")}</MenuItem>
        <MenuItem value="ROLE_RESTRICTED">{t("tasks.visibility.roleRestricted")}</MenuItem>
      </TextField>

      {visibility === "ROLE_RESTRICTED" && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
            {selectedRoleObjects.map((role) => (
              <Chip
                key={role.id}
                label={role.name}
                size="small"
                onDelete={() => void handleRemoveRole(role.id!)}
                sx={{ fontFamily: "Century Gothic, sans-serif" }}
              />
            ))}
            {selectedRoleIds
              .filter((id) => !getRoleById(id))
              .map((id) => (
                <Chip
                  key={id}
                  label={`#${id}`}
                  size="small"
                  onDelete={() => void handleRemoveRole(id)}
                  sx={{ fontFamily: "Century Gothic, sans-serif" }}
                />
              ))}
          </Box>
          <Autocomplete
            key={autocompleteKey}
            options={availableRoles}
            getOptionLabel={(r) => r.name ?? String(r.id)}
            onChange={(_, value) => void handleAddRole(value)}
            blurOnSelect
            size="small"
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("tasks.assignees.add")}
                size="small"
                sx={{ fontFamily: "Century Gothic, sans-serif" }}
              />
            )}
          />
        </Box>
      )}
    </Box>
  );
}
