import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Box, CircularProgress, IconButton } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { getOrgAvatarSvgDataUri } from "../../utils/orgAvatarSvg";
import { isBlobUrl, toRenderableImageSource } from "../../utils/imageSource";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];
type ApiErrorResponse = components["schemas"]["ApiErrorResponse"];
type FileUploadResponseDTO = components["schemas"]["FileUploadResponseDTO"];

type UpdateOrganizationResponse = {
  data?: OrganizationDTO;
  error?: ApiErrorResponse;
};

type GetOrganizationResponse = {
  data?: OrganizationDTO;
  error?: ApiErrorResponse;
};

type UploadOrganizationImageResponse = {
  data?: FileUploadResponseDTO;
  error?: ApiErrorResponse;
};

type UploadOrganizationImageRequest = {
  headers: {
    Authorization: string;
  };
  body: FormData;
  bodySerializer: (body: FormData) => FormData;
};

type UpdateOrganizationImageRequest = {
  params: {
    path: {
      organizationId: number;
    };
  };
  headers: {
    Authorization: string;
  };
  body: {
    profileImageFileId: number;
  };
};

type DeleteOrganizationImageRequest = {
  params: {
    path: {
      organizationId: number;
    };
  };
  headers: {
    Authorization: string;
  };
};

type DeleteOrganizationImageResponse = {
  error?: ApiErrorResponse;
};

interface OrgAvatarProps {
  organizationId: number;
  organizationName: string;
  profileImageFileId?: number;
  canEdit: boolean;
  onOrganizationUpdated: (organization: OrganizationDTO) => void;
}

function getApiErrorMessage(error: unknown): string | null {
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

  for (const value of Object.values(error as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      const nested = getApiErrorMessage(value);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export default function OrgAvatar({
  organizationId,
  organizationName,
  profileImageFileId,
  canEdit,
  onOrganizationUpdated,
}: OrgAvatarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [updating, setUpdating] = useState(false);
  const fallbackAvatarUrl = useMemo(
    () => getOrgAvatarSvgDataUri(organizationName ?? ""),
    [organizationName]
  );

  const uploadOrganizationImage = client.POST as unknown as (
    path: "/api/v1/files/upload",
    init: UploadOrganizationImageRequest
  ) => Promise<UploadOrganizationImageResponse>;

  const updateOrganizationImage = client.PATCH as unknown as (
    path: "/api/v1/organizations/{organizationId}",
    init: UpdateOrganizationImageRequest
  ) => Promise<UpdateOrganizationResponse>;

  const deleteOrganizationImage = client.DELETE as unknown as (
    path: "/api/v1/organizations/{organizationId}/profile-image",
    init: DeleteOrganizationImageRequest
  ) => Promise<DeleteOrganizationImageResponse>;

  const getOrganization = client.GET as unknown as (
    path: "/api/v1/organizations/{organizationId}",
    init: DeleteOrganizationImageRequest
  ) => Promise<GetOrganizationResponse>;

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = null;
  }, []);

  const refreshOrganization = useCallback(async () => {
    if (!user) {
      return;
    }

    const { data, error } = await getOrganization(
      "/api/v1/organizations/{organizationId}",
      {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );

    if (error || !data) {
      throw new Error(
        getApiErrorMessage(error) ?? t("organizations.profile.avatarUpdateError")
      );
    }

    onOrganizationUpdated(data as unknown as OrganizationDTO);
  }, [getOrganization, onOrganizationUpdated, organizationId, t, user]);

  useEffect(() => {
    if (!user || profileImageFileId == null) {
      revokeObjectUrl();
      setImageUrl(null);
      setLoadingImage(false);
      return;
    }

    let cancelled = false;

    const loadImage = async () => {
      setLoadingImage(true);

      try {
        const { data } = await client.GET("/api/v1/files/{fileId}", {
          params: { path: { fileId: profileImageFileId } },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        });

        if (cancelled) {
          return;
        }

        revokeObjectUrl();

        if (data) {
          const nextUrl = await toRenderableImageSource(data as unknown as Blob);
          objectUrlRef.current = nextUrl;
          setImageUrl(nextUrl);
        } else {
          setImageUrl(null);
        }
      } catch {
        if (!cancelled) {
          revokeObjectUrl();
          setImageUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingImage(false);
        }
      }
    };

    void loadImage();

    return () => {
      cancelled = true;
    };
  }, [profileImageFileId, revokeObjectUrl, user]);

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user) {
      return;
    }

    setUpdating(true);

    try {
      const uploadBody = new FormData();
      uploadBody.append("file", file);
      uploadBody.append("fileType", "PHOTO");

      const { data: uploadData, error: uploadError } = await uploadOrganizationImage(
        "/api/v1/files/upload",
        {
          headers: { Authorization: `Bearer ${user.token}` },
          body: uploadBody,
          bodySerializer: (body) => body,
        }
      );

      if (uploadError || uploadData?.id == null) {
        throw new Error(
          getApiErrorMessage(uploadError) ?? t("organizations.profile.avatarUploadError")
        );
      }

      const { data: updatedOrganization, error: updateError } = await updateOrganizationImage(
        "/api/v1/organizations/{organizationId}",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
          body: { profileImageFileId: uploadData.id },
        }
      );

      if (updateError) {
        throw new Error(
          getApiErrorMessage(updateError) ?? t("organizations.profile.avatarUpdateError")
        );
      }

      if (updatedOrganization) {
        onOrganizationUpdated(updatedOrganization as unknown as OrganizationDTO);
      } else {
        await refreshOrganization();
      }
    } catch (error) {
      showAlert(
        getApiErrorMessage(error) ?? t("organizations.profile.avatarUnknownError"),
        "error"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleClearImage = async () => {
    if (!user) {
      return;
    }

    setUpdating(true);

    try {
      const { error } = await deleteOrganizationImage(
        "/api/v1/organizations/{organizationId}/profile-image",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );

      if (error) {
        throw new Error(
          getApiErrorMessage(error) ?? t("organizations.profile.avatarDeleteError")
        );
      }

      await refreshOrganization();
    } catch (error) {
      showAlert(
        getApiErrorMessage(error) ?? t("organizations.profile.avatarUnknownError"),
        "error"
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          maxWidth: "100%",
          mx: "auto",
          borderRadius: "24px",
          border: "1px solid #7795de",
          overflow: "hidden",
          height: { xs: 160, sm: 220 },
          background: "linear-gradient(135deg, #e8f0ff 0%, #ffffff 100%)",
          "&:hover .org-avatar-overlay": canEdit
            ? {
                opacity: 1,
                pointerEvents: "auto",
              }
            : undefined,
        }}
      >
        <Box
          component="img"
          src={imageUrl ?? fallbackAvatarUrl}
          alt={organizationName}
          onError={() => setImageUrl(null)}
          sx={{
            width: "auto",
            maxWidth: "100%",
            height: "100%",
            minWidth: { xs: 160, sm: 220 },
            objectFit: "contain",
            objectPosition: "center",
            display: "block",
            backgroundColor: "#e8f0ff",
          }}
        />

        {(loadingImage || updating) && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.45)",
              zIndex: 2,
            }}
          >
            <CircularProgress sx={{ color: "#0f3eb5" }} />
          </Box>
        )}

        {canEdit && (
          <Box
            className="org-avatar-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              backgroundColor: "rgba(15,62,181,0.45)",
              opacity: updating ? 1 : 0,
              pointerEvents: updating ? "auto" : "none",
              transition: "opacity 0.2s",
              "@media (hover: none)": {
                opacity: 1,
                pointerEvents: "auto",
                backgroundColor: "transparent",
              },
              zIndex: 3,
            }}
          >
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={updating}
              aria-label={t("organizations.profile.changeAvatar")}
              sx={{
                backgroundColor: "#ffffff",
                color: "#0f3eb5",
                "&:hover": { backgroundColor: "#f0f4ff" },
              }}
            >
              <PhotoCameraIcon />
            </IconButton>

            <IconButton
              onClick={handleClearImage}
              disabled={updating || profileImageFileId == null}
              aria-label={t("organizations.profile.removeAvatar")}
              sx={{
                backgroundColor: "#ffffff",
                color: "#0f3eb5",
                "&:hover": { backgroundColor: "#f0f4ff" },
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={handleFileChange}
        />
      </Box>
    </Box>
  );
}
