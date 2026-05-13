import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";
import { useAppAlert } from "../../hooks/useAppAlert";
import { useOrgMemberContext } from "../../hooks/useOrgMemberContext";

type SectionDTO = components["schemas"]["SectionDTO"];

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
}

interface WritableSection {
  id: number;
  name: string;
}

type Mode = "org" | "sections";

export default function WriteInfoMessageDialog({ open, onClose, organizationId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const { permissions: orgPermissions } = useOrgMemberContext(organizationId);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const canWriteOrg = orgPermissions.has("ORG_WRITE_INFO");

  const [writableSections, setWritableSections] = useState<WritableSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  const [mode, setMode] = useState<Mode>("org");
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
  const [sectionMenuAnchor, setSectionMenuAnchor] = useState<HTMLElement | null>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    setText("");
    setSelectedSectionIds([]);
    setSectionMenuAnchor(null);
    setWritableSections([]);

    const loadWritableSections = async () => {
      setLoadingSections(true);
      try {
        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/sections",
          {
            params: { path: { organizationId } },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        if (error || !data) return;

        const sections = (data as SectionDTO[]) ?? [];

        const results = await Promise.allSettled(
          sections.map(async (s) => {
            if (s.id == null) return null;
            const { data: ctx, error: ctxErr } = await client.GET(
              "/api/v1/sections/{sectionId}/members/me",
              {
                params: { path: { sectionId: s.id } },
                headers: { Authorization: `Bearer ${user.token}` },
              }
            );
            if (ctxErr || !ctx) return null;
            const permissions = (ctx as { permissions?: string[] }).permissions ?? [];
            if (permissions.includes("SECTION_WRITE_INFO")) {
              return { id: s.id, name: s.name ?? "" } as WritableSection;
            }
            return null;
          })
        );

        const writable = results
          .filter(
            (r): r is PromiseFulfilledResult<WritableSection> =>
              r.status === "fulfilled" && r.value != null
          )
          .map((r) => r.value);

        setWritableSections(writable);

        setMode(canWriteOrg ? "org" : "sections");
      } finally {
        setLoadingSections(false);
      }
    };

    void loadWritableSections();
  }, [open, organizationId, user, canWriteOrg]);

  const availableToAdd = writableSections.filter(
    (s) => !selectedSectionIds.includes(s.id)
  );

  const addSection = (id: number) => {
    setSelectedSectionIds((prev) => [...prev, id]);
    setSectionMenuAnchor(null);
  };

  const removeSection = (id: number) => {
    setSelectedSectionIds((prev) => prev.filter((s) => s !== id));
  };

  const hasTarget =
    mode === "org" ? true : selectedSectionIds.length > 0;

  const canSend = hasTarget && text.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!user || !canSend) return;
    setSending(true);

    const requests: Promise<unknown>[] = [];

    if (mode === "org") {
      requests.push(
        client.POST("/api/v1/organizations/{organizationId}/info-messages", {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
          body: { text },
        })
      );
    } else {
      for (const sectionId of selectedSectionIds) {
        requests.push(
          client.POST("/api/v1/sections/{sectionId}/info-messages", {
            params: { path: { sectionId } },
            headers: { Authorization: `Bearer ${user.token}` },
            body: { text },
          })
        );
      }
    }

    try {
      await Promise.all(requests);
      showAlert(t("infoMessage.sent"), "success");
      onClose();
    } catch {
      showAlert(t("infoMessage.error"), "error");
    } finally {
      setSending(false);
    }
  };

  const charCount = text.length;

  const showToggle = canWriteOrg && writableSections.length > 0;

  return (
    <Dialog
      open={open}
      onClose={sending ? undefined : onClose}
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
        {t("infoMessage.newMessage")}
        <IconButton
          onClick={onClose}
          disabled={sending}
          sx={{ position: "absolute", right: 12, top: 12, color: "#7795de", minWidth: 44, minHeight: 44 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Box>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "#7795de",
                mb: 1,
              }}
            >
              {t("infoMessage.selectTargets")}
            </Typography>

            {loadingSections ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} sx={{ color: "#7795de" }} />
              </Box>
            ) : (
              <Box>
                {showToggle && (
                  <ToggleButtonGroup
                    value={mode}
                    exclusive
                    size="small"
                    onChange={(_, val: Mode) => {
                      if (val) {
                        setMode(val);
                        setSelectedSectionIds([]);
                      }
                    }}
                    sx={{ mb: 1.5 }}
                  >
                    <ToggleButton
                      value="org"
                      sx={{
                        fontFamily: "Century Gothic, sans-serif",
                        fontSize: "0.82rem",
                        textTransform: "none",
                      }}
                    >
                      {t("infoMessage.orgTarget")}
                    </ToggleButton>
                    <ToggleButton
                      value="sections"
                      sx={{
                        fontFamily: "Century Gothic, sans-serif",
                        fontSize: "0.82rem",
                        textTransform: "none",
                      }}
                    >
                      {t("infoMessage.sectionsTarget")}
                    </ToggleButton>
                  </ToggleButtonGroup>
                )}

                {!showToggle && canWriteOrg && (
                  <Typography
                    sx={{
                      fontFamily: "Century Gothic, sans-serif",
                      fontSize: "0.9rem",
                      color: "#0f3eb5",
                    }}
                  >
                    {t("infoMessage.orgTarget")}
                  </Typography>
                )}

                {(mode === "sections" || (!canWriteOrg && writableSections.length > 0)) && (
                  <Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.75 }}>
                      {selectedSectionIds.map((sectionId) => {
                        const section = writableSections.find((s) => s.id === sectionId);
                        return (
                          <Chip
                            key={sectionId}
                            label={section?.name ?? `#${sectionId}`}
                            size="small"
                            onDelete={() => removeSection(sectionId)}
                            disabled={sending}
                            sx={{
                              fontFamily: "Century Gothic, sans-serif",
                              backgroundColor: "#e8f0ff",
                              color: "#0f3eb5",
                              border: "1px solid #7795de",
                            }}
                          />
                        );
                      })}
                    </Box>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      variant="outlined"
                      disabled={availableToAdd.length === 0 || sending}
                      onClick={(e) => setSectionMenuAnchor(e.currentTarget)}
                      sx={{
                        fontFamily: "Century Gothic, sans-serif",
                        fontSize: "0.78rem",
                        textTransform: "none",
                        borderColor: "#7795de",
                        color: "#0f3eb5",
                      }}
                    >
                      {t("infoMessage.addSection")}
                    </Button>
                    <Menu
                      anchorEl={sectionMenuAnchor}
                      open={Boolean(sectionMenuAnchor)}
                      onClose={() => setSectionMenuAnchor(null)}
                    >
                      {availableToAdd.map((section) => (
                        <MenuItem
                          key={section.id}
                          onClick={() => addSection(section.id)}
                          sx={{
                            fontFamily: "Century Gothic, sans-serif",
                            fontSize: "0.88rem",
                          }}
                        >
                          {section.name}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <Box>
            <TextField
              label={t("infoMessage.textLabel")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              size="small"
              disabled={sending}
              slotProps={{ htmlInput: { maxLength: 5000 } }}
            />
            <Box
              sx={{
                textAlign: "right",
                mt: 0.5,
                fontSize: "0.8rem",
                fontFamily: "Century Gothic, sans-serif",
                color: charCount >= 4900 ? "error.main" : "#7795de",
              }}
            >
              {charCount} / 5000
            </Box>
          </Box>
        </Stack>
      </DialogContent>

      <Box sx={{ display: "flex", flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: "flex-end" }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, px: 3, py: 2 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={sending}
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
          variant="contained"
          onClick={() => void handleSend()}
          disabled={!canSend}
          sx={{
            borderRadius: "8px",
            backgroundColor: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            "&:hover": { backgroundColor: "#0c32a0" },
          }}
        >
          {sending ? (
            <CircularProgress size={18} sx={{ color: "#fff" }} />
          ) : (
            t("common.send")
          )}
        </Button>
      </Box>
    </Dialog>
  );
}
