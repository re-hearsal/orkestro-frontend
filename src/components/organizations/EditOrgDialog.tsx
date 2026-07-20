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
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];
type LinkType = components["schemas"]["OrganizationLinkDTO"]["linkType"];

interface SocialLink {
  linkType: LinkType;
  url: string;
}

interface EditOrgDialogProps {
  open: boolean;
  organization: OrganizationDTO;
  onClose: () => void;
  onSaved: (updated: OrganizationDTO) => void;
}

const LINK_TYPES: LinkType[] = [
  "WEBSITE",
  "VK",
  "YOUTUBE",
  "INSTAGRAM",
  "FACEBOOK",
  "TELEGRAM",
  "OTHER",
];

const URL_REGEX = /^https?:\/\/.+/;

export default function EditOrgDialog({
  open,
  organization,
  onClose,
  onSaved,
}: EditOrgDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(organization.name ?? "");
      setLocation(organization.location ?? "");
      setDescription(organization.description ?? "");
      setLinks(
        (organization.links ?? []).map((l) => ({
          linkType: l.linkType,
          url: l.url,
        }))
      );
      setErrors({});
    }
  }, [open, organization]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (name.trim().length > 0 && name.trim().length < 3) {
      next.name = String(t("organizations.editForm.errors.nameMinLength"));
    }
    if (name.length > 255) {
      next.name = String(t("organizations.editForm.errors.nameMaxLength"));
    }
    if (location.length > 255) {
      next.location = String(t("organizations.editForm.errors.locationMaxLength"));
    }
    if (description.length > 1000) {
      next.description = String(t("organizations.editForm.errors.descriptionMaxLength"));
    }

    const linkTypes = links.map((l) => l.linkType);
    const hasDuplicateLinkType = linkTypes.some((lt, i) => linkTypes.indexOf(lt) !== i);
    if (hasDuplicateLinkType) {
      next.links = String(t("organizations.editForm.errors.linkTypeDuplicate"));
    }

    for (let i = 0; i < links.length; i++) {
      if (!links[i].url.trim()) {
        next[`link_${i}_url`] = String(t("organizations.editForm.errors.linkUrlRequired"));
      } else if (!URL_REGEX.test(links[i].url.trim())) {
        next[`link_${i}_url`] = String(t("organizations.editForm.errors.linkUrlInvalid"));
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!user || !validate()) {return;}
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== (organization.name ?? "")) {
        body.name = name.trim();
      }
      if (location.trim() !== (organization.location ?? "")) {
        body.location = location.trim() || null;
      }
      if (description.trim() !== (organization.description ?? "")) {
        body.description = description.trim() || null;
      }
      const origLinks = (organization.links ?? []).map((l) => `${l.linkType}:${l.url}`).sort().join("|");
      const curLinks = links.map((l) => `${l.linkType}:${l.url.trim()}`).sort().join("|");
      if (curLinks !== origLinks) {
        body.links = links.map((l) => ({ linkType: l.linkType, url: l.url.trim() }));
      }

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const { data, error } = await client.PATCH(
        "/api/v1/organizations/{organizationId}",
        {
          params: { path: { organizationId: organization.id as number } },
          headers: { Authorization: `Bearer ${user.token}` },
          body: body as components["schemas"]["OrganizationUpdateRequestDTO"],
        }
      );

      if (error) {throw error;}

      showAlert(String(t("organizations.editForm.success")), "success");
      onSaved((data as unknown as OrganizationDTO) ?? { ...organization, ...body });
      onClose();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Record<string, unknown>).message)
          : String(t("organizations.editForm.errors.saveFailed"));
      showAlert(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    const usedTypes = new Set(links.map((l) => l.linkType));
    const nextType = LINK_TYPES.find((lt) => !usedTypes.has(lt)) ?? "OTHER";
    setLinks((prev) => [...prev, { linkType: nextType, url: "" }]);
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: keyof SocialLink, value: string) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  return (
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
        {t("organizations.editForm.title")}
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
            label={t("organizations.createForm.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
            fullWidth
            size="small"
          />

          <TextField
            label={t("organizations.createForm.location")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            error={Boolean(errors.location)}
            helperText={errors.location}
            fullWidth
            size="small"
          />

          <TextField
            label={t("organizations.createForm.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={Boolean(errors.description)}
            helperText={errors.description}
            multiline
            minRows={3}
            fullWidth
            size="small"
          />

          <Box>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                color: "#0f3eb5",
                fontWeight: 700,
                fontSize: "0.9rem",
                mb: 1,
              }}
            >
              {t("organizations.createForm.socialLinks")}
            </Typography>

            {errors.links && (
              <Typography sx={{ color: "error.main", fontSize: "0.8rem", mb: 1 }}>
                {errors.links}
              </Typography>
            )}

            <Stack spacing={1.5}>
              {links.map((link, index) => (
                <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <TextField
                    select
                    label={t("organizations.createForm.linkType")}
                    value={link.linkType}
                    onChange={(e) => updateLink(index, "linkType", e.target.value)}
                    size="small"
                    sx={{ minWidth: 130 }}
                  >
                    {LINK_TYPES.map((lt) => (
                      <MenuItem key={lt} value={lt}>
                        {String(t(`organizations.createForm.linkTypes.${lt}`))}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label={t("organizations.createForm.linkUrl")}
                    placeholder={String(t("organizations.createForm.linkUrlPlaceholder"))}
                    value={link.url}
                    onChange={(e) => updateLink(index, "url", e.target.value)}
                    error={Boolean(errors[`link_${index}_url`])}
                    helperText={errors[`link_${index}_url`]}
                    size="small"
                    fullWidth
                  />

                  <Button
                    variant="text"
                    color="error"
                    onClick={() => removeLink(index)}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      fontFamily: "Century Gothic, sans-serif",
                      textTransform: "none",
                      fontSize: "0.8rem",
                      whiteSpace: "nowrap",
                      mt: 0.5,
                    }}
                  >
                    {t("organizations.createForm.removeLink")}
                  </Button>
                </Box>
              ))}
            </Stack>

            <Button
              variant="outlined"
              size="small"
              onClick={addLink}
              disabled={links.length >= LINK_TYPES.length}
              sx={{
                mt: 1.5,
                borderRadius: "8px",
                borderColor: "#7795de",
                color: "#7795de",
                fontFamily: "Century Gothic, sans-serif",
                textTransform: "none",
                fontSize: "0.82rem",
              }}
            >
              {t("organizations.createForm.addLink")}
            </Button>
          </Box>
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
          {t("organizations.leaveDialog.cancel")}
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
          {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("organizations.editForm.submit")}
        </Button>
      </Box>
    </Dialog>
  );
}
