import { Fragment, useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useAuth } from "../../hooks/useAuth";
import { instrumentI18nKey, sortByLocalizedLabel } from "../../utils/instrumentI18n";

type InstrumentDTO = { id?: number; name?: string };
type SongInstrumentDTO = components["schemas"]["SongInstrumentDTO"];

interface Props {
  instrumentation: SongInstrumentDTO[];
  canEdit: boolean;
  organizationId: number;
  songId: number;
  onUpdate: (updated: SongInstrumentDTO[]) => void;
}

interface EditItem {
  instrumentId: number;
  count: number;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export default function InstrumentationSection({
  instrumentation,
  canEdit,
  organizationId,
  songId,
  onUpdate,
}: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const [instruments, setInstruments] = useState<InstrumentDTO[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editList, setEditList] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [autocompleteKey, setAutocompleteKey] = useState(0);

  useEffect(() => {
    if (!user) {return;}
    void (async () => {
      const { data } = await client.GET("/api/v1/instruments", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setInstruments((data as unknown as InstrumentDTO[]) ?? []);
    })();
  }, [user]);

  const localizedName = (apiName: string): string => {
    const key = instrumentI18nKey(apiName);
    const translated = t(`organizations.instrumentNames.${key}`);
    return translated === `organizations.instrumentNames.${key}` ? apiName : translated;
  };

  const resolveInstrumentName = (instrumentId: number): string => {
    const found = instruments.find((i) => i.id === instrumentId);
    return found ? localizedName(found.name ?? "") : String(instrumentId);
  };

  const handleStartEdit = () => {
    setEditList(instrumentation.map((i) => ({ instrumentId: i.instrumentId, count: i.count })));
    setEditMode(true);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {return;}
    const items = Array.from(editList);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    setEditList(items);
  };

  const handleCountChange = (instrumentId: number, value: string) => {
    const count = Math.max(1, parseInt(value, 10) || 1);
    setEditList((prev) =>
      prev.map((i) => (i.instrumentId === instrumentId ? { ...i, count } : i))
    );
  };

  const handleRemove = (instrumentId: number) => {
    setEditList((prev) => prev.filter((i) => i.instrumentId !== instrumentId));
  };

  const handleAddInstrument = (instrument: InstrumentDTO | null) => {
    if (!instrument?.id) {return;}
    if (editList.some((i) => i.instrumentId === instrument.id)) {
      setAutocompleteKey((k) => k + 1);
      return;
    }
    setEditList((prev) => [...prev, { instrumentId: instrument.id!, count: 1 }]);
    setAutocompleteKey((k) => k + 1);
  };

  const handleSave = async () => {
    if (!user) {return;}
    setSaving(true);
    try {
      const { data, error } = await client.PUT(
        "/api/v1/organizations/{organizationId}/repertoire/songs/{songId}",
        {
          params: { path: { organizationId, songId } },
          body: { instrumentation: editList },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      const updated = (data as unknown as { instrumentation?: SongInstrumentDTO[] }).instrumentation ?? editList;
      showAlert(String(t("repertoire.instrumentationSaved")), "success");
      setEditMode(false);
      onUpdate(updated);
    } catch (err) {
      showAlert(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const availableInstruments = sortByLocalizedLabel(
    instruments.filter((inst) => !editList.some((i) => i.instrumentId === inst.id)),
    (inst) => localizedName(inst.name ?? ""),
    i18n.language
  );

  const displayList = editMode ? editList : instrumentation;

  return (
    <Box>
      {/* Section header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
            fontSize: "1.1rem",
          }}
        >
          {t("repertoire.instrumentation")}
        </Typography>

        {canEdit && (
          editMode ? (
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleSave()}
              disabled={saving}
              sx={{
                borderRadius: "8px",
                textTransform: "none",
                fontFamily: "Century Gothic, sans-serif",
                background: "#0f3eb5",
                fontWeight: 700,
                "&:hover": { background: "#0c34a0" },
              }}
            >
              {t("repertoire.saveInstrumentation")}
            </Button>
          ) : (
            <Button
              size="small"
              onClick={handleStartEdit}
              sx={{
                borderRadius: "8px",
                border: "1px solid #0f3eb5",
                textTransform: "none",
                fontFamily: "Century Gothic, sans-serif",
                color: "#0f3eb5",
                fontWeight: 700,
                "&:hover": { backgroundColor: "rgba(15,62,181,0.08)", border: "1px solid #0f3eb5" },
              }}
            >
              {t("repertoire.editInstrumentation")}
            </Button>
          )
        )}
      </Box>

      {/* List area */}
      {editMode ? (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="instrumentation-edit">
              {(provided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
                >
                    {editList.map((item, index) => (
                      <Draggable
                        key={item.instrumentId}
                        draggableId={String(item.instrumentId)}
                        index={index}
                      >
                        {(provided) => (
                          <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 1,
                              p: 1,
                              border: "1px solid #e7effb",
                              borderRadius: "8px",
                              background: "#fafcff",
                            }}
                          >
                            <Box {...provided.dragHandleProps} sx={{ display: "flex", cursor: "grab", minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                              <DragIndicatorIcon sx={{ color: "text.secondary" }} />
                            </Box>

                            <Typography sx={{ flex: 1, minWidth: 80, fontFamily: "Century Gothic, sans-serif", color: "#1a2f63" }}>
                              {resolveInstrumentName(item.instrumentId)}
                            </Typography>

                            <TextField
                              type="number"
                              size="small"
                              value={item.count}
                              onChange={(e) => handleCountChange(item.instrumentId, e.target.value)}
                              sx={{ width: 72 }}
                              slotProps={{
                                input: {
                                  inputProps: { min: 1 },
                                  sx: { fontFamily: "Century Gothic, sans-serif" },
                                },
                              }}
                            />

                            <IconButton
                              size="small"
                              onClick={() => handleRemove(item.instrumentId)}
                              color="error"
                              sx={{ minWidth: 44, minHeight: 44 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>

            {/* Add instrument autocomplete */}
            <Autocomplete
              key={autocompleteKey}
              options={availableInstruments}
              getOptionLabel={(opt) => localizedName(opt.name ?? "")}
              onChange={(_, value) => handleAddInstrument(value)}
              blurOnSelect
              sx={{ mt: 1 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("repertoire.addInstrument")}
                  size="small"
                  sx={{
                    "& .MuiInputBase-root": {
                      fontFamily: "Century Gothic, sans-serif",
                    },
                  }}
                />
              )}
            />
          </>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              columnGap: 1.5,
              rowGap: 0.5,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            {displayList.map((item) => (
              <Fragment key={item.instrumentId}>
                <Typography sx={{ fontFamily: "Century Gothic, sans-serif", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {resolveInstrumentName(item.instrumentId)}
                </Typography>

                <Typography
                  sx={{
                    color: "#7795de",
                    fontFamily: "Century Gothic, sans-serif",
                    fontSize: "1rem",
                    fontWeight: 700,
                    minWidth: 40,
                    textAlign: "right",
                  }}
                >
                  {item.count}
                </Typography>
              </Fragment>
            ))}

            {displayList.length === 0 && (
              <Typography
                sx={{
                  gridColumn: "1 / -1",
                  color: "text.secondary",
                  fontFamily: "Century Gothic, sans-serif",
                  fontSize: "0.9rem",
                }}
              >
                —
              </Typography>
            )}
          </Box>
        )}
    </Box>
  );
}
