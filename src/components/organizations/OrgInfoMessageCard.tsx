import { Avatar, Box, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { navigateToUser } from "../../utils/navigateToUser";

type OrgInfoMessageDTO = components["schemas"]["OrgInfoMessageDTO"];

function formatDate(value?: string): string {
  if (!value) {return "-";}
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {return "-";}
  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function getInitials(name?: string): string {
  if (!name) {return "?";}
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {return parts[0][0]?.toUpperCase() ?? "?";}
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface Props {
  message: OrgInfoMessageDTO;
}

export default function OrgInfoMessageCard({ message }: Props) {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const revoke = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    if (!user || message.authorProfileImageFileId == null) {
      revoke();
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: message.authorProfileImageFileId as number } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });
        if (cancelled || !data) {return;}
        revoke();
        const url = URL.createObjectURL(data as unknown as Blob);
        objectUrlRef.current = url;
        if (!cancelled) {setAvatarUrl(url);}
      } catch {
        if (!cancelled) {
          revoke();
          setAvatarUrl(null);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      revoke();
      setAvatarUrl(null);
    };
  }, [message.authorProfileImageFileId, user]);

  return (
    <Box
      sx={{
        border: "1px solid #7795de",
        borderRadius: "12px",
        p: 2,
        backgroundColor: "#ffffff",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Avatar
          src={avatarUrl ?? undefined}
          sx={{
            width: 32,
            height: 32,
            bgcolor: "rgba(15,62,181,0.15)",
            fontSize: "0.75rem",
            color: "#0f3eb5",
            cursor: message.authorUserId ? "pointer" : "default",
          }}
          onClick={() =>
            navigateToUser(message.authorUserId, profile?.id, navigate)
          }
          onError={() => setAvatarUrl(null)}
        >
          {!avatarUrl && getInitials(message.authorName)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            onClick={() =>
              navigateToUser(message.authorUserId, profile?.id, navigate)
            }
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "#0f3eb5",
              cursor: message.authorUserId ? "pointer" : "default",
              "&:hover": message.authorUserId
                ? { textDecoration: "underline" }
                : undefined,
              display: "inline",
            }}
          >
            {message.authorName ?? "—"}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontSize: "0.7rem",
            color: "#7795de",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {formatDate(message.createdAt)}
        </Typography>
      </Box>

      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontSize: "0.95rem",
          color: "#333333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {message.text ?? ""}
      </Typography>
    </Box>
  );
}
