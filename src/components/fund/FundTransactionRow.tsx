import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { isBlobUrl, toRenderableImageSource } from "../../utils/imageSource";

type OrgFundTransactionDTO = components["schemas"]["OrgFundTransactionDTO"];

interface FundTransactionRowProps {
  transaction: OrgFundTransactionDTO;
}

function getPerformerName(transaction: OrgFundTransactionDTO): string {
  const name = transaction.performedByName?.trim();
  if (name) {
    return name;
  }

  if (typeof transaction.performedByUserId === "number") {
    return `ID ${transaction.performedByUserId}`;
  }

  return "-";
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0 || value === "-") {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatAmount(value: number | undefined): string {
  const amount = typeof value === "number" ? value : 0;
  const formatted = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount);
  return amount > 0 ? `+${formatted}` : formatted;
}

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

export default function FundTransactionRow({ transaction }: FundTransactionRowProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const performerName = useMemo(() => getPerformerName(transaction), [transaction]);
  const amount = typeof transaction.amount === "number" ? transaction.amount : 0;

  useEffect(() => {
    const revokeObjectUrl = () => {
      if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };

    if (!user || transaction.performedByProfileImageFileId == null) {
      revokeObjectUrl();
      setAvatarUrl(null);
      return;
    }

    const fileId = transaction.performedByProfileImageFileId;
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
  }, [transaction.performedByProfileImageFileId, user]);

  return (
    <Box
      sx={{
        border: "1px solid #e7effb",
        borderRadius: "10px",
        p: 1.5,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "220px 150px 1fr 170px" },
        gap: 1.25,
        alignItems: { xs: "flex-start", md: "center" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar
          src={avatarUrl ?? undefined}
          alt={performerName}
          sx={{
            width: 36,
            height: 36,
            border: "1px solid #7795de",
            bgcolor: "#e8f0ff",
            color: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            fontSize: "0.8rem",
          }}
        >
          {getInitials(performerName)}
        </Avatar>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#0f3eb5",
            fontWeight: 700,
            fontSize: "0.9rem",
            wordBreak: "break-word",
          }}
        >
          {performerName}
        </Typography>
      </Box>

      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          fontSize: "0.95rem",
          color: amount > 0 ? "#2e7d32" : amount < 0 ? "#d32f2f" : "#0f3eb5",
        }}
      >
        {formatAmount(transaction.amount)}
      </Typography>

      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          color: "#1a2f63",
          fontSize: "0.9rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {transaction.description?.trim() || t("fund.page.noDescription")}
      </Typography>

      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          color: "#0f3eb5",
          fontSize: "0.9rem",
          textAlign: { xs: "left", md: "right" },
        }}
      >
        {formatDate(transaction.createdAt)}
      </Typography>
    </Box>
  );
}
