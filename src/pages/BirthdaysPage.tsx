import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Box, CircularProgress, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { isBlobUrl, toRenderableImageSource } from "../utils/imageSource";

interface BirthdayMember {
  id: number;
  name?: string;
  profileImageFileId?: number;
  month: number;
  day: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractMemberId(raw: unknown): number | null {
  const member = asRecord(raw) ?? {};
  const user = asRecord(member.user);
  const id =
    typeof member.id === "number" ? member.id :
    typeof member.userId === "number" ? member.userId :
    typeof user?.id === "number" ? user.id : null;
  return id;
}

interface PagedLike {
  content?: unknown[];
  page?: { totalElements?: number; totalPages?: number };
}

function MemberAvatar({ fileId, name }: { fileId?: number; name?: string }) {
  const { user } = useAuth();
  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const revoke = () => {
      if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };

    if (!user || fileId == null) { revoke(); return; }

    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });
        if (cancelled || !data) {return;}
        revoke();
        const url = await toRenderableImageSource(data as unknown as Blob);
        objectUrlRef.current = url;
        if (!cancelled) {setAvatarUrl(url);}
      } catch {
        if (!cancelled) { revoke(); setAvatarUrl(null); }
      }
    };

    void load();
    return () => { cancelled = true; revoke(); setAvatarUrl(null); };
  }, [fileId, user]);

  if (avatarUrl) {
    return <Avatar src={avatarUrl} sx={{ width: 40, height: 40, bgcolor: "#e8eef9" }} />;
  }

  return (
    <Avatar sx={{ width: 40, height: 40, bgcolor: "#e8eef9" }}>
      {name ? (
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "#0f3eb5" }}>
          {name.charAt(0).toUpperCase()}
        </Typography>
      ) : (
        <PersonIcon sx={{ color: "#7795de" }} />
      )}
    </Avatar>
  );
}

export default function BirthdaysPage() {
  const { t, i18n } = useTranslation();
  const { organizationId: rawOrgId, sectionId: rawSectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const sectionId = useMemo(
    () => (rawSectionId != null ? Number(rawSectionId) : undefined),
    [rawSectionId]
  );

  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const PAGE_SIZE = 100;
    const PROFILE_BATCH = 10;

    const fetchAll = async () => {
      if (!user || !Number.isFinite(organizationId) || organizationId <= 0) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Step 1: collect all member IDs
      const ids: number[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        try {
          const queryParams = { page, size: PAGE_SIZE };

          const { data } =
            sectionId != null
              ? await client.GET("/api/v1/sections/{sectionId}/members/page", {
                  params: { path: { sectionId }, query: queryParams as never },
                  headers: { Authorization: `Bearer ${user.token}` },
                })
              : await client.GET("/api/v1/organizations/{organizationId}/members/page", {
                  params: { path: { organizationId }, query: queryParams as never },
                  headers: { Authorization: `Bearer ${user.token}` },
                });

          if (cancelled) {return;}

          const paged = (data as unknown as PagedLike) ?? {};
          const content = paged.content ?? [];

          for (const raw of content) {
            const id = extractMemberId(raw);
            if (id != null) {ids.push(id);}
          }

          const totalPages = paged.page?.totalPages;
          hasMore = totalPages != null ? page + 1 < totalPages : content.length === PAGE_SIZE;
          page++;
        } catch {
          hasMore = false;
        }
      }

      if (cancelled) {return;}

      // Step 2: fetch public profiles in batches to get birthDate
      const result: BirthdayMember[] = [];

      for (let i = 0; i < ids.length; i += PROFILE_BATCH) {
        if (cancelled) {return;}
        const batch = ids.slice(i, i + PROFILE_BATCH);

        const profiles = await Promise.allSettled(
          batch.map((userId) =>
            client.GET("/api/v1/users/{userId}", {
              params: { path: { userId } },
              headers: { Authorization: `Bearer ${user.token}` },
            })
          )
        );

        for (const outcome of profiles) {
          if (outcome.status !== "fulfilled") {continue;}
          const profile = asRecord(outcome.value.data);
          if (!profile) {continue;}

          const birthDate = typeof profile.birthDate === "string" ? profile.birthDate : null;
          if (!birthDate) {continue;}

          const parts = birthDate.split("-");
          if (parts.length < 3) {continue;}
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          if (!month || !day) {continue;}

          const id = typeof profile.id === "number" ? profile.id : null;
          if (id == null) {continue;}

          const name = typeof profile.name === "string" ? profile.name : undefined;
          const profileImageFileId =
            typeof profile.profileImageFileId === "number" ? profile.profileImageFileId : undefined;

          result.push({ id, name, profileImageFileId, month, day });
        }
      }

      if (!cancelled) {
        setMembers(result);
        setLoading(false);
      }
    };

    void fetchAll();
    return () => { cancelled = true; };
  }, [organizationId, sectionId, user]);

  const grouped = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      if (a.month !== b.month) {return a.month - b.month;}
      return a.day - b.day;
    });

    const map = new Map<number, BirthdayMember[]>();
    for (const m of sorted) {
      const list = map.get(m.month) ?? [];
      list.push(m);
      map.set(m.month, list);
    }
    return map;
  }, [members]);

  const getMonthName = (monthNumber: number) => {
    const date = new Date(2000, monthNumber - 1, 1);
    return date.toLocaleDateString(i18n.language, { month: "long" });
  };

  const formatDay = (day: number, month: number) => {
    const date = new Date(2000, month - 1, day);
    return date.toLocaleDateString(i18n.language, { day: "numeric", month: "long" });
  };

  const backHref =
    sectionId != null
      ? `/organizations/${organizationId}/sections/${sectionId}`
      : `/organizations/${organizationId}`;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720, mx: "auto" }}>
      <Box
        onClick={() => navigate(backHref)}
        sx={{
          display: "inline-flex", alignItems: "center", gap: 0.5,
          cursor: "pointer", color: "#7795de", fontSize: "0.85rem",
          fontFamily: "Century Gothic, sans-serif", mb: 2,
          "&:hover": { color: "#0f3eb5" },
        }}
      >
        <ArrowBackIcon sx={{ fontSize: "1rem" }} />
        <Typography sx={{ fontSize: "0.85rem", fontFamily: "Century Gothic, sans-serif" }}>
          {sectionId != null ? t("sections.backToSection") : t("sections.backToOrganization")}
        </Typography>
      </Box>

      <Typography
        variant="h5"
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          mb: 3,
        }}
      >
        {t("birthdays.title")}
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : grouped.size === 0 ? (
        <Typography sx={{ color: "#7795de", fontFamily: "Century Gothic, sans-serif" }}>
          {t("birthdays.noBirthdays")}
        </Typography>
      ) : (
        Array.from(grouped.entries()).map(([month, list]) => (
          <Box key={month} sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                color: "#0f3eb5",
                fontSize: "1rem",
                mb: 1,
                textTransform: "capitalize",
                borderBottom: "1px solid #dce6f9",
                pb: 0.5,
              }}
            >
              {getMonthName(month)}
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {list.map((member) => (
                <Box
                  key={member.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid #dce6f9",
                    borderRadius: "10px",
                    px: 1.5,
                    py: 0.75,
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    "&:hover": { backgroundColor: "rgba(15,62,181,0.04)" },
                  }}
                  onClick={() => navigate(`/users/${member.id}`)}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <MemberAvatar fileId={member.profileImageFileId} name={member.name} />
                    <Typography
                      sx={{
                        fontFamily: "Century Gothic, sans-serif",
                        fontWeight: 600,
                        color: "#0f3eb5",
                        fontSize: "0.95rem",
                      }}
                    >
                      {member.name ?? "—"}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      color: "#7795de",
                      fontSize: "0.875rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDay(member.day, member.month)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
