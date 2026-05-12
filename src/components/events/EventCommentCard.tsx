import { useEffect, useState } from "react";
import { Avatar, Box, Button, CircularProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { navigateToUser } from "../../utils/navigateToUser";

type EventCommentDTO = components["schemas"]["EventCommentDTO"];

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

interface Props {
  comment: EventCommentDTO;
  organizationId: number;
  eventId: number;
  canDelete: boolean;
  onDeleted: () => void;
}

export default function EventCommentCard({ comment, organizationId, eventId, canDelete, onDeleted }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!comment.authorProfileImageFileId || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: comment.authorProfileImageFileId! } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });
        if (cancelled || !data) return;
        const url = URL.createObjectURL(data as unknown as Blob);
        setAvatarUrl(url);
      } catch {
        // use system avatar
      }
    })();
    return () => { cancelled = true; };
  }, [comment.authorProfileImageFileId, user]);

  const handleDelete = async () => {
    if (!user || !comment.id) return;
    setDeleting(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/events/{eventId}/comments/{commentId}",
        {
          params: { path: { organizationId, eventId, commentId: comment.id } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      showAlert(String(t("events.commentDeleted")), "success");
      onDeleted();
    } catch {
      showAlert(String(t("events.commentDeleteError")), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        border: "1px solid #dce6f9",
        borderRadius: "12px",
        p: 1.5,
        backgroundColor: "#ffffff",
        display: "flex",
        gap: 1.5,
      }}
    >
      <Avatar
        src={avatarUrl ?? undefined}
        sx={{ width: 36, height: 36, bgcolor: "#7795de", cursor: "pointer", flexShrink: 0 }}
        onClick={() => navigateToUser(comment.authorUserId, undefined, navigate)}
      >
        {!avatarUrl && (comment.authorName?.[0] ?? "?")}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
          <Typography
            onClick={() => navigateToUser(comment.authorUserId, undefined, navigate)}
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
              fontSize: "0.9rem",
              cursor: "pointer",
              wordBreak: "break-word",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {comment.authorName}
          </Typography>

          {comment.rating != null && (
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                color: "#7795de",
                fontSize: "0.8rem",
              }}
            >
              ★ {comment.rating}/10
            </Typography>
          )}

          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              color: "#7795de",
              fontSize: "0.75rem",
              ml: "auto",
            }}
          >
            {formatDate(comment.createdAt)}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontSize: "0.92rem",
            color: "#1a2f63",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {comment.text}
        </Typography>

        {canDelete && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
            <Button
              variant="text"
              color="error"
              size="small"
              onClick={() => void handleDelete()}
              disabled={deleting}
              sx={{
                minWidth: 0,
                px: 1,
                fontFamily: "Century Gothic, sans-serif",
                textTransform: "none",
                fontSize: "0.8rem",
              }}
            >
              {deleting ? <CircularProgress size={14} /> : t("events.deleteComment")}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
