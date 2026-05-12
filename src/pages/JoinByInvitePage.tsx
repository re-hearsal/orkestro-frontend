import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { isBlobUrl, toRenderableImageSource } from "../utils/imageSource";
import { getOrgAvatarSvgDataUri } from "../utils/orgAvatarSvg";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];

const MAX_DESCRIPTION_LENGTH = 1000;
const PENDING_INVITE_CODE_KEY = "pendingInviteCode";

function extractApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if ("details" in error && Array.isArray(error.details)) {
    const details = error.details.filter(
      (item): item is string => typeof item === "string"
    );

    if (details.length > 0) {
      return details.join("\n");
    }
  }

  for (const nestedValue of Object.values(error as Record<string, unknown>)) {
    if (nestedValue && typeof nestedValue === "object") {
      const nestedMessage = extractApiErrorMessage(nestedValue);
      if (nestedMessage) {
        return nestedMessage;
      }
    }
  }

  return null;
}

function resolveJoinError(error: unknown, fallback: string, alreadyPending: string): string {
  const errorMessage = extractApiErrorMessage(error)?.toLowerCase() ?? "";
  if (errorMessage.includes("already") || errorMessage.includes("pending")) {
    return alreadyPending;
  }

  return fallback;
}

export default function JoinByInvitePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, initialized } = useAuth();

  const inviteCode = useMemo(
    () => (searchParams.get("code") ?? "").trim(),
    [searchParams]
  );

  const avatarObjectUrlRef = useRef<string | null>(null);

  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const revokeAvatarObjectUrl = useCallback(() => {
    if (avatarObjectUrlRef.current && isBlobUrl(avatarObjectUrlRef.current)) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }
    avatarObjectUrlRef.current = null;
  }, []);

  useEffect(() => {
    if (!initialized || user || !inviteCode) {
      return;
    }

    localStorage.setItem(PENDING_INVITE_CODE_KEY, inviteCode);
    navigate("/auth", { replace: true });
  }, [initialized, inviteCode, navigate, user]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!inviteCode) {
      setOrganization(null);
      setLoadError(String(t("join.invalidCode")));
      setLoading(false);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadOrganization = async () => {
      setLoading(true);
      setLoadError(null);
      setSubmitted(false);
      setSubmitError(null);

      try {
        const { data, error } = await client.GET("/api/v1/organizations/invite-info", {
          params: { query: { code: inviteCode } },
        });

        if (cancelled) {
          return;
        }

        if (error || !data) {
          setOrganization(null);
          setLoadError(String(t("join.invalidCode")));
          return;
        }

        setOrganization(data as OrganizationDTO);
      } catch {
        if (!cancelled) {
          setOrganization(null);
          setLoadError(String(t("join.invalidCode")));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, [initialized, inviteCode, t, user]);

  useEffect(() => {
    if (!organization?.profileImageFileId) {
      revokeAvatarObjectUrl();
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;

    const loadAvatar = async () => {
      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: organization.profileImageFileId as number } },
          headers: user ? { Authorization: `Bearer ${user.token}` } : undefined,
          parseAs: "blob",
        });

        if (cancelled) {
          return;
        }

        revokeAvatarObjectUrl();

        if (!data) {
          setAvatarUrl(null);
          return;
        }

        const nextUrl = await toRenderableImageSource(data as unknown as Blob);
        avatarObjectUrlRef.current = nextUrl;
        setAvatarUrl(nextUrl);
      } catch {
        if (!cancelled) {
          revokeAvatarObjectUrl();
          setAvatarUrl(null);
        }
      }
    };

    void loadAvatar();

    return () => {
      cancelled = true;
    };
  }, [organization?.profileImageFileId, revokeAvatarObjectUrl, user]);

  useEffect(() => {
    return () => {
      revokeAvatarObjectUrl();
    };
  }, [revokeAvatarObjectUrl]);

  const handleSubmit = async () => {
    if (!inviteCode || !user || submitting || submitted) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const nextDescription = description.trim();
      const { error } = await client.POST("/api/v1/organizations/join/invite", {
        params: { query: { code: inviteCode } },
        headers: { Authorization: `Bearer ${user.token}` },
        body: nextDescription ? { description: nextDescription } : {},
      });

      if (error) {
        setSubmitError(
          resolveJoinError(
            error,
            String(t("join.invalidCode")),
            String(t("join.alreadyPending"))
          )
        );
        return;
      }

      localStorage.removeItem(PENDING_INVITE_CODE_KEY);
      setSubmitted(true);
      setDescription("");
    } catch {
      setSubmitError(String(t("join.invalidCode")));
    } finally {
      setSubmitting(false);
    }
  };

  const fallbackAvatar = useMemo(
    () => getOrgAvatarSvgDataUri(organization?.name ?? ""),
    [organization?.name]
  );

  if (!initialized) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  if (!user && inviteCode) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
        background:
          "radial-gradient(circle 500px at 0% 75%, rgba(15,62,181,0.86) 0%, transparent 100%)," +
          "radial-gradient(circle 500px at 100% 75%, rgba(15,62,181,0.86) 0%, transparent 100%)",
        backgroundColor: "white",
      }}
    >
      <Paper
        elevation={4}
        sx={{
          width: "100%",
          maxWidth: 680,
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          background: "linear-gradient(135deg, #e8f0ff 0%, #ffffff 100%)",
        }}
      >
        <Stack spacing={2.5}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              color: "#0f3eb5",
              textAlign: "center",
            }}
          >
            {t("join.title")}
          </Typography>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress sx={{ color: "#0f3eb5" }} />
            </Box>
          )}

          {!loading && loadError && <Alert severity="error">{loadError}</Alert>}

          {!loading && !loadError && organization && (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Avatar
                  src={avatarUrl ?? fallbackAvatar}
                  alt={organization.name ?? ""}
                  sx={{ width: 84, height: 84, border: "2px solid #7795de" }}
                />

                <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontWeight: 700,
                      color: "#0f3eb5",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {organization.name}
                  </Typography>

                  {organization.location && (
                    <Typography
                      sx={{
                        fontFamily: "Century Gothic, sans-serif",
                        color: "#7795de",
                        fontSize: "0.95rem",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {organization.location}
                    </Typography>
                  )}
                </Stack>
              </Stack>

              {organization.description && (
                <Typography
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    color: "#0f3eb5",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    lineHeight: 1.55,
                  }}
                >
                  {organization.description}
                </Typography>
              )}

              <TextField
                label={t("join.descriptionLabel")}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH));
                  if (submitError) {
                    setSubmitError(null);
                  }
                }}
                fullWidth
                multiline
                minRows={4}
                maxRows={8}
                disabled={submitting || submitted}
                slotProps={{
                  htmlInput: { maxLength: MAX_DESCRIPTION_LENGTH },
                }}
                helperText={`${description.length}/${MAX_DESCRIPTION_LENGTH}`}
              />

              {submitError && (
                <Typography sx={{ color: "error.main", fontSize: "0.875rem" }}>
                  {submitError}
                </Typography>
              )}

              {submitted ? (
                <Stack spacing={2}>
                  <Alert severity="success">{t("join.successMessage")}</Alert>
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/organizations")}
                    sx={{
                      alignSelf: "flex-start",
                      borderRadius: "8px",
                      color: "#0f3eb5",
                      borderColor: "#0f3eb5",
                      textTransform: "none",
                      fontFamily: "Century Gothic, sans-serif",
                      fontWeight: 700,
                      "&:hover": {
                        borderColor: "#0f3eb5",
                        backgroundColor: "rgba(15,62,181,0.08)",
                      },
                    }}
                  >
                    {t("join.homeButton")}
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="contained"
                  disabled={submitting}
                  onClick={() => {
                    void handleSubmit();
                  }}
                  sx={{
                    alignSelf: "flex-start",
                    borderRadius: "8px",
                    textTransform: "none",
                    fontFamily: "Century Gothic, sans-serif",
                    fontWeight: 700,
                    backgroundColor: "#0f3eb5",
                    "&:hover": { backgroundColor: "#0c32a0" },
                  }}
                >
                  {t("join.submitButton")}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
