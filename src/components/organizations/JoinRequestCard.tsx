import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { isBlobUrl, toRenderableImageSource } from "../../utils/imageSource";
import { navigateToUser } from "../../utils/navigateToUser";

export type JoinRequestDTO = components["schemas"]["OrganizationJoinRequestDTO"];

interface JoinRequestCardProps {
  request: JoinRequestDTO;
  canManage: boolean;
  currentUserId?: number;
  onApprove: (request: JoinRequestDTO) => Promise<void>;
  onReject: (request: JoinRequestDTO) => Promise<void>;
}

function getDisplayName(request: JoinRequestDTO): string {
  return request.name?.trim() ?? request.username?.trim() ?? "";
}

function getInitials(request: JoinRequestDTO): string {
  const name = getDisplayName(request);
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatDateLabel(value: string | undefined): string {
  if (!value) {return "-";}
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {return "-";}
  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

export default function JoinRequestCard({
  request,
  canManage,
  currentUserId,
  onApprove,
  onReject,
}: JoinRequestCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    const revokeObjectUrl = () => {
      if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };

    if (!user || request.profileImageFileId === undefined || request.profileImageFileId === null) {
      revokeObjectUrl();
      setAvatarUrl(null);
      return;
    }

    const fileId = request.profileImageFileId;

    let cancelled = false;

    const loadAvatar = async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });

        if (cancelled || !data) {
          return;
        }

        revokeObjectUrl();
        const nextUrl = await toRenderableImageSource(data as unknown as Blob);
        objectUrlRef.current = nextUrl;

        if (!cancelled) {
          setAvatarUrl(nextUrl);
        }
      } catch {
        if (!cancelled) {
          revokeObjectUrl();
          setAvatarUrl(null);
        }
      }
    };

    void loadAvatar();

    return () => {
      cancelled = true;
      revokeObjectUrl();
    };
  }, [request.profileImageFileId, user]);

  const displayName = useMemo(() => getDisplayName(request), [request]);
  const showUsername = Boolean(request.username && request.username !== displayName);
  const dateLabel = useMemo(
    () => formatDateLabel(request.joinedAt),
    [request.joinedAt]
  );

  const handleAction = async (
    action: "approve" | "reject",
    callback: (item: JoinRequestDTO) => Promise<void>
  ) => {
    if (activeAction) {
      return;
    }

    setActiveAction(action);
    try {
      await callback(request);
    } catch {
      return;
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: { xs: "16px", sm: "50px" },
        border: "1px solid #7795de",
        backgroundColor: "#ffffff",
        px: { xs: 1.5, sm: 2.25 },
        py: 1.2,
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        gap: 1.5,
        width: "100%",
      }}
    >
      <Box
        onClick={() => navigateToUser(request.userId, currentUserId, navigate)}
        sx={{
          cursor: request.userId ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flex: 1,
          minWidth: 0,
          "&:hover": request.userId ? { opacity: 0.85 } : {},
        }}
      >
      <Avatar
        src={avatarUrl ?? undefined}
        alt={displayName}
        sx={{
          width: 48,
          height: 48,
          border: "1px solid #7795de",
          bgcolor: "#e8f0ff",
          color: "#0f3eb5",
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
        }}
      >
        {getInitials(request)}
      </Avatar>

      <Stack spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
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
          {displayName || request.username || "-"}
          {showUsername ? ` (@${request.username})` : ""}
        </Typography>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
            fontSize: "0.77rem",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.35,
          }}
        >
          {request.description?.trim() || "-"}
        </Typography>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#9aa7c7",
            fontSize: "0.72rem",
          }}
        >
          {t("joinRequests.submittedAt", { date: dateLabel })}
        </Typography>
      </Stack>
      </Box>

      {canManage && (
        <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap", alignSelf: { xs: "stretch", sm: "auto" } }}>
          <Button
            variant="outlined"
            size="small"
            disabled={Boolean(activeAction)}
            onClick={() => {
              void handleAction("approve", onApprove);
            }}
            sx={{
              minWidth: 102,
              flex: { xs: 1, sm: "none" },
              borderRadius: "999px",
              textTransform: "none",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
            }}
          >
            {activeAction === "approve" ? <CircularProgress size={16} /> : t("joinRequests.approve")}
          </Button>

          <Button
            variant="outlined"
            color="error"
            size="small"
            disabled={Boolean(activeAction)}
            onClick={() => {
              void handleAction("reject", onReject);
            }}
            sx={{
              minWidth: 102,
              flex: { xs: 1, sm: "none" },
              borderRadius: "999px",
              textTransform: "none",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
            }}
          >
            {activeAction === "reject" ? <CircularProgress size={16} color="error" /> : t("joinRequests.reject")}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
