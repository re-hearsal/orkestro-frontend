import { useEffect, useState } from "react";
import { Avatar, Box, Chip, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

export interface EventFeedbackRowDTO {
  commentId?: number;
  commentText?: string;
  rating?: number | null;
  commentCreatedAt?: string;
  authorUserId?: number;
  authorName?: string;
  authorProfileImageFileId?: number | null;
  eventId?: number;
  eventTitle?: string;
  eventType?: "REHEARSAL" | "CONCERT" | "OTHER";
  eventStartTime?: string;
  eventEndTime?: string;
  eventTags?: string[];
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

interface Props {
  row: EventFeedbackRowDTO;
  organizationId: number;
}

export default function FeedbackRow({ row, organizationId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!row.authorProfileImageFileId || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: row.authorProfileImageFileId! } },
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
  }, [row.authorProfileImageFileId, user]);

  const handleRowClick = () => {
    if (!row.eventId) return;
    navigate(`/organizations/${organizationId}/events/${row.eventId}`);
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!row.authorUserId) return;
    navigate(`/users/${row.authorUserId}`);
  };

  return (
    <Box
      onClick={handleRowClick}
      sx={{
        border: "1px solid #7795de",
        borderRadius: "12px",
        p: 2,
        backgroundColor: "#fff",
        cursor: "pointer",
        "&:hover": { backgroundColor: "#f5f8ff" },
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {/* Event section */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontWeight: 700, color: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", fontSize: "1rem" }}>
          {row.eventTitle}
        </Typography>
        {row.eventType && (
          <Chip
            label={t(`eventType.${row.eventType}`)}
            size="small"
            sx={{ borderColor: "#7795de", color: "#1a2f63", fontFamily: "Century Gothic, sans-serif" }}
            variant="outlined"
          />
        )}
        <Typography sx={{ color: "#7795de", fontSize: "0.82rem", fontFamily: "Century Gothic, sans-serif" }}>
          {formatDate(row.eventStartTime)}
        </Typography>
        {(row.eventTags ?? []).map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            sx={{ borderColor: "#dce6f9", color: "#7795de", fontFamily: "Century Gothic, sans-serif" }}
            variant="outlined"
          />
        ))}
      </Box>

      {/* Author section */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar
          src={avatarUrl ?? undefined}
          sx={{ width: 32, height: 32, bgcolor: "#7795de", cursor: "pointer", flexShrink: 0 }}
          onClick={handleAuthorClick}
        >
          {!avatarUrl && (row.authorName?.[0] ?? "?")}
        </Avatar>
        <Typography
          onClick={handleAuthorClick}
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            fontSize: "0.9rem",
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {row.authorName}
        </Typography>
      </Box>

      {/* Comment text */}
      {row.commentText && (
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontSize: "0.9rem",
            color: "#1a2f63",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {row.commentText}
        </Typography>
      )}

      {/* Rating and date row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        {row.rating != null && (
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.82rem" }}>
            ★ {row.rating}/10
          </Typography>
        )}
        <Typography sx={{ fontSize: "0.7rem", color: "#7795de", fontFamily: "Century Gothic, sans-serif", ml: "auto" }}>
          {formatDate(row.commentCreatedAt)}
        </Typography>
      </Box>
    </Box>
  );
}
