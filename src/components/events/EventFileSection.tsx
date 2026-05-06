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
type FileType = "PDF" | "PHOTO" | "AUDIO" | "VIDEO" | "OTHER" | "UNKNOWN";

interface FileItem { id: number; }

interface Props {
  organizationId: number;
  eventId: number;
  fileIds: number[];
  canManage: boolean;
  onUpdated: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

function getUploadErrorMessage(error: unknown, t: (k: string) => string): string {
  const msg = getErrorMessage(error).toLowerCase();
  if (msg.includes("too large") || msg.includes("413")) return t("repertoire.fileTooLarge");
  if (msg.includes("unsupported media type")) return t("repertoire.fileTypeNotSupportedByServer");
  return t("repertoire.fileUploadFailed");
}

function formatFileSize(size: number | undefined): string {
  if (typeof size !== "number" || Number.isNaN(size) || size < 0) return "-";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(size / 1024, 0.1).toFixed(1)} KB`;
}

function truncateFileName(name: string, max = 26): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot >= name.length - 1) return `${name.slice(0, max - 1)}…`;
  const ext = name.slice(dot);
  const base = name.slice(0, dot);
  const avail = max - ext.length - 1;
  if (avail < 4) return `${name.slice(0, max - 1)}…`;
  return `${base.slice(0, avail)}…${ext}`;
}

export default function EventFileSection({ organizationId, eventId, fileIds, canManage, onUpdated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const uploadEventFile = client.POST as unknown as (
    path: "/api/v1/organizations/{organizationId}/events/{eventId}/files",
    init: {
      params: { path: { organizationId: number; eventId: number } };
      body: FormData;
      headers: { Authorization: string };
      bodySerializer: (body: FormData) => FormData;
    }
  ) => Promise<{ error?: unknown }>;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<FileItem | null>(null);
  const [metadataById, setMetadataById] = useState<Record<number, FileMetadataDTO>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoMetadata, setInfoMetadata] = useState<FileMetadataDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const files = useMemo<FileItem[]>(() => fileIds.map((id) => ({ id })), [fileIds]);

  const resolveFileType = (meta?: FileMetadataDTO): FileType => {
    if (!meta?.fileType) return "UNKNOWN";
    return meta.fileType as FileType;
  };

  const getFileTypeLabel = (ft: FileType): string => {
    if (ft === "PDF") return t("repertoire.fileTypePdf");
    if (ft === "PHOTO") return t("repertoire.fileTypePhoto");
    if (ft === "AUDIO") return t("repertoire.fileTypeAudio");
    if (ft === "VIDEO") return t("repertoire.fileTypeVideo");
    if (ft === "OTHER") return t("repertoire.fileTypeOther");
    return t("repertoire.fileTypeUnknown");
  };

  useEffect(() => {
    if (!user || files.length === 0) return;
    const toLoad = files.map((f) => f.id).filter((id) => metadataById[id] == null);
    if (toLoad.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        toLoad.map(async (fileId) => {
          try {
            const { data, error } = await client.GET("/api/v1/files/{fileId}/meta", {
              params: { path: { fileId } },
              headers: { Authorization: `Bearer ${user.token}` },
            });
            if (error || !data) return null;
            return [fileId, data as FileMetadataDTO] as const;
          } catch { return null; }
        })
      );
      if (cancelled) return;
      const next: Record<number, FileMetadataDTO> = {};
      entries.forEach((e) => { if (e) next[e[0]] = e[1]; });
      if (Object.keys(next).length > 0) setMetadataById((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [files, metadataById, user]);

  const openMenu = (e: MouseEvent<HTMLElement>, target: FileItem) => { setMenuAnchor(e.currentTarget); setMenuTarget(target); };
  const closeMenu = () => { setMenuAnchor(null); setMenuTarget(null); };

  const handleShowInfo = async () => {
    if (!menuTarget || !user) return;
    const target = menuTarget;
    closeMenu();
    setInfoOpen(true);
    setInfoLoading(true);
    try {
      const { data, error } = await client.GET("/api/v1/files/{fileId}/meta", {
        params: { path: { fileId: target.id } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (error) throw error;
      const meta = (data as FileMetadataDTO) ?? null;
      setInfoMetadata(meta);
      if (meta?.id != null) setMetadataById((prev) => ({ ...prev, [meta.id!]: meta }));
    } catch (err) {
      setInfoMetadata(null);
      showAlert(getErrorMessage(err), "error");
    } finally {
      setInfoLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!menuTarget || !user) return;
    const target = menuTarget;
    closeMenu();
    try {
      const { data, error } = await client.GET("/api/v1/files/{fileId}", {
        params: { path: { fileId: target.id } },
        headers: { Authorization: `Bearer ${user.token}` },
        parseAs: "blob",
      });
      if (error || !data) throw error ?? new Error("Empty response");
      const blob = data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = metadataById[target.id]?.name ?? `file-${target.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    }
  };

  const handleRequestDelete = () => {
    if (!menuTarget) return;
    setDeleteTarget(menuTarget);
    setDeleteOpen(true);
    closeMenu();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    try {
      const { error } = await client.DELETE(
        "/api/v1/organizations/{organizationId}/events/{eventId}/files/{fileId}",
        {
          params: { path: { organizationId, eventId, fileId: deleteTarget.id } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) throw error;
      showAlert(String(t("repertoire.fileDeleted")), "success");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onUpdated();
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (fileIds.length >= 100) { showAlert(String(t("events.filesMaxReached")), "error"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { error } = await uploadEventFile(
        "/api/v1/organizations/{organizationId}/events/{eventId}/files",
        {
          params: { path: { organizationId, eventId } },
          body: formData,
          headers: { Authorization: `Bearer ${user.token}` },
          bodySerializer: (body: FormData) => body,
        }
      );
      if (error) throw error;
      showAlert(String(t("repertoire.fileUploaded")), "success");
      onUpdated();
    } catch (err) {
      showAlert(getUploadErrorMessage(err, (k) => String(t(k))), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void uploadFile(f);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => { if (!canManage) return; e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => { if (!canManage) return; setDragActive(false); };
  const handleDrop = (e: DragEvent<HTMLElement>) => {
    if (!canManage) return;
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    void uploadFile(f);
  };

  const isMaxReached = fileIds.length >= 100;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5", fontSize: "1.1rem" }}>
          {t("events.filesSection")}
        </Typography>
        {canManage && (
          <>
            <input ref={fileInputRef} type="file" hidden onChange={handleInputChange} disabled={uploading || isMaxReached} />
            <Button
              size="small"
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<UploadFileIcon fontSize="small" />}
              disabled={uploading || isMaxReached}
              sx={{
                borderRadius: "8px",
                borderColor: "#0f3eb5",
                textTransform: "none",
                fontFamily: "Century Gothic, sans-serif",
                color: "#0f3eb5",
                fontWeight: 700,
                "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" },
              }}
            >
              {uploading ? <CircularProgress size={16} /> : t("repertoire.uploadFile")}
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
          const meta = metadataById[file.id];
          const label = meta?.name?.trim() || `ID ${file.id}`;
          const short = truncateFileName(label);
          const ft = resolveFileType(meta);
          return (
            <Box
              key={file.id}
              sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, p: 1, borderRadius: "8px", border: "1px solid #dce6f9", bgcolor: "#ffffff" }}
            >
              <Tooltip title={label}>
                <IconButton
                  onClick={(e) => openMenu(e, file)}
                  sx={{
                    color: ft === "PDF" ? "#d32f2f" : ft === "PHOTO" ? "#2e7d32" : ft === "AUDIO" ? "#0f3eb5" : ft === "VIDEO" ? "#6a1b9a" : "#607d8b",
                  }}
                >
                  {ft === "PDF" && <PictureAsPdfIcon />}
                  {ft === "PHOTO" && <ImageOutlinedIcon />}
                  {ft === "AUDIO" && <MusicNoteIcon />}
                  {ft === "VIDEO" && <SmartDisplayOutlinedIcon />}
                  {(ft === "OTHER" || ft === "UNKNOWN") && <InsertDriveFileOutlinedIcon />}
                </IconButton>
              </Tooltip>
              <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.75rem", color: "#1a2f63", textAlign: "center", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>
                {short}
              </Typography>
            </Box>
          );
        })}

        {files.length === 0 && (
          <Typography sx={{ gridColumn: "1 / -1", color: "#7795de", fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem", textAlign: "center", py: 2 }}>
            {t("repertoire.noFiles")}
          </Typography>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
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

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: "16px" } } }}>
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}>
          {t("repertoire.fileInfo")}
        </DialogTitle>
        <DialogContent dividers>
          {infoLoading ? (
            <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}>...</Typography>
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
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setInfoOpen(false)}
            sx={{ borderRadius: "8px", borderColor: "#7795de", color: "#7795de", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
          >
            {t("common.cancel")}
          </Button>
        </Box>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => { if (!deleting) { setDeleteOpen(false); setDeleteTarget(null); } }}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "error.main" }}>
          {t("repertoire.deleteFile")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("repertoire.confirmDeleteFile")}
          </Typography>
        </DialogContent>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}
            disabled={deleting}
            sx={{ borderRadius: "8px", borderColor: "#7795de", color: "#7795de", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => void handleDelete()}
            disabled={deleting}
            sx={{ borderRadius: "8px", fontFamily: "Century Gothic, sans-serif", textTransform: "none" }}
          >
            {deleting ? <CircularProgress size={18} /> : t("repertoire.deleteFile")}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
