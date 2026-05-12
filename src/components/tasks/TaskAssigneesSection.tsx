import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Avatar,
  Box,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";
import { navigateToUser } from "../../utils/navigateToUser";

type TaskDTO = components["schemas"]["TaskDTO"];
type TaskUserInfoDTO = {
  userId?: number;
  name?: string;
  profileImageFileId?: number | null;
};

interface OrgMember {
  id?: number;
  name?: string;
  profileImageFileId?: number | null;
}

interface Props {
  task: TaskDTO;
  organizationId: number;
  canManage: boolean;
  currentUserId?: number;
  onUpdated: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export default function TaskAssigneesSection({
  task,
  organizationId,
  canManage,
  currentUserId,
  onUpdated,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const navigate = useNavigate();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<TaskUserInfoDTO | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [avatarUrls, setAvatarUrls] = useState<Record<number, string>>({});

  const assignees = (task.assignees as TaskUserInfoDTO[] | undefined) ?? [];

  const BASE_URL =
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? "" : "http://localhost:8080");

  // Load avatars for assignees that have a profileImageFileId
  useEffect(() => {
    if (!user) return;
    const toLoad = assignees.filter(
      (a) => a.userId != null && a.profileImageFileId != null && !avatarUrls[a.userId!]
    );
    if (toLoad.length === 0) return;

    void (async () => {
      const entries = await Promise.all(
        toLoad.map(async (a) => {
          try {
            const res = await fetch(`${BASE_URL}/api/v1/files/${a.profileImageFileId}`, {
              headers: { Authorization: `Bearer ${user.token}` },
            });
            if (!res.ok) return null;
            const blob = await res.blob();
            return [a.userId!, URL.createObjectURL(blob)] as const;
          } catch {
            return null;
          }
        })
      );
      const next: Record<number, string> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      if (Object.keys(next).length > 0) {
        setAvatarUrls((prev) => ({ ...prev, ...next }));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.assignees, user]);

  const openMenu = (event: MouseEvent<HTMLElement>, assignee: TaskUserInfoDTO) => {
    if (canManage) {
      setMenuAnchor(event.currentTarget);
      setMenuTarget(assignee);
    } else {
      navigateToUser(assignee.userId, currentUserId, navigate);
    }
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
  };

  const handleRemoveAssignee = async () => {
    if (!menuTarget?.userId || !user) return;
    const targetUserId = menuTarget.userId;
    closeMenu();

    try {
      const { error } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/tasks/{taskId}/assignees/{userId}",
        {
          params: { path: { organizationId, taskId: task.id!, userId: targetUserId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      onUpdated();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    }
  };

  const loadMembers = async () => {
    if (!user || membersLoaded) return;
    try {
      const { data } = await client.GET(
        "/api/v1/organizations/{organizationId}/members/page",
        {
          params: { path: { organizationId }, query: { size: 100 } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      const content = (data as unknown as { content?: OrgMember[] })?.content ?? [];
      setMembers(content);
      setMembersLoaded(true);
    } catch {
      setMembersLoaded(true);
    }
  };

  const handleAddClick = async () => {
    setAddOpen(true);
    await loadMembers();
  };

  const handleAddAssignee = async (member: OrgMember | null) => {
    if (!member?.id || !user) return;
    setAutocompleteKey((k) => k + 1);
    setAddOpen(false);

    try {
      const postFn = client.POST as unknown as (
        path: "/api/v1/organizations/{organizationId}/tasks/{taskId}/assignees",
        init: {
          params: { path: { organizationId: number; taskId: number } };
          body: { userIds: number[] };
          headers: { Authorization: string };
        }
      ) => Promise<{ error?: unknown }>;

      const { error } = await postFn(
        "/api/v1/organizations/{organizationId}/tasks/{taskId}/assignees",
        {
          params: { path: { organizationId, taskId: task.id! } },
          body: { userIds: [member.id] },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      onUpdated();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    }
  };

  useEffect(() => {
    if (!addOpen) {
      setAutocompleteKey((k) => k + 1);
    }
  }, [addOpen]);

  const assignedUserIds = new Set(assignees.map((a) => a.userId));
  const availableMembers = members.filter((m) => m.id != null && !assignedUserIds.has(m.id));

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
        {t("tasks.assignees.section")}
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {assignees.map((assignee) => (
          <Box
            key={assignee.userId}
            onClick={(e) => openMenu(e, assignee)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              border: "1px solid #dce6f9",
              borderRadius: "50px",
              cursor: "pointer",
              bgcolor: "#ffffff",
              "&:hover": { bgcolor: "rgba(15,62,181,0.06)" },
              transition: "background-color 0.15s",
            }}
          >
            <Avatar
              src={assignee.userId != null ? avatarUrls[assignee.userId] : undefined}
              sx={{ width: 24, height: 24, bgcolor: "#0f3eb5", fontSize: "0.75rem" }}
            >
              {assignee.name ? assignee.name.charAt(0).toUpperCase() : "?"}
            </Avatar>
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.85rem", color: "#1a2f63" }}>
              {assignee.name ?? `#${assignee.userId}`}
            </Typography>
          </Box>
        ))}

        {canManage && !addOpen && (
          <Box
            onClick={() => void handleAddClick()}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "1px solid #dce6f9",
              borderRadius: "50px",
              cursor: "pointer",
              bgcolor: "#ffffff",
              "&:hover": { bgcolor: "rgba(15,62,181,0.06)" },
              transition: "background-color 0.15s",
            }}
          >
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", lineHeight: 1 }}>
              +
            </Typography>
          </Box>
        )}

        {canManage && addOpen && (
          <Autocomplete
            key={autocompleteKey}
            options={availableMembers}
            getOptionLabel={(m) => m.name ?? String(m.id)}
            onChange={(_, value) => void handleAddAssignee(value)}
            onBlur={() => setAddOpen(false)}
            autoFocus
            openOnFocus
            size="small"
            sx={{ minWidth: 180 }}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                size="small"
                placeholder={t("organizations.members.searchPlaceholder")}
                sx={{ fontFamily: "Century Gothic, sans-serif" }}
              />
            )}
          />
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => { closeMenu(); navigateToUser(menuTarget?.userId, currentUserId, navigate); }}
          sx={{ fontFamily: "Century Gothic, sans-serif" }}
        >
          {t("users.viewProfile")}
        </MenuItem>
        <MenuItem
          onClick={() => void handleRemoveAssignee()}
          sx={{ color: "error.main", fontFamily: "Century Gothic, sans-serif" }}
        >
          {t("tasks.assignees.remove")}
        </MenuItem>
      </Menu>
    </Box>
  );
}
