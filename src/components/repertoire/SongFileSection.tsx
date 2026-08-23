import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SmartDisplayOutlinedIcon from "@mui/icons-material/SmartDisplayOutlined";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";

type FileMetadataDTO = components["schemas"]["FileMetadataDTO"];

type SongFileType = "PDF" | "PHOTO" | "AUDIO" | "VIDEO" | "OTHER" | "UNKNOWN";

interface SongFileItem {
  id: number;
}

interface Props {
  fileIds: number[];
  canManage: boolean;
  organizationId: number;
  songId: number;
  onUpdate: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function getUploadErrorMessage(error: unknown, t: (key: string) => string): string {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("too large") || message.includes("max 30mb") || message.includes("413")) {
    return t("repertoire.fileTooLarge");
  }
  if (message.includes("unsupported media type") || message.includes("content-type")) {
    return t("repertoire.fileTypeNotSupportedByServer");
  }
  if (message.includes("file is required") || message.includes("file name is required")) {
    return t("repertoire.fileUploadInvalidPayload");
  }

  return t("repertoire.fileUploadFailed");
}

function formatFileSize(size: number | undefined): string {
  if (typeof size !== "number" || Number.isNaN(size) || size < 0) {
    return "-";
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(size / 1024, 0.1).toFixed(1)} KB`;
}

function truncateFileName(name: string, maxLength = 26): string {
  if (name.length <= maxLength) {
    return name;
  }

  const dotIndex = name.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < name.length - 1;

  if (!hasExtension) {
    return `${name.slice(0, maxLength - 1)}…`;
  }

  const ext = name.slice(dotIndex);
  const base = name.slice(0, dotIndex);
  const availableBaseLength = maxLength - ext.length - 1;

  if (availableBaseLength < 4) {
    return `${name.slice(0, maxLength - 1)}…`;
  }

  return `${base.slice(0, availableBaseLength)}…${ext}`;
}

export default function SongFileSection({
  fileIds,
  canManage,
  organizationId,
  songId,
  onUpdate,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const uploadSongFile = client.POST as unknown as (
    path: "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}/files",
    init: {
      params: { path: { organizationId: number; songId: number } };
      body: FormData;
      headers: { Authorization: string };
      bodySerializer: (body: FormData) => FormData;
    }
  ) => Promise<{ error?: unknown }>;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<SongFileItem | null>(null);

  const [metadataById, setMetadataById] = useState<Record<number, FileMetadataDTO>>({});

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoMetadata, setInfoMetadata] = useState<FileMetadataDTO | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SongFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const files = useMemo<SongFileItem[]>(() => fileIds.map((id) => ({ id })), [fileIds]);

  const resolveFileType = (metadata?: FileMetadataDTO): SongFileType => {
    if (!metadata?.fileType) {return "UNKNOWN";}
    return metadata.fileType;
  };

  const getFileTypeLabel = (fileType: SongFileType): string => {
    if (fileType === "PDF") {return t("repertoire.fileTypePdf");}
    if (fileType === "PHOTO") {return t("repertoire.fileTypePhoto");}
    if (fileType === "AUDIO") {return t("repertoire.fileTypeAudio");}
    if (fileType === "VIDEO") {return t("repertoire.fileTypeVideo");}
    if (fileType === "OTHER") {return t("repertoire.fileTypeOther");}
    return t("repertoire.fileTypeUnknown");
  };

  useEffect(() => {
    if (!user || files.length === 0) {return;}

    const fileIdsToLoad = files
      .map((file) => file.id)
      .filter((id) => metadataById[id] == null);

    if (fileIdsToLoad.length === 0) {return;}

    let cancelled = false;

    void (async () => {
      const loadedEntries = await Promise.all(
        fileIdsToLoad.map(async (fileId) => {
          try {
            const { data, error } = await client.GET("/api/v1/files/{fileId}/meta", {
              params: { path: { fileId } },
              headers: { Authorization: `Bearer ${user.token}` },
            });
            if (error || !data) {
              return null;
            }
            return [fileId, data as FileMetadataDTO] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {return;}

      const next: Record<number, FileMetadataDTO> = {};
      loadedEntries.forEach((entry) => {
        if (!entry) {return;}
        const [fileId, metadata] = entry;
        next[fileId] = metadata;
      });

      if (Object.keys(next).length > 0) {
        setMetadataById((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, metadataById, user]);

  const openMenu = (event: MouseEvent<HTMLElement>, target: SongFileItem) => {
    setMenuAnchor(event.currentTarget);
    setMenuTarget(target);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
  };

  const handleShowInfo = async () => {
    if (!menuTarget || !user) {return;}
    const target = menuTarget;
    closeMenu();

    setInfoOpen(true);
    setInfoLoading(true);

    try {
      const { data, error } = await client.GET("/api/v1/files/{fileId}/meta", {
        params: { path: { fileId: target.id } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (error) {throw error;}

      const metadata = (data as FileMetadataDTO) ?? null;
      setInfoMetadata(metadata);
      if (metadata?.id != null) {
        setMetadataById((prev) => ({ ...prev, [metadata.id!]: metadata }));
      }
    } catch (error) {
      setInfoMetadata(null);
      showAlert(getErrorMessage(error), "error");
    } finally {
      setInfoLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!menuTarget || !user) {return;}
    const target = menuTarget;
    closeMenu();

    try {
      const { data, error } = await client.GET("/api/v1/files/{fileId}", {
        params: { path: { fileId: target.id } },
        headers: { Authorization: `Bearer ${user.token}` },
        parseAs: "blob",
      });

      if (error || !data) {
        throw error ?? new Error("Empty file response");
      }

      const blob = data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = metadataById[target.id]?.name ?? `file-${target.id}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAlert(getErrorMessage(error), "error");
    }
  };

  const handleRequestDelete = () => {
    if (!menuTarget) {return;}
    setDeleteTarget(menuTarget);
    setDeleteOpen(true);
    closeMenu();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) {return;}

    setDeleting(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/files/{fileId}",
        {
          params: { path: { fileId: deleteTarget.id } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}

      showAlert(String(t("repertoire.fileDeleted")), "success");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onUpdate();
    } catch (error) {
      showAlert(getErrorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user) {return;}

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { error } = await uploadSongFile(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}/files",
        {
          params: { path: { organizationId, songId } },
          body: formData,
          headers: { Authorization: `Bearer ${user.token}` },
          bodySerializer: (body: FormData) => body,
        }
      );

      if (error) {throw error;}

      showAlert(String(t("repertoire.fileUploaded")), "success");
      onUpdate();
    } catch (error) {
      showAlert(getUploadErrorMessage(error, (key) => String(t(key))), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) {return;}
    void uploadFile(nextFile);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!canManage) {return;}
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    if (!canManage) {return;}
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!canManage) {return;}
    event.preventDefault();
    setDragActive(false);

    const nextFile = event.dataTransfer.files?.[0];
    if (!nextFile) {return;}
    void uploadFile(nextFile);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            fontSize: "1.1rem",
          }}
        >
          {t("repertoire.files")}
        </Typography>

        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleInputChange}
              disabled={uploading}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<UploadFileIcon fontSize="small" />}
              disabled={uploading}
              sx={{
                borderRadius: "8px",
                borderColor: "#0f3eb5",
                textTransform: "none",
                fontFamily: "Century Gothic, sans-serif",
                color: "#0f3eb5",
                fontWeight: 700,
                "&:hover": {
                  borderColor: "#0f3eb5",
                  backgroundColor: "rgba(15,62,181,0.08)",
                },
              }}
            >
              {t("repertoire.uploadFile")}
            </Button>
          </>
        )}
      </Box>

      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: dragActive ? "2px dashed" : "1px solid",
          borderColor: dragActive ? "primary.main" : "#e7effb",
          borderRadius: "10px",
          p: 1.5,
          minHeight: 92,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 1,
          alignItems: "start",
          background: dragActive ? "rgba(15, 62, 181, 0.04)" : "#fafcff",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
        }}
      >
        {files.map((file) => {
          const metadata = metadataById[file.id];
          const fileLabel = metadata?.name?.trim() || `ID ${file.id}`;
          const shortFileLabel = truncateFileName(fileLabel);
          const fileType = resolveFileType(metadata);

          return (
            <Box
              key={file.id}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.75,
                p: 1,
                borderRadius: "8px",
                border: "1px solid #dce6f9",
                bgcolor: "#ffffff",
              }}
            >
              <Tooltip title={fileLabel}>
                <IconButton
                  onClick={(event) => openMenu(event, file)}
                  sx={{
                    color:
                      fileType === "PDF" ? "#d32f2f" :
                      fileType === "PHOTO" ? "#2e7d32" :
                      fileType === "AUDIO" ? "#0f3eb5" :
                      fileType === "VIDEO" ? "#6a1b9a" :
                      "#607d8b",
                  }}
                >
                  {fileType === "PDF" && <PictureAsPdfIcon />}
                  {fileType === "PHOTO" && <ImageOutlinedIcon />}
                  {fileType === "AUDIO" && <MusicNoteIcon />}
                  {fileType === "VIDEO" && <SmartDisplayOutlinedIcon />}
                  {(fileType === "OTHER" || fileType === "UNKNOWN") && <InsertDriveFileOutlinedIcon />}
                </IconButton>
              </Tooltip>

              <Typography
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  fontSize: "0.75rem",
                  color: "#1a2f63",
                  textAlign: "center",
                  width: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.2,
                }}
              >
                {shortFileLabel}
              </Typography>
            </Box>
          );
        })}

        {files.length === 0 && (
          <Typography
            sx={{
              gridColumn: "1 / -1",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.9rem",
              textAlign: "center",
              py: 2,
            }}
          >
            {t("repertoire.noFiles")}
          </Typography>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
      >
        <MenuItem onClick={() => void handleShowInfo()}>
          <InfoOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          {t("repertoire.fileInfo")}
        </MenuItem>
        <MenuItem onClick={() => void handleDownload()}>
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
          {t("repertoire.download")}
        </MenuItem>
        {canManage && (
          <MenuItem onClick={handleRequestDelete} sx={{ color: "error.main" }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t("repertoire.deleteFile")}
          </MenuItem>
        )}
      </Menu>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="xs" fullWidth fullScreen={fullScreen} slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px" } } }}>
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}>
          {t("repertoire.fileInfo")}
        </DialogTitle>
        <DialogContent dividers sx={{ overflowY: 'auto' }}>
          {infoLoading ? (
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}>
              ...
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 0.75 }}>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5" }}>
                {t("repertoire.fileType")}: {getFileTypeLabel(resolveFileType(infoMetadata ?? undefined))}
              </Typography>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5" }}>
                {t("repertoire.fileName")}: {infoMetadata?.name?.trim() || "-"}
              </Typography>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#0f3eb5" }}>
                {t("repertoire.fileSize")}: {formatFileSize(infoMetadata?.size)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <Box sx={{ display: "flex", justifyContent: { sm: "flex-end" }, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setInfoOpen(false)}
            sx={{
              borderRadius: "8px",
              borderColor: "#7795de",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {t("common.cancel")}
          </Button>
        </Box>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "error.main" }}>
          {t("repertoire.deleteFile")}
        </DialogTitle>
        <DialogContent dividers sx={{ overflowY: 'auto' }}>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("repertoire.confirmDeleteFile")}
          </Typography>
        </DialogContent>
        <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setDeleteOpen(false);
              setDeleteTarget(null);
            }}
            disabled={deleting}
            sx={{
              borderRadius: "8px",
              borderColor: "#7795de",
              color: "#7795de",
              fontFamily: "Century Gothic, sans-serif",
              textTransform: "none",
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => void handleDelete()}
            disabled={deleting}
            sx={{ borderRadius: "8px", textTransform: "none", fontFamily: "Century Gothic, sans-serif" }}
          >
            {deleting ? <CircularProgress size={18} /> : t("repertoire.deleteFile")}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
