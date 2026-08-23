import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ruRU, enUS } from "@mui/x-date-pickers/locales";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ru";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";

type CurrentUserResponseDTO = components["schemas"]["CurrentUserResponseDTO"];
type UserProfileUpdateRequestDTO = components["schemas"]["UserProfileUpdateRequestDTO"];

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: CurrentUserResponseDTO;
  onSaved: (updated: CurrentUserResponseDTO) => void;
}

export default function EditProfileDialog({
  open,
  onClose,
  profile,
  onSaved,
}: EditProfileDialogProps) {
  const { t, i18n } = useTranslation();
  const dayjsLocale = i18n.language === "ru" ? "ru" : "en";
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [birthDate, setBirthDate] = useState<Dayjs | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<"RU" | "EN">("RU");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
      setLocation(profile.location ?? "");
      setBirthDate(profile.birthDate ? dayjs(profile.birthDate) : null);
      setPreferredLanguage((profile.preferredLanguage as "RU" | "EN") ?? "RU");
    }
  }, [open, profile]);

  const handleSave = async () => {
    if (!user) {return;}
    setSaving(true);
    try {
      const body: UserProfileUpdateRequestDTO = {};
      const birthDateStr = birthDate?.isValid() ? birthDate.format("YYYY-MM-DD") : "";
      if (name.trim() !== (profile.name ?? "")) {body.name = name.trim() || undefined;}
      if (email.trim() !== (profile.email ?? "")) {body.email = email.trim() || undefined;}
      if (location.trim() !== (profile.location ?? "")) {body.location = location.trim() || undefined;}
      if (birthDateStr !== (profile.birthDate ?? "")) {body.birthDate = birthDateStr || undefined;}
      if (preferredLanguage !== ((profile.preferredLanguage as "RU" | "EN") ?? "RU")) {
        body.preferredLanguage = preferredLanguage;
      }

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const { data, error } = await client.PATCH("/api/v1/auth/profile", {
        headers: { Authorization: `Bearer ${user.token}` },
        body,
      });

      if (error) {throw error;}

      if (body.preferredLanguage) {
        await i18n.changeLanguage(body.preferredLanguage === "RU" ? "ru" : "en");
      }
      showAlert(String(t("profile.saveSuccess")), "success");
      onSaved((data as unknown as CurrentUserResponseDTO) ?? { ...profile, ...body });
      onClose();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Record<string, unknown>).message)
          : String(t("profile.saveSuccess"));
      showAlert(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={dayjsLocale}
      localeText={dayjsLocale === "ru" ? ruRU.components.MuiLocalizationProvider.defaultProps.localeText : enUS.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <Dialog
        open={open}
        onClose={saving ? undefined : onClose}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}
      >
        <DialogTitle
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            pr: 6,
          }}
        >
          {t("profile.editButton")}
          <IconButton
            onClick={onClose}
            disabled={saving}
            sx={{ position: "absolute", right: 12, top: 12, color: "#7795de", minWidth: 44, minHeight: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ overflowY: 'auto' }}>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField
              label={t("profile.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t("profile.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t("profile.location")}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
              size="small"
            />
            <DatePicker
              label={t("profile.birthDate")}
              value={birthDate}
              onChange={(val) => setBirthDate(val)}
              maxDate={dayjs()}
              slotProps={{
                textField: { fullWidth: true, size: "small" },
              }}
            />
            <TextField
              select
              label={t("profile.preferredLanguage")}
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as "RU" | "EN")}
              fullWidth
              size="small"
            >
              <MenuItem value="RU">{t("profile.language.RU")}</MenuItem>
              <MenuItem value="EN">{t("profile.language.EN")}</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>

        <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={saving}
            sx={{
              borderRadius: "8px",
              borderColor: "#7795de",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
            }}
          >
            {t("profile.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving}
            sx={{
              borderRadius: "8px",
              backgroundColor: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
              "&:hover": { backgroundColor: "#0c32a0" },
            }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("profile.save")}
          </Button>
        </Box>
      </Dialog>
    </LocalizationProvider>
  );
}
