import { useEffect, useState, useCallback } from "react";
import { Box, CircularProgress, Pagination, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { withFlatPagination } from "../../utils/pagination";
import { onInfoMessageCreated } from "../../utils/infoMessageEvents";
import OrgInfoMessageCard from "./OrgInfoMessageCard";

type OrgInfoMessageDTO = components["schemas"]["OrgInfoMessageDTO"];

interface PagePayload {
  content?: OrgInfoMessageDTO[];
  page?: { totalPages?: number };
}

interface Props {
  organizationId?: number;
  sectionId?: number;
}

export default function OrgInfoMessageSection({ organizationId, sectionId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [messages, setMessages] = useState<OrgInfoMessageDTO[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (p: number) => {
      if (!user) return;

      const query = withFlatPagination({}, { page: p, size: 10, sort: ["createdAt,desc"] });

      setLoading(true);
      try {
        if (sectionId != null) {
          const { data, error } = await client.GET(
            "/api/v1/sections/{sectionId}/info-messages",
            {
              params: { path: { sectionId }, query },
              headers: { Authorization: `Bearer ${user.token}` },
            }
          );
          if (error) throw error;
          const payload = data as unknown as PagePayload;
          setMessages(payload.content ?? []);
          setTotalPages(payload.page?.totalPages ?? 0);
        } else if (organizationId != null) {
          const { data, error } = await client.GET(
            "/api/v1/organizations/{organizationId}/info-messages",
            {
              params: { path: { organizationId }, query },
              headers: { Authorization: `Bearer ${user.token}` },
            }
          );
          if (error) throw error;
          const payload = data as unknown as PagePayload;
          setMessages(payload.content ?? []);
          setTotalPages(payload.page?.totalPages ?? 0);
        }
      } catch {
        setMessages([]);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    [organizationId, sectionId, user]
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  useEffect(() => {
    return onInfoMessageCreated(() => {
      setPage(0);
      void load(0);
    });
  }, [load]);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          fontSize: "1.15rem",
          mb: 2,
        }}
      >
        {t("infoMessage.sectionTitle")}
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} size={28} />
        </Box>
      ) : messages.length === 0 ? (
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
            fontSize: "0.9rem",
          }}
        >
          {t("infoMessage.empty")}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {messages.map((msg) => (
            <OrgInfoMessageCard key={msg.id} message={msg} />
          ))}
        </Stack>
      )}

      {totalPages > 1 && !loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(_, value) => setPage(value - 1)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
