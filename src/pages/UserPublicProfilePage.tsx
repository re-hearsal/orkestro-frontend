import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { isBlobUrl, toRenderableImageSource } from "../utils/imageSource";
import client from "../api/client";
import type { components } from "../api/schema.d";
import { InstrumentIcon } from "../components/profile/InstrumentPicker";
import { instrumentI18nKey, sortByLocalizedLabel } from "../utils/instrumentI18n";

type UserData = components["schemas"]["PublicUserProfileDTO"];
type MusicalRoleDTO = components["schemas"]["MusicalRoleDTO"];

function instrumentSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, "-");
}

function formatBirthDate(dateStr: string, lang: string): string {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) {return dateStr;}
  return lang === "ru" ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
}

function normalizeMusicalRoles(data: unknown): MusicalRoleDTO[] {
  if (!data) {return [];}
  if (Array.isArray(data)) {
    return data as MusicalRoleDTO[];
  }
  return [data as MusicalRoleDTO];
}

export default function UserPublicProfilePage() {
  const { t, i18n } = useTranslation();
  const { userId: rawUserId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const userId = Number(rawUserId);

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userInstruments, setUserInstruments] = useState<MusicalRoleDTO[]>([]);

  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const localizedInstrumentName = (apiName: string): string => {
    const i18nKey = instrumentI18nKey(apiName);
    const translated = t(`organizations.instrumentNames.${i18nKey}`);
    return translated === `organizations.instrumentNames.${i18nKey}` ? apiName : translated;
  };

  useEffect(() => {
    if (profile?.id && userId === profile.id) {
      navigate("/profile", { replace: true });
    }
  }, [userId, profile?.id, navigate]);

  useEffect(() => {
    if (!user) {return;}
    if (!Number.isFinite(userId) || userId <= 0) {
      setLoading(false);
      setNotFound(true);
      setUserData(null);
      setUserInstruments([]);
      return;
    }

    setLoading(true);
    setNotFound(false);

    void (async () => {
      try {
        const [{ data, error }, { data: instrumentsData }] = await Promise.all([
          client.GET("/api/v1/users/{userId}", {
            params: { path: { userId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          client.GET("/api/v1/users/{userId}/musical-roles", {
            params: { path: { userId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);

        if (error) {
          const status = (error as Record<string, unknown>)?.status as number | undefined;
          if (status === 404) {
            setNotFound(true);
          }
          setUserData(null);
          setUserInstruments([]);
          setLoading(false);
          return;
        }

        setUserData(data ?? null);
        const rolesFromProfile = normalizeMusicalRoles((data as UserData | null)?.instruments);
        const rolesFromEndpoint = normalizeMusicalRoles(instrumentsData);
        setUserInstruments(rolesFromEndpoint.length > 0 ? rolesFromEndpoint : rolesFromProfile);
      } catch {
        setNotFound(true);
        setUserData(null);
        setUserInstruments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, user]);

  // Load avatar
  useEffect(() => {
    const revoke = () => {
      if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };

    if (!user || userData?.profileImageFileId == null) {
      revoke();
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;

    const loadAvatar = async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: userData.profileImageFileId as number } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });

        if (cancelled || !data) {return;}

        revoke();
        const nextUrl = await toRenderableImageSource(data as unknown as Blob);
        objectUrlRef.current = nextUrl;

        if (!cancelled) {
          setAvatarUrl(nextUrl);
        }
      } catch {
        if (!cancelled) {
          revoke();
          setAvatarUrl(null);
        }
      }
    };

    void loadAvatar();

    return () => {
      cancelled = true;
      revoke();
    };
  }, [userData?.profileImageFileId, user]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 720, mx: "auto" }}>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              borderRadius: "8px",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": { backgroundColor: "rgba(15,62,181,0.08)" },
            }}
          >
            {t("common.back", "Back")}
          </Button>
        </Box>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
            textAlign: "center",
            mt: 8,
          }}
        >
          {t("users.notFound")}
        </Typography>
      </Box>
    );
  }

  const empty = t("profile.empty");

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 720, mx: "auto" }}>
      {/* Back button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{
            borderRadius: "8px",
            color: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { backgroundColor: "rgba(15,62,181,0.08)" },
          }}
        >
          {t("common.back", "Back")}
        </Button>
      </Box>

      {/* Avatar + name */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center", mb: 4, gap: 2 }}>
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "1px solid #7795de",
            backgroundColor: "#e8f0ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <Box
              component="img"
              src={avatarUrl}
              alt={userData?.name ?? ""}
              onError={() => setAvatarUrl(null)}
              sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <PersonIcon sx={{ color: "#7795de", fontSize: 56 }} />
          )}
        </Box>

        <Typography
          variant="h5"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", textAlign: { xs: "center", sm: "left" } }}
        >
          {userData?.name ?? userData?.username ?? ""}
        </Typography>
      </Box>

      {/* General info section */}
      <Box
        sx={{
          border: "1px solid #7795de",
          borderRadius: "12px",
          p: 3,
          mb: 3,
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, mb: 2, color: "#0f3eb5" }}
        >
          {t("profile.generalInfo")}
        </Typography>

        {(
          [
            { label: t("profile.username"), value: userData?.username },
            { label: t("profile.name"), value: userData?.name },
            { label: t("profile.email"), value: userData?.email },
            { label: t("profile.location"), value: userData?.location },
            {
              label: t("profile.birthDate"),
              value: userData?.birthDate
                ? formatBirthDate(userData.birthDate, i18n.language)
                : undefined,
            },
          ] as { label: string; value: string | undefined }[]
        ).map(({ label, value }) => (
          <Box key={label} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "baseline" }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 600,
                color: "#7795de",
                minWidth: 140,
                fontSize: "0.95rem",
              }}
            >
              {label}:
            </Typography>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                color: value ? "#0f3eb5" : "#7795de",
                fontSize: "0.95rem",
              }}
            >
              {value ?? empty}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Instruments section */}
      <Box
        sx={{
          border: "1px solid #7795de",
          borderRadius: "12px",
          p: 3,
          mb: 3,
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, mb: 2, color: "#0f3eb5" }}
        >
          {t("profile.instrumentsPublic")}
        </Typography>

        {userInstruments.length === 0 ? (
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              color: "#7795de",
              fontSize: "0.95rem",
            }}
          >
            {t("profile.noInstruments")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
            {sortByLocalizedLabel(userInstruments, (role) => localizedInstrumentName(role.instrumentName ?? ""), i18n.language).map((role) => {
              const apiName = role.instrumentName ?? "";
              const name = localizedInstrumentName(apiName);
              const slug = instrumentSlug(apiName);
              return (
                <Box
                  key={role.instrumentId}
                  sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}
                >
                  <Box
                    sx={{
                      border: "1px solid #dce6f9",
                      borderRadius: "12px",
                      p: 1,
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <InstrumentIcon name={name} slug={slug} size={48} />
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontSize: "0.7rem",
                      color: "#0f3eb5",
                      textAlign: "center",
                      maxWidth: 64,
                      wordBreak: "break-word",
                      lineHeight: 1.2,
                    }}
                  >
                    {name}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
