import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { components } from "../../api/schema";

type SectionDTO = components["schemas"]["SectionDTO"];

interface CreateSectionDialogProps {
  open: boolean;
  onClose: () => void;
  createFn: (data: { name: string; description?: string }) => Promise<SectionDTO>;
  onCreated: (section: SectionDTO) => void;
}

export default function CreateSectionDialog({
  open,
  onClose,
  createFn,
  onCreated,
}: CreateSectionDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  const handleClose = () => {
    if (loading) return;
    setName("");
    setDescription("");
    setNameError("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t("sections.nameRequired"));
      return;
    }
    setLoading(true);
    try {
      const section = await createFn({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setNameError("");
      onCreated(section);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          color: "#0f3eb5",
          fontWeight: 700,
        }}
      >
        {t("sections.createSection")}
      </DialogTitle>

      <DialogContent dividers>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
          <TextField
            label={t("sections.sectionName")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            error={Boolean(nameError)}
            helperText={nameError}
            fullWidth
            size="small"
            required
            disabled={loading}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
          <TextField
            label={t("sections.sectionDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={3}
            disabled={loading}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
        </Box>
      </DialogContent>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          disabled={loading}
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
          onClick={(e) => { void handleSubmit(e as unknown as React.FormEvent); }}
          variant="contained"
          disabled={loading || !name.trim()}
          sx={{
            borderRadius: "8px",
            backgroundColor: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { backgroundColor: "#0d35a0" },
          }}
        >
          {t("sections.createSection")}
        </Button>
      </Box>
    </Dialog>
  );
}
