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

type CurrentUserResponseDTO = components["schemas"]["CurrentUserResponseDTO"];

type PatchProfileImageRequest = {
  headers: { Authorization: string };
  body: FormData;
  bodySerializer: (body: FormData) => FormData;
};

type PatchProfileImageResponse = {
  error?: components["schemas"]["ApiErrorResponse"];
};

interface UserAvatarProps {
  profileImageFileId?: number;
  userName: string;
  onAvatarUpdated: (fileId: number | null) => void;
}

function getApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("message" in error && typeof error.message === "string") return error.message;
  if ("details" in error && Array.isArray(error.details)) {
    const details = (error.details as unknown[]).filter((d): d is string => typeof d === "string");
    if (details.length > 0) return details.join("\n");
  }
  return null;
}

export default function UserAvatar({ profileImageFileId, userName, onAvatarUpdated }: UserAvatarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fallbackAvatarUrl = useMemo(
    () => getOrgAvatarSvgDataUri(userName ?? ""),
    [userName]
  );

  const patchProfileImage = client.PATCH as unknown as (
    path: "/api/v1/users/me/profile-image",
    init: PatchProfileImageRequest
  ) => Promise<PatchProfileImageResponse>;

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current && isBlobUrl(objectUrlRef.current)) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = null;
  }, []);

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

        if (cancelled) return;

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
        if (!cancelled) setLoadingImage(false);
      }
    };

    void loadImage();
    return () => { cancelled = true; };
  }, [profileImageFileId, revokeObjectUrl, user]);

  useEffect(() => {
    return () => { revokeObjectUrl(); };
  }, [revokeObjectUrl]);

  const fetchUpdatedFileId = async (): Promise<number | null> => {
    if (!user) return null;
    const { data } = await client.GET("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const profile = data as CurrentUserResponseDTO | undefined;
    return profile?.profileImageFileId ?? null;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;

    setUpdating(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const { error } = await patchProfileImage("/api/v1/users/me/profile-image", {
        headers: { Authorization: `Bearer ${user.token}` },
        body,
        bodySerializer: (b) => b,
      });

      if (error) {
        throw new Error(getApiErrorMessage(error) ?? t("profile.avatar.uploadError"));
      }

      const newFileId = await fetchUpdatedFileId();
      onAvatarUpdated(newFileId);
    } catch (err) {
      showAlert(getApiErrorMessage(err) ?? t("profile.avatar.uploadError"), "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      const { error } = await client.DELETE("/api/v1/users/me/profile-image", {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (error) {
        throw new Error(getApiErrorMessage(error) ?? t("profile.avatar.removeError"));
      }

      onAvatarUpdated(null);
    } catch (err) {
      showAlert(getApiErrorMessage(err) ?? t("profile.avatar.removeError"), "error");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 160,
        height: 160,
        borderRadius: "50%",
        border: "2px solid #7795de",
        overflow: "hidden",
        background: "linear-gradient(135deg, #e8f0ff 0%, #ffffff 100%)",
        cursor: "pointer",
        "&:hover .user-avatar-overlay": {
          opacity: 1,
          pointerEvents: "auto",
        },
      }}
    >
      <Box
        component="img"
        src={imageUrl ?? fallbackAvatarUrl}
        alt={userName}
        onError={() => setImageUrl(null)}
        sx={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
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
          <CircularProgress sx={{ color: "#0f3eb5" }} size={32} />
        </Box>
      )}

      <Box
        className="user-avatar-overlay"
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          backgroundColor: "rgba(15,62,181,0.5)",
          opacity: updating ? 1 : 0,
          pointerEvents: updating ? "auto" : "none",
          transition: "opacity 0.2s",
          zIndex: 3,
        }}
      >
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          disabled={updating}
          aria-label={t("profile.avatar.upload")}
          size="small"
          sx={{ backgroundColor: "#ffffff", color: "#0f3eb5", "&:hover": { backgroundColor: "#f0f4ff" } }}
        >
          <PhotoCameraIcon fontSize="small" />
        </IconButton>

        <IconButton
          onClick={handleRemoveImage}
          disabled={updating || profileImageFileId == null}
          aria-label={t("profile.avatar.remove")}
          size="small"
          sx={{ backgroundColor: "#ffffff", color: "#0f3eb5", "&:hover": { backgroundColor: "#f0f4ff" } }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/*"
        onChange={handleFileChange}
      />
    </Box>
  );
}
