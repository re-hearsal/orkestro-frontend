import { useEffect, useState, useCallback } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrganization } from "../hooks/useOrganization";
import { useAuth } from "../hooks/useAuth";
import OrgEmptyState from "../components/organizations/OrgEmptyState";
import OrgCard from "../components/organizations/OrgCard";
import client from "../api/client";
import type { components } from "../api/schema";
import { toRenderableImageSource } from "../utils/imageSource";
import { withFlatPagination } from "../utils/pagination";

type OrganizationDTO = components["schemas"]["OrganizationDTO"];
type TechnicalRoleDTO = components["schemas"]["TechnicalRoleDTO"];

interface OrganizationMemberDTO {
  id?: number;
  name?: string;
  profileImageFileId?: number;
}

async function fetchLeaders(orgId: number, token: string): Promise<string[]> {
  try {
    const { data: rolesData } = await client.GET(
      "/api/v1/organizations/{organizationId}/roles",
      {
        params: { path: { organizationId: orgId } },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const roles = (rolesData as unknown as TechnicalRoleDTO[]) ?? [];
    const leaderRole = roles.find(
      (r) => r.system && r.name?.toLowerCase() === "leader"
    );
    if (!leaderRole?.id) return [];

    const { data: membersData } = await client.GET(
      "/api/v1/organizations/{organizationId}/members/page",
      {
        params: {
          path: { organizationId: orgId },
          query: (withFlatPagination(
            {
              roleIds: [leaderRole.id],
            },
            { page: 0, size: 2 }
          ) as unknown as {
            roleIds?: number[];
            pageable: components["schemas"]["Pageable"];
          }),
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const content = ((membersData?.content as unknown as OrganizationMemberDTO[]) ?? []).slice(0, 2);
    return content.map((m) => m.name ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchImageUrl(
  fileId: number,
  token: string
): Promise<string | undefined> {
  try {
    const { data } = await client.GET("/api/v1/files/{fileId}", {
      params: { path: { fileId } },
      headers: { Authorization: `Bearer ${token}` },
      parseAs: "blob",
    });
    if (!data) return undefined;
    return await toRenderableImageSource(data as unknown as Blob);
  } catch {
    return undefined;
  }
}

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizations, currentOrganization, setCurrentOrganization } =
    useOrganization();
  const { user } = useAuth();

  const [leaders, setLeaders] = useState<Record<number, string[]>>({});
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const loadOrgData = useCallback(
    async (orgs: OrganizationDTO[], token: string) => {
      setLoading(true);
      const leadersMap: Record<number, string[]> = {};
      const imagesMap: Record<number, string> = {};

      await Promise.all(
        orgs.map(async (org) => {
          if (org.id == null) return;
          const [orgLeaders, imageUrl] = await Promise.all([
            fetchLeaders(org.id, token),
            org.profileImageFileId != null
              ? fetchImageUrl(org.profileImageFileId, token)
              : Promise.resolve(undefined),
          ]);
          leadersMap[org.id] = orgLeaders;
          if (imageUrl) imagesMap[org.id] = imageUrl;
        })
      );

      setLeaders(leadersMap);
      setImageUrls(imagesMap);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (user && organizations.length > 0) {
      loadOrgData(organizations, user.token);
    }
  }, [organizations, user, loadOrgData]);

  const handleCardClick = (org: OrganizationDTO) => {
    setCurrentOrganization(org);
    navigate(`/organizations/${org.id}`);
  };

  if (organizations.length === 0 && !loading) {
    return <OrgEmptyState />;
  }

  const otherOrgs = organizations.filter(
    (o) => o.id !== currentOrganization?.id
  );

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
        <Button
          variant="outlined"
          onClick={() => navigate("/organizations/create")}
          sx={{
            borderRadius: "24px",
            borderColor: "#0f3eb5",
            color: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            px: 3,
            textTransform: "none",
            "&:hover": { bgcolor: "#f0f4ff", borderColor: "#0f3eb5" },
          }}
        >
          {t("organizations.page.createButton")}
        </Button>
      </Box>

      {loading && organizations.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : (
        <>
          {currentOrganization && (
            <Box sx={{ mb: 4 }}>
              <Typography
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "#7795de",
                  mb: 1.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {t("organizations.page.currentSection")}
              </Typography>
              <OrgCard
                org={currentOrganization}
                leaders={leaders[currentOrganization.id!] ?? []}
                imageUrl={
                  currentOrganization.id != null
                    ? imageUrls[currentOrganization.id]
                    : undefined
                }
                onClick={() => handleCardClick(currentOrganization)}
              />
            </Box>
          )}

          {otherOrgs.length > 0 && (
            <Box>
              <Typography
                sx={{
                  fontFamily: "Century Gothic, sans-serif",
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "#7795de",
                  mb: 1.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {t("organizations.page.othersSection")}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {otherOrgs.map((org) => (
                  <OrgCard
                    key={org.id}
                    org={org}
                    leaders={org.id != null ? (leaders[org.id] ?? []) : []}
                    imageUrl={org.id != null ? imageUrls[org.id] : undefined}
                    onClick={() => handleCardClick(org)}
                  />
                ))}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
