import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

export type InstrumentDTO = {
  id: number;
  name: string;
};

/**
 * Converts an English instrument name (from the API) to the camelCase i18n key
 * used in `organizations.instrumentNames.*`.
 * E.g. "Double bass" → "doubleBass", "French horn" → "frenchHorn"
 */
export function instrumentI18nKey(name: string): string {
  const words = name.trim().split(/[\s-]+/);
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

function instrumentSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, "-");
}

interface Props {
  open: boolean;
  onClose: () => void;
  myInstrumentIds: number[];
  onAdd: (instrument: InstrumentDTO) => void;
}

export default function InstrumentPicker({ open, onClose, myInstrumentIds, onAdd }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [allInstruments, setAllInstruments] = useState<InstrumentDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    client
      .GET("/api/v1/instruments", {
        headers: { Authorization: `Bearer ${user?.token}` },
        parseAs: "json",
      })
      .then(({ data }) => {
        if (data) setAllInstruments(data as unknown as InstrumentDTO[]);
      })
      .finally(() => setLoading(false));
  }, [open, user]);

  const localizedName = (name: string) => {
    const key = instrumentI18nKey(name);
    const translated = t(`organizations.instrumentNames.${key}`);
    // t() returns the key itself if not found — fall back to the API name
    return translated === `organizations.instrumentNames.${key}` ? name : translated;
  };

  const available = allInstruments.filter(
    (i) =>
      !myInstrumentIds.includes(i.id) &&
      localizedName(i.name).toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (instrument: InstrumentDTO) => {
    if (!user) return;
    setAdding(instrument.id);
    try {
      await client.POST("/api/v1/users/me/musical-roles/{instrumentId}", {
        params: { path: { instrumentId: instrument.id } },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      onAdd(instrument);
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        {t("profile.addInstrument")}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 12, top: 12, color: "#9aa5c0", minWidth: 44, minHeight: 44 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t("profile.searchInstrument")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2, mt: 0.5 }}
          slotProps={{ htmlInput: { style: { fontFamily: "Century Gothic, sans-serif" } } }}
        />

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress sx={{ color: "#0f3eb5" }} size={32} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {available.map((instrument) => {
              const slug = instrumentSlug(instrument.name);
              const isAdding = adding === instrument.id;
              const displayName = localizedName(instrument.name);
              return (
                <Box
                  key={instrument.id}
                  onClick={() => !isAdding && void handleAdd(instrument)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    p: 1,
                    borderRadius: "12px",
                    border: "1px solid #c5d3f5",
                    cursor: isAdding ? "default" : "pointer",
                    width: 80,
                    opacity: isAdding ? 0.6 : 1,
                    "&:hover": { backgroundColor: "#eef2ff", borderColor: "#0f3eb5" },
                    transition: "background-color 0.15s, border-color 0.15s",
                  }}
                >
                  <InstrumentIcon name={displayName} slug={slug} size={48} />
                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontSize: "0.7rem",
                      color: "#1a1a2e",
                      textAlign: "center",
                      wordBreak: "break-word",
                      lineHeight: 1.2,
                    }}
                  >
                    {displayName}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InstrumentIcon({
  name,
  slug,
  size = 48,
}: {
  name: string;
  slug: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={`/icons/instruments/${slug}.svg`}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ objectFit: "contain" }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "8px",
        backgroundColor: "#c5d3f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Century Gothic, sans-serif",
        fontWeight: 700,
        fontSize: size * 0.4,
        color: "#0f3eb5",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </Box>
  );
}
