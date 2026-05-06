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
} from "@mui/material";
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
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"RU" | "EN">("RU");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
      setLocation(profile.location ?? "");
      setBirthDate(profile.birthDate ?? "");
      setPreferredLanguage((profile.preferredLanguage as "RU" | "EN") ?? "RU");
    }
  }, [open, profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const body: UserProfileUpdateRequestDTO = {};
      if (name.trim() !== (profile.name ?? "")) body.name = name.trim() || undefined;
      if (email.trim() !== (profile.email ?? "")) body.email = email.trim() || undefined;
      if (location.trim() !== (profile.location ?? "")) body.location = location.trim() || undefined;
      if (birthDate !== (profile.birthDate ?? "")) body.birthDate = birthDate || undefined;
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

      if (error) throw error;

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
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
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
          sx={{ position: "absolute", right: 12, top: 12, color: "#7795de" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
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
          <TextField
            label={t("profile.birthDate")}
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: new Date().toISOString().split("T")[0] } }}
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

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
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
  );
}
