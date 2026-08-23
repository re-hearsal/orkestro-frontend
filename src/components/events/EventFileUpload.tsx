import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SmartDisplayOutlinedIcon from "@mui/icons-material/SmartDisplayOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useTranslation } from "react-i18next";

function getFileTypeByMime(file: File): "PDF" | "PHOTO" | "AUDIO" | "VIDEO" | "OTHER" {
  if (file.type === "application/pdf") {return "PDF";}
  if (file.type.startsWith("image/")) {return "PHOTO";}
  if (file.type.startsWith("audio/")) {return "AUDIO";}
  if (file.type.startsWith("video/")) {return "VIDEO";}
  return "OTHER";
}

function truncateName(name: string, max = 20): string {
  if (name.length <= max) {return name;}
  const dot = name.lastIndexOf(".");
  if (dot > 0 && dot < name.length - 1) {
    const ext = name.slice(dot);
    const base = name.slice(0, dot);
    const avail = max - ext.length - 1;
    if (avail >= 4) {return `${base.slice(0, avail)}…${ext}`;}
  }
  return `${name.slice(0, max - 1)}…`;
}

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

export default function EventFileUpload({ files, onChange, maxFiles = 50 }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) {return;}
    const combined = [...files, ...Array.from(incoming)];
    onChange(combined.slice(0, maxFiles));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <input ref={inputRef} type="file" multiple hidden onChange={handleInputChange} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<UploadFileIcon fontSize="small" />}
          onClick={() => inputRef.current?.click()}
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            borderColor: "#0f3eb5",
            color: "#0f3eb5",
            "&:hover": { borderColor: "#0c32a0", color: "#0c32a0" },
          }}
        >
          {t("organizations.events.create.addFiles")}
        </Button>
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.82rem", color: "#7795de" }}>
          {files.length} / {maxFiles}
        </Typography>
      </Box>

      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: dragActive ? "2px dashed #0f3eb5" : "2px dashed #7795de",
          borderRadius: "12px",
          p: 3,
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          background: dragActive ? "rgba(15,62,181,0.04)" : "#fafcff",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        {files.length === 0 ? (
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", fontSize: "0.9rem" }}>
            {t("organizations.events.create.dragDrop")}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
              gap: 1,
              width: "100%",
            }}
          >
            {files.map((file, index) => {
              const type = getFileTypeByMime(file);
              return (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    p: 1,
                    borderRadius: "8px",
                    border: "1px solid #dce6f9",
                    bgcolor: "#ffffff",
                    position: "relative",
                    "&:hover .delete-btn": { opacity: 1 },
                  }}
                >
                  <Box sx={{ position: "relative" }}>
                    {type === "PDF" && <PictureAsPdfIcon sx={{ color: "#d32f2f" }} />}
                    {type === "PHOTO" && <ImageOutlinedIcon sx={{ color: "#2e7d32" }} />}
                    {type === "AUDIO" && <MusicNoteIcon sx={{ color: "#0f3eb5" }} />}
                    {type === "VIDEO" && <SmartDisplayOutlinedIcon sx={{ color: "#6a1b9a" }} />}
                    {type === "OTHER" && <InsertDriveFileOutlinedIcon sx={{ color: "#607d8b" }} />}
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={() => removeFile(index)}
                      sx={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        opacity: 0,
                        transition: "opacity 0.15s",
                        bgcolor: "#fff",
                        border: "1px solid #dce6f9",
                        p: 0.25,
                        "&:hover": { bgcolor: "#ffe8e8" },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 14, color: "#d32f2f" }} />
                    </IconButton>
                  </Box>
                  <Tooltip title={file.name}>
                    <Typography
                      sx={{
                        fontFamily: "Century Gothic, sans-serif",
                        fontSize: "0.7rem",
                        color: "#1a2f63",
                        textAlign: "center",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {truncateName(file.name)}
                    </Typography>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
