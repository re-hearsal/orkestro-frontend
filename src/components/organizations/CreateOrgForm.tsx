import { useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useOrganization } from "../../hooks/useOrganization";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];
type ApiErrorResponse = components["schemas"]["ApiErrorResponse"];
type LinkType = components["schemas"]["OrganizationLinkDTO"]["linkType"];

type CreateOrganizationResponse = {
  data?: OrganizationDTO;
  error?: ApiErrorResponse;
};

type CreateOrganizationRequest = {
  headers: { Authorization: string };
  body: FormData;
  bodySerializer: (body: FormData) => FormData;
};

interface SocialLinkFormValue {
  linkType: LinkType;
  url: string;
}

interface FormErrors {
  name?: string;
  location?: string;
  description?: string;
  profileImage?: string;
  links?: string;
}

interface SocialLinkErrors {
  linkType?: string;
  url?: string;
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

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function mapBackendDetailsToErrors(details: string[], linksCount: number) {
  const fieldErrors: FormErrors = {};
  const linkErrors: SocialLinkErrors[] = Array.from({ length: linksCount }, () => ({}));
  const unknownDetails: string[] = [];

  details.forEach((detail) => {
    const lowerDetail = detail.toLowerCase();

    if (lowerDetail.includes("name") && !fieldErrors.name) {
      fieldErrors.name = detail;
      return;
    }
    if (lowerDetail.includes("location") && !fieldErrors.location) {
      fieldErrors.location = detail;
      return;
    }
    if (lowerDetail.includes("description") && !fieldErrors.description) {
      fieldErrors.description = detail;
      return;
    }
    if (lowerDetail.includes("profileimage") && !fieldErrors.profileImage) {
      fieldErrors.profileImage = detail;
      return;
    }

    if (lowerDetail.includes("link")) {
      const indexMatch = detail.match(/links\[(\d+)\]/i);
      if (indexMatch) {
        const index = Number(indexMatch[1]);
        if (Number.isInteger(index) && index >= 0 && index < linksCount) {
          if (lowerDetail.includes("linktype") && !linkErrors[index].linkType) {
            linkErrors[index].linkType = detail;
          } else if (!linkErrors[index].url) {
            linkErrors[index].url = detail;
          }
          return;
        }
      }
      if (!fieldErrors.links) {
        fieldErrors.links = detail;
      }
      return;
    }

    unknownDetails.push(detail);
  });

  return { fieldErrors, linkErrors, unknownDetails };
}

export default function CreateOrgForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();
  const { refreshOrganizations, setCurrentOrganization } = useOrganization();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinkFormValue[]>([]);

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [socialLinkErrors, setSocialLinkErrors] = useState<SocialLinkErrors[]>([]);
  const [loading, setLoading] = useState(false);

  const availableLinkTypes = LINK_TYPES.filter(
    (type) => !socialLinks.some((link) => link.linkType === type)
  );

  const postOrganization =
    client.POST as unknown as (
      path: "/api/v1/organizations",
      init: CreateOrganizationRequest
    ) => Promise<CreateOrganizationResponse>;

  const validateForm = () => {
    const errors: FormErrors = {};
    const linksErrors: SocialLinkErrors[] = socialLinks.map(() => ({}));

    const normalizedName = name.trim();
    const normalizedLocation = location.trim();

    if (!normalizedName) {
      errors.name = t("organizations.createForm.errors.nameRequired");
    } else if (normalizedName.length < 3) {
      errors.name = t("organizations.createForm.errors.nameMinLength");
    } else if (normalizedName.length > 255) {
      errors.name = t("organizations.createForm.errors.nameMaxLength");
    }

    if (!normalizedLocation) {
      errors.location = t("organizations.createForm.errors.locationRequired");
    } else if (normalizedLocation.length > 255) {
      errors.location = t("organizations.createForm.errors.locationMaxLength");
    }

    if (description.length > 1000) {
      errors.description = t("organizations.createForm.errors.descriptionMaxLength");
    }

    const linkTypeCounts = socialLinks.reduce((acc, link) => {
      const currentCount = acc.get(link.linkType) ?? 0;
      acc.set(link.linkType, currentCount + 1);
      return acc;
    }, new Map<LinkType, number>());

    socialLinks.forEach((link, index) => {
      if ((linkTypeCounts.get(link.linkType) ?? 0) > 1) {
        linksErrors[index].linkType = t("organizations.createForm.errors.linkTypeDuplicate");
      }

      const normalizedUrl = link.url.trim();
      if (!normalizedUrl) {
        linksErrors[index].url = t("organizations.createForm.errors.linkUrlRequired");
      } else if (!isValidUrl(normalizedUrl)) {
        linksErrors[index].url = t("organizations.createForm.errors.linkUrlInvalid");
      }
    });

    setFormErrors(errors);
    setSocialLinkErrors(linksErrors);

    const hasFieldErrors = Object.keys(errors).length > 0;
    const hasLinkErrors = linksErrors.some((item) => item.url || item.linkType);
    return !hasFieldErrors && !hasLinkErrors;
  };

  const handleAddLink = () => {
    if (availableLinkTypes.length === 0) {
      return;
    }

    setSocialLinks((prev) => [
      ...prev,
      { linkType: availableLinkTypes[0], url: "" },
    ]);
    setSocialLinkErrors((prev) => [...prev, {}]);
  };

  const handleRemoveLink = (index: number) => {
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
    setSocialLinkErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      showAlert(String(t("auth.errors.sessionExpired")), "error");
      navigate("/auth");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("location", location.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      if (profileImage) {
        formData.append("profileImage", profileImage);
      }
      socialLinks.forEach((link, index) => {
        formData.append(`links[${index}].linkType`, link.linkType);
        formData.append(`links[${index}].url`, link.url.trim());
      });

      const { data, error } = await postOrganization("/api/v1/organizations", {
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
        bodySerializer: (body) => body,
      });

      if (error || !data) {
        const apiError = error as ApiErrorResponse | undefined;

        if (apiError?.status === 401) {
          logout();
          showAlert(String(t("auth.errors.sessionExpired")), "error");
          navigate("/auth");
          return;
        }

        const details = apiError?.details ?? [];
        const mapped = mapBackendDetailsToErrors(details, socialLinks.length);

        setFormErrors((prev) => ({ ...prev, ...mapped.fieldErrors }));
        setSocialLinkErrors((prev) =>
          mapped.linkErrors.map((item, index) => ({ ...prev[index], ...item }))
        );

        const hasInlineErrors =
          Object.keys(mapped.fieldErrors).length > 0 ||
          mapped.linkErrors.some((item) => item.linkType || item.url);

        if (mapped.unknownDetails.length > 0) {
          showAlert(mapped.unknownDetails.join("\n"), "error");
        } else if (!hasInlineErrors) {
          showAlert(
            apiError?.message ?? String(t("organizations.createForm.errors.createFailed")),
            "error"
          );
        }
        return;
      }

      const newOrganization = data as unknown as OrganizationDTO;
      showAlert(String(t("organizations.createForm.success")), "success");
      refreshOrganizations();
      setCurrentOrganization(newOrganization);

      if (newOrganization.id != null) {
        navigate(`/organizations/${newOrganization.id}`);
      } else {
        navigate("/organizations");
      }
    } catch {
      showAlert(String(t("organizations.createForm.errors.createFailed")), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        maxWidth: 760,
        mx: "auto",
        p: { xs: 2.5, sm: 4 },
        borderRadius: 4,
        background: "linear-gradient(135deg, #e8f0ff 0%, #ffffff 100%)",
        fontFamily: "Century Gothic, sans-serif",
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
          mb: 3,
          textAlign: "center",
        }}
      >
        {t("organizations.createForm.title")}
      </Typography>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label={t("organizations.createForm.name")}
            placeholder={t("organizations.createForm.namePlaceholder")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFormErrors((prev) => ({ ...prev, name: undefined }));
            }}
            required
            fullWidth
            error={Boolean(formErrors.name)}
            helperText={formErrors.name}
          />

          <TextField
            label={t("organizations.createForm.location")}
            placeholder={t("organizations.createForm.locationPlaceholder")}
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              setFormErrors((prev) => ({ ...prev, location: undefined }));
            }}
            required
            fullWidth
            error={Boolean(formErrors.location)}
            helperText={formErrors.location}
          />

          <TextField
            label={t("organizations.createForm.description")}
            placeholder={t("organizations.createForm.descriptionPlaceholder")}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setFormErrors((prev) => ({ ...prev, description: undefined }));
            }}
            fullWidth
            multiline
            minRows={4}
            error={Boolean(formErrors.description)}
            helperText={formErrors.description}
          />

          <Box>
            <Button
              component="label"
              variant="outlined"
              sx={{
                borderRadius: "12px",
                borderColor: "#0f3eb5",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                textTransform: "none",
                px: 2,
                py: 1,
              }}
            >
              {t("organizations.createForm.profileImage")}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] ?? null;
                  setProfileImage(selectedFile);
                  setFormErrors((prev) => ({ ...prev, profileImage: undefined }));
                }}
              />
            </Button>

            {profileImage && (
              <Typography
                sx={{
                  mt: 1,
                  fontFamily: "Century Gothic, sans-serif",
                  color: "#7795de",
                  fontSize: "0.875rem",
                }}
              >
                {profileImage.name}
              </Typography>
            )}

            {formErrors.profileImage && (
              <Typography
                sx={{
                  mt: 0.75,
                  color: "error.main",
                  fontFamily: "Century Gothic, sans-serif",
                  fontSize: "0.75rem",
                }}
              >
                {formErrors.profileImage}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography
              sx={{
                mb: 1,
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                color: "#0f3eb5",
              }}
            >
              {t("organizations.createForm.socialLinks")}
            </Typography>

            <Stack spacing={1.5}>
              {socialLinks.map((link, index) => (
                <Box
                  key={`${link.linkType}-${index}`}
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "stretch", sm: "flex-start" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    select
                    label={t("organizations.createForm.linkType")}
                    value={link.linkType}
                    onChange={(event) => {
                      const value = event.target.value as LinkType;
                      setSocialLinks((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, linkType: value } : item
                        )
                      );
                      setSocialLinkErrors((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, linkType: undefined } : item
                        )
                      );
                    }}
                    fullWidth
                    sx={{ minWidth: { sm: 200 } }}
                    error={Boolean(socialLinkErrors[index]?.linkType)}
                    helperText={socialLinkErrors[index]?.linkType}
                  >
                    {LINK_TYPES.map((type) => (
                      <MenuItem
                        key={type}
                        value={type}
                        disabled={socialLinks.some(
                          (item, i) => i !== index && item.linkType === type
                        )}
                      >
                        {t(`organizations.createForm.linkTypes.${type}`)}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label={t("organizations.createForm.linkUrl")}
                    placeholder={t("organizations.createForm.linkUrlPlaceholder")}
                    value={link.url}
                    onChange={(event) => {
                      setSocialLinks((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, url: event.target.value } : item
                        )
                      );
                      setSocialLinkErrors((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, url: undefined } : item
                        )
                      );
                    }}
                    fullWidth
                    error={Boolean(socialLinkErrors[index]?.url)}
                    helperText={socialLinkErrors[index]?.url}
                  />

                  <Button
                    type="button"
                    color="error"
                    variant="text"
                    onClick={() => handleRemoveLink(index)}
                    sx={{
                      minWidth: { xs: "100%", sm: "auto" },
                      mt: { sm: 0.5 },
                      fontFamily: "Century Gothic, sans-serif",
                      textTransform: "none",
                    }}
                  >
                    {t("organizations.createForm.removeLink")}
                  </Button>
                </Box>
              ))}

              <Button
                type="button"
                variant="outlined"
                onClick={handleAddLink}
                disabled={availableLinkTypes.length === 0}
                sx={{
                  alignSelf: "flex-start",
                  borderRadius: "12px",
                  borderColor: "#0f3eb5",
                  color: "#0f3eb5",
                  fontFamily: "Century Gothic, sans-serif",
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#0f3eb5",
                    bgcolor: "#f0f4ff",
                  },
                }}
              >
                {t("organizations.createForm.addLink")}
              </Button>
            </Stack>

            {formErrors.links && (
              <Typography
                sx={{
                  mt: 0.75,
                  color: "error.main",
                  fontFamily: "Century Gothic, sans-serif",
                  fontSize: "0.75rem",
                }}
              >
                {formErrors.links}
              </Typography>
            )}
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              borderRadius: "8px",
              bgcolor: "#0f3eb5",
              color: "#ffffff",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              py: 1.2,
              "&:hover": { bgcolor: "#0c32a0" },
            }}
          >
            {t("organizations.createForm.submit")}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
