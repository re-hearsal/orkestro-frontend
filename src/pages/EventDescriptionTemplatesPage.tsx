import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import EventDescriptionTemplateDialog from "../components/events/EventDescriptionTemplateDialog";
import { useMobileAction } from "../hooks/useMobileAction";

type EventDescriptionTemplateDTO = components["schemas"]["EventDescriptionTemplateDTO"];
type EventType = "REHEARSAL" | "CONCERT" | "OTHER";

const EVENT_TYPES: EventType[] = ["REHEARSAL", "CONCERT", "OTHER"];

function formatDate(value?: string): string {
  if (!value) {return "-";}
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {return "-";}
  const datePart = parsed.toLocaleDateString("ru-RU");
  const timePart = parsed.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

export default function EventDescriptionTemplatesPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrgId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const organizationId = useMemo(() => Number(rawOrgId), [rawOrgId]);
  const isValid = Number.isFinite(organizationId) && organizationId > 0;

  const { permissions } = useOrgMemberContext(isValid ? organizationId : 0);
  const canManage = permissions.has("EVENT_MANAGE_DESCRIPTIONS");

  const [templates, setTemplates] = useState<Record<EventType, EventDescriptionTemplateDTO | undefined>>({
    REHEARSAL: undefined,
    CONCERT: undefined,
    OTHER: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventDescriptionTemplateDTO | undefined>(undefined);
  const [deletingType, setDeletingType] = useState<EventType | null>(null);

  const activeEventType = EVENT_TYPES[activeTab];

  const loadTemplates = useCallback(async () => {
    if (!user || !isValid) {return;}
    setLoading(true);
    try {
      const { data, error } = await client.GET(
        "/api/v1/organizations/{organizationId}/event-templates",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      const list = (data as unknown as EventDescriptionTemplateDTO[]) ?? [];
      const byType: Record<EventType, EventDescriptionTemplateDTO | undefined> = {
        REHEARSAL: undefined,
        CONCERT: undefined,
        OTHER: undefined,
      };
      for (const tpl of list) {
        if (tpl.eventType) {byType[tpl.eventType] = tpl;}
      }
      setTemplates(byType);
    } catch {
      // silently fail — templates remain empty
    } finally {
      setLoading(false);
    }
  }, [user, isValid, organizationId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSaved = useCallback((saved: EventDescriptionTemplateDTO) => {
    if (!saved.eventType) {return;}
    setTemplates((prev) => ({ ...prev, [saved.eventType!]: saved }));
  }, []);

  const handleDelete = useCallback(async (tpl: EventDescriptionTemplateDTO) => {
    if (!user || tpl.id == null || !tpl.eventType) {return;}
    setDeletingType(tpl.eventType as EventType);
    try {
      const deleteFn = client.DELETE as unknown as (
        path: "/api/v1/organizations/{organizationId}/event-templates/{templateId}",
        init: {
          params: { path: { organizationId: number; templateId: number } };
          headers: { Authorization: string };
        }
      ) => Promise<{ error?: unknown }>;

      const { error } = await deleteFn(
        "/api/v1/organizations/{organizationId}/event-templates/{templateId}",
        {
          params: { path: { organizationId, templateId: tpl.id } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (error) {throw error;}
      setTemplates((prev) => ({ ...prev, [tpl.eventType!]: undefined }));
      showAlert(t("events.templates.deleteSuccess"), "success");
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
      showAlert(msg, "error");
    } finally {
      setDeletingType(null);
    }
  }, [user, organizationId, showAlert, t]);

  const currentTemplate = templates[activeEventType];

  useMobileAction(
    canManage && !loading && !currentTemplate
      ? { icon: <AddIcon />, onClick: () => { setEditingTemplate(undefined); setDialogOpen(true); }, ariaLabel: String(t("events.templates.create")) }
      : null
  );

  if (!canManage) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="text.secondary">{t("common.back")}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button
          variant="text"
          onClick={() => navigate(`/organizations/${organizationId}`)}
          sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", color: "text.secondary" }}
        >
          ← {t("common.back")}
        </Button>
      </Box>

      <Typography variant="h4" sx={{ fontWeight: 700, color: "#0f3eb5", mb: 3, fontFamily: "Century Gothic, sans-serif" }}>
        {t("events.templates.pageTitle")}
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, v: number) => setActiveTab(v)}
        indicatorColor="primary"
        textColor="primary"
        sx={{ mb: 3, "& .MuiTab-root": { fontFamily: "Century Gothic, sans-serif", textTransform: "none" } }}
      >
        <Tab label={t("events.templates.tab.rehearsal")} />
        <Tab label={t("events.templates.tab.concert")} />
        <Tab label={t("events.templates.tab.other")} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : currentTemplate ? (
        <Box
          sx={{
            border: "1px solid #7795de",
            borderRadius: "12px",
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "Century Gothic, sans-serif" }}>
            {currentTemplate.title}
          </Typography>
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", whiteSpace: "pre-wrap" }}>
            {currentTemplate.content}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("events.templates.createdAt")}: {formatDate(currentTemplate.createdAt)}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setEditingTemplate(currentTemplate);
                setDialogOpen(true);
              }}
              sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif", borderColor: "#0f3eb5", color: "#0f3eb5" }}
            >
              {t("events.templates.edit")}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={deletingType === activeEventType}
              onClick={() => { void handleDelete(currentTemplate); }}
              sx={{ textTransform: "none", fontFamily: "Century Gothic, sans-serif" }}
            >
              {deletingType === activeEventType
                ? <CircularProgress size={18} />
                : t("events.templates.delete")}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <Typography color="text.secondary" sx={{ fontFamily: "Century Gothic, sans-serif" }}>
            {t("events.templates.empty")}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setEditingTemplate(undefined);
              setDialogOpen(true);
            }}
            sx={{
              display: { xs: "none", md: "flex" },
              textTransform: "none",
              fontFamily: "Century Gothic, sans-serif",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
            }}
          >
            {t("events.templates.create")}
          </Button>
        </Box>
      )}

      <EventDescriptionTemplateDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingTemplate(undefined);
        }}
        onSaved={(saved) => {
          handleSaved(saved);
          setDialogOpen(false);
          setEditingTemplate(undefined);
        }}
        organizationId={organizationId}
        eventType={activeEventType}
        template={editingTemplate}
      />
    </Box>
  );
}
