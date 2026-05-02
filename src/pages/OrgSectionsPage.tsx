import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../hooks/useAuth";
import { useAppAlert } from "../hooks/useAppAlert";
import SectionCard from "../components/sections/SectionCard";
import CreateSectionDialog from "../components/sections/CreateSectionDialog";

type SectionDTO = components["schemas"]["SectionDTO"];

export default function OrgSectionsPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrganizationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const organizationId = useMemo(() => Number(rawOrganizationId), [rawOrganizationId]);
  const isValid = Number.isFinite(organizationId) && organizationId > 0;

  const [sections, setSections] = useState<SectionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!user || !isValid) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await client.GET("/api/v1/organizations/{organizationId}/sections", {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!cancelled) {
          setSections((data as SectionDTO[] | undefined) ?? []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) { setLoaded(true); showAlert(String(t("organizations.profile.loadError")), "error"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isValid, organizationId, user, showAlert, t]);

  const handleCreateSection = useCallback(
    async (data: { name: string; description?: string }) => {
      const { data: newSection, error } = await client.POST(
        "/api/v1/organizations/{organizationId}/sections",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user!.token}` },
          body: data,
        }
      );
      if (error) throw error;
      return newSection as SectionDTO;
    },
    [organizationId, user]
  );

  if (!isValid) return <Navigate to="/organizations" replace />;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}>
          {t("sections.sections")}
        </Typography>
        {loaded && (
          <Button
            variant="outlined"
            onClick={() => setCreateDialogOpen(true)}
            sx={{ borderRadius: "8px", borderColor: "#0f3eb5", color: "#0f3eb5", fontFamily: "Century Gothic, sans-serif", fontWeight: 700, textTransform: "none", "&:hover": { borderColor: "#0f3eb5", backgroundColor: "rgba(15,62,181,0.08)" } }}
          >
            {t("sections.createSection")}
          </Button>
        )}
      </Box>

      {sections.length === 0 ? (
        <Typography sx={{ color: "#7795de", fontFamily: "Century Gothic, sans-serif" }}>
          {t("sections.noSections")}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              showAvatar={false}
              onClick={() => navigate(`/organizations/${organizationId}/sections/${section.id}`)}
            />
          ))}
        </Box>
      )}

      <CreateSectionDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        createFn={handleCreateSection}
        onCreated={(newSection) => setSections((prev) => [...prev, newSection])}
      />
    </Box>
  );
}
