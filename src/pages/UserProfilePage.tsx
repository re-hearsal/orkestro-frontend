import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Popover, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TelegramIcon from "@mui/icons-material/Telegram";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import UserAvatar from "../components/profile/UserAvatar";
import EditProfileDialog from "../components/profile/EditProfileDialog";
import ChangePasswordDialog from "../components/profile/ChangePasswordDialog";
import DeleteAccountDialog from "../components/profile/DeleteAccountDialog";
import InstrumentPicker, { type InstrumentDTO, InstrumentIcon, instrumentI18nKey } from "../components/profile/InstrumentPicker";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";

type CurrentUserResponseDTO = components["schemas"]["CurrentUserResponseDTO"];
type MusicalRoleDTO = components["schemas"]["MusicalRoleDTO"];

function instrumentSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, "-");
}

function formatBirthDate(dateStr: string, lang: string): string {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return lang === "ru" ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
}

export default function UserProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert } = useAppAlert();

  const [fullProfile, setFullProfile] = useState<CurrentUserResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  // Instruments state
  const [myInstruments, setMyInstruments] = useState<MusicalRoleDTO[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeAnchor, setRemoveAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  // Telegram state
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);
  const prevTelegramUserIdRef = useRef<number | undefined>(undefined);

  const fetchFullProfile = async () => {
    if (!user) return;
    const { data } = await client.GET("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    if (data) setFullProfile(data as CurrentUserResponseDTO);
  };

  const fetchMyInstruments = async () => {
    if (!user) return;
    const { data } = await client.GET("/api/v1/users/me/musical-roles", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    if (data) setMyInstruments(Array.isArray(data) ? data : [data as MusicalRoleDTO]);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFullProfile(), fetchMyInstruments()]).finally(() => setLoading(false));
  }, [user]);

  // Detect Telegram linking via WS update in AuthContext.profile
  useEffect(() => {
    const prev = prevTelegramUserIdRef.current;
    const current = profile?.telegramUserId;
    if (prev === undefined) {
      prevTelegramUserIdRef.current = current;
      return;
    }
    if (!prev && current) {
      showAlert(t("profile.telegram.success"), "success");
      setTelegramToken(null);
      void fetchFullProfile();
    }
    prevTelegramUserIdRef.current = current;
  }, [profile?.telegramUserId]);

  const handleAvatarUpdated = async (fileId: number | null) => {
    setFullProfile((prev) => prev ? { ...prev, profileImageFileId: fileId ?? undefined } : prev);
    await refreshProfile();
    await fetchFullProfile();
  };

  const handleProfileSaved = async (updated: CurrentUserResponseDTO) => {
    setFullProfile(updated);
    await refreshProfile();
  };

  const handleInstrumentAdded = (instrument: InstrumentDTO) => {
    setMyInstruments((prev) => [...prev, { instrumentId: instrument.id, instrumentName: instrument.name }]);
    setPickerOpen(false);
  };

  const handleRemoveInstrument = async (instrumentId: number) => {
    if (!user) return;
    setRemoving(instrumentId);
    setRemoveAnchor(null);
    try {
      await client.DELETE("/api/v1/users/me/musical-roles/{instrumentId}", {
        params: { path: { instrumentId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setMyInstruments((prev) => prev.filter((i) => i.instrumentId !== instrumentId));
    } catch {
      showAlert(t("profile.removeInstrument") + " error", "error");
    } finally {
      setRemoving(null);
    }
  };

  const handleLinkTelegram = async () => {
    if (!user) return;
    setLinkingTelegram(true);
    try {
      const { data } = await client.POST("/api/v1/users/me/telegram/link-token", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (data?.token) {
        setTelegramToken(data.token);
      }
    } catch {
      showAlert(t("profile.telegram.link") + " error", "error");
    } finally {
      setLinkingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!user) return;
    setUnlinkingTelegram(true);
    try {
      await client.DELETE("/api/v1/users/me/telegram/link", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      await fetchFullProfile();
      await refreshProfile();
      showAlert(t("profile.telegram.unlinked"), "success");
    } catch {
      showAlert(t("profile.telegram.unlink") + " error", "error");
    } finally {
      setUnlinkingTelegram(false);
    }
  };

  const handleCopyTelegramLink = async () => {
    if (!telegramToken) return;
    const link = `https://t.me/orkestro_helper_bot?start=${telegramToken}`;
    try {
      await navigator.clipboard.writeText(link);
      showAlert(t("profile.telegram.copied"), "success");
    } catch {
      showAlert(link, "info");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  const empty = t("profile.empty");

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 720, mx: "auto" }}>
      {/* Header row */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="outlined"
          onClick={() => setEditOpen(true)}
          sx={{
            borderRadius: "8px",
            borderColor: "#0f3eb5",
            color: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            textTransform: "none",
            "&:hover": {
              borderColor: "#0f3eb5",
              backgroundColor: "rgba(15,62,181,0.08)",
            },
          }}
        >
          {t("profile.editButton")}
        </Button>
      </Box>

      {/* Avatar + name */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center", mb: 4, gap: 2 }}>
        <UserAvatar
          profileImageFileId={fullProfile?.profileImageFileId}
          userName={fullProfile?.name ?? profile?.name ?? ""}
          onAvatarUpdated={handleAvatarUpdated}
        />
        <Typography
          variant="h5"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", textAlign: { xs: "center", sm: "left" } }}
        >
          {fullProfile?.name ?? profile?.name ?? profile?.username ?? ""}
        </Typography>
      </Box>

      {/* General info section */}
      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid #7795de",
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
            { label: t("profile.username"), value: fullProfile?.username },
            { label: t("profile.name"), value: fullProfile?.name },
            { label: t("profile.email"), value: fullProfile?.email },
            { label: t("profile.location"), value: fullProfile?.location },
            {
              label: t("profile.birthDate"),
              value: fullProfile?.birthDate
                ? formatBirthDate(fullProfile.birthDate, i18n.language)
                : undefined,
            },
            {
              label: t("profile.preferredLanguage"),
              value: fullProfile?.preferredLanguage
                ? t(`profile.language.${fullProfile.preferredLanguage}`)
                : undefined,
            },
          ] as { label: string; value: string | undefined }[]
        ).map(({ label, value }) => (
          <Box
            key={label}
            sx={{
              display: "flex",
              gap: 1,
              mb: 1,
              alignItems: "baseline",
            }}
          >
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
          borderRadius: "12px",
          border: "1px solid #7795de",
          p: 3,
          mb: 3,
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, mb: 2, color: "#0f3eb5" }}
        >
          {t("profile.instruments")}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
          {myInstruments.map((role) => {
            const id = role.instrumentId!;
            const apiName = role.instrumentName ?? "";
            const i18nKey = instrumentI18nKey(apiName);
            const translated = t(`organizations.instrumentNames.${i18nKey}`);
            const name = translated === `organizations.instrumentNames.${i18nKey}` ? apiName : translated;
            const slug = instrumentSlug(apiName);
            const isRemoving = removing === id;
            return (
              <Box key={id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                <Box
                  component="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                    setRemoveAnchor({ el: e.currentTarget, id })
                  }
                  disabled={isRemoving}
                  sx={{
                    background: "none",
                    border: "1px solid #dce6f9",
                    borderRadius: "12px",
                    p: 1,
                    cursor: isRemoving ? "default" : "pointer",
                    opacity: isRemoving ? 0.5 : 1,
                    "&:hover": { borderColor: "#e53e3e", backgroundColor: "#fff5f5" },
                    transition: "border-color 0.15s, background-color 0.15s",
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

          <IconButton
            onClick={() => setPickerOpen(true)}
            sx={{
              width: 64,
              height: 64,
              border: "1px dashed #dce6f9",
              borderRadius: "12px",
              color: "#0f3eb5",
              alignSelf: "flex-start",
              "&:hover": { backgroundColor: "#eef2ff", borderColor: "#0f3eb5" },
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Remove instrument popover */}
      <Popover
        open={Boolean(removeAnchor)}
        anchorEl={removeAnchor?.el}
        onClose={() => setRemoveAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: "12px", p: 1.5 } } }}
      >
        <Button
          size="small"
          color="error"
          variant="outlined"
          onClick={() => removeAnchor && void handleRemoveInstrument(removeAnchor.id)}
          sx={{ fontFamily: "Century Gothic, sans-serif", borderRadius: "8px", textTransform: "none" }}
        >
          {t("profile.removeInstrument")}
        </Button>
      </Popover>

      {/* Instrument picker dialog */}
      <InstrumentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        myInstrumentIds={myInstruments.map((i) => i.instrumentId!)}
        onAdd={handleInstrumentAdded}
      />

      {/* Notification channel section */}
      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid #7795de",
          p: 3,
          mb: 3,
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, mb: 2, color: "#0f3eb5" }}
        >
          {t("profile.channel.title")}
        </Typography>

        {/* Current channel */}
        {fullProfile?.notificationChannel && (
          <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "baseline" }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 600,
                color: "#7795de",
                minWidth: 140,
                fontSize: "0.95rem",
              }}
            >
              {t("profile.channel.title")}:
            </Typography>
            <Typography
              sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontSize: "0.95rem", whiteSpace: "nowrap" }}
            >
              {t(`profile.channel.${fullProfile.notificationChannel}`)}
            </Typography>
          </Box>
        )}

        {/* Telegram block */}
        {fullProfile?.telegramUserId ? (
          /* Linked state */
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TelegramIcon sx={{ color: "#2AABEE" }} />
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5", fontSize: "0.95rem" }}>
                {t("profile.telegram.linked")}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={unlinkingTelegram}
              onClick={() => void handleUnlinkTelegram()}
              sx={{ fontFamily: "Century Gothic, sans-serif", borderRadius: "8px", fontWeight: 700, textTransform: "none" }}
            >
              {unlinkingTelegram ? <CircularProgress size={16} /> : t("profile.telegram.unlink")}
            </Button>
          </Box>
        ) : (
          /* Unlinked state */
          <Box sx={{ mt: 1 }}>
            {telegramToken ? (
              /* Waiting for user to press Start in bot */
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography
                  sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", color: "#7795de" }}
                >
                  {t("profile.telegram.waitingHint")}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => void handleCopyTelegramLink()}
                  startIcon={<TelegramIcon />}
                  sx={{
                    fontFamily: "Century Gothic, sans-serif",
                    borderRadius: "8px",
                    backgroundColor: "#2AABEE",
                    "&:hover": { backgroundColor: "#1a8ec9" },
                    alignSelf: "flex-start",
                  }}
                >
                  {t("profile.telegram.copyLink")}
                </Button>
              </Box>
            ) : (
              <Button
                variant="contained"
                size="small"
                disabled={linkingTelegram}
                onClick={() => void handleLinkTelegram()}
                startIcon={linkingTelegram ? <CircularProgress size={16} sx={{ color: "white" }} /> : <TelegramIcon />}
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  borderRadius: "8px",
                  backgroundColor: "#2AABEE",
                  "&:hover": { backgroundColor: "#1a8ec9" },
                }}
              >
                {t("profile.telegram.link")}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Security section */}
      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid #7795de",
          p: 3,
          mb: 3,
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, mb: 2, color: "#0f3eb5" }}
        >
          {t("profile.security.title")}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setChangePasswordOpen(true)}
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              alignSelf: "flex-start",
              "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
            }}
          >
            {t("profile.security.changePassword")}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteAccountOpen(true)}
            sx={{
              borderRadius: "8px",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              alignSelf: "flex-start",
            }}
          >
            {t("profile.security.deleteAccount")}
          </Button>
        </Box>
      </Box>

      {/* Edit profile dialog */}
      {fullProfile && (
        <EditProfileDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={fullProfile}
          onSaved={(updated) => void handleProfileSaved(updated)}
        />
      )}

      {/* Change password dialog */}
      {fullProfile?.username && (
        <ChangePasswordDialog
          open={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
          username={fullProfile.username}
        />
      )}

      {/* Delete account dialog */}
      <DeleteAccountDialog
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
      />
    </Box>
  );
}
