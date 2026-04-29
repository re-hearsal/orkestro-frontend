import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Pagination,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import i18n from "../i18n";
import type { components } from "../api/schema";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import { onSongDeleted } from "../utils/songEvents";
import CreateSongDialog from "../components/repertoire/CreateSongDialog";

type SongDTO = components["schemas"]["SongDTO"];

interface SongsPage {
  content?: SongDTO[];
}


const SERVER_PAGE_SIZE = 1000;
const CLIENT_PAGE_SIZE = 20;

export default function OrgRepertoirePage() {
  const { t } = useTranslation();
  const { organizationId: rawOrganizationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const organizationId = useMemo(() => Number(rawOrganizationId), [rawOrganizationId]);
  const isValidOrganizationId = Number.isFinite(organizationId) && organizationId > 0;

  const { permissions } = useOrgMemberContext(isValidOrganizationId ? organizationId : 0);

  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [allSongs, setAllSongs] = useState<SongDTO[]>([]);
  const [page, setPage] = useState(1);
  const [songsLoading, setSongsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreateSong = permissions.has("REPERTOIRE_CREATE_SONG");

  // Derived: client-side tag filter + pagination
  const filteredSongs = useMemo(
    () =>
      selectedTags.length === 0
        ? allSongs
        : allSongs.filter((s) => selectedTags.every((t) => s.tags?.includes(t))),
    [allSongs, selectedTags]
  );

  const totalPages = Math.ceil(filteredSongs.length / CLIENT_PAGE_SIZE);
  const pagedSongs = filteredSongs.slice((page - 1) * CLIENT_PAGE_SIZE, page * CLIENT_PAGE_SIZE);

  // Sync current organization
  useEffect(() => {
    if (!isValidOrganizationId) return;
    if (currentOrganization?.id === organizationId) return;
    const matched = organizations.find((o) => o.id === organizationId);
    if (matched) setCurrentOrganization(matched);
  }, [currentOrganization?.id, isValidOrganizationId, organizationId, organizations, setCurrentOrganization]);

  // Load available tags
  useEffect(() => {
    if (!user || !isValidOrganizationId) return;

    void (async () => {
      const { data } = await client.GET(
        "/api/v1/organizations/{organizationId}/repertoire/songs/tags",
        {
          params: { path: { organizationId } },
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      setTags((data as unknown as string[]) ?? []);
    })();
  }, [isValidOrganizationId, organizationId, user]);

  // Debounce text input
  useEffect(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  // Reset to page 1 when tag selection changes
  useEffect(() => {
    setPage(1);
  }, [selectedTags]);

  const loadSongs = useCallback(
    async (searchQuery: string) => {
      if (!user || !isValidOrganizationId) return;
      setSongsLoading(true);
      try {
        const flatQuery = withFlatPagination(
          searchQuery ? { query: searchQuery } : {},
          { page: 0, size: SERVER_PAGE_SIZE }
        );

        const { data, error } = await client.GET(
          "/api/v1/organizations/{organizationId}/repertoire/songs/page",
          {
            params: {
              path: { organizationId },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              query: flatQuery as any,
            },
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        if (error) throw error;

        const payload = (data as unknown as SongsPage) ?? {};
        setAllSongs(payload.content ?? []);
      } catch (err) {
        showAlert(String(err) || String(i18n.t("repertoire.loadSongsError")), "error");
        setAllSongs([]);
      } finally {
        setSongsLoading(false);
      }
    },
    [isValidOrganizationId, organizationId, showAlert, user]
  );

  useEffect(() => {
    void loadSongs(debouncedQuery);
  }, [loadSongs, debouncedQuery]);

  useEffect(() => {
    const unsubscribe = onSongDeleted((detail) => {
      if (detail.organizationId !== organizationId) return;
      void loadSongs(debouncedQuery);
    });
    return unsubscribe;
  }, [debouncedQuery, loadSongs, organizationId]);

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: "Century Gothic, sans-serif", fontWeight: 700, color: "#0f3eb5" }}
        >
          {t("repertoire.title")}
        </Typography>

        {canCreateSong && (
          <Button
            variant="outlined"
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              whiteSpace: "nowrap",
              "&:hover": {
                borderColor: "#0f3eb5",
                backgroundColor: "rgba(15,62,181,0.08)",
              },
            }}
          >
            {t("repertoire.addSong")}
          </Button>
        )}
      </Box>

      {/* Search field */}
      <TextField
        size="small"
        placeholder={String(t("repertoire.searchPlaceholder"))}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ width: 400, mb: tags.length > 0 ? 1.5 : 2 }}
        slotProps={{
          input: { sx: { fontFamily: "Century Gothic, sans-serif" } },
        }}
      />

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2, alignItems: "center" }}>
          {(tagsExpanded ? tags : tags.slice(0, 10)).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color={selectedTags.includes(tag) ? "primary" : "default"}
              onClick={() => handleTagClick(tag)}
              sx={{ cursor: "pointer" }}
            />
          ))}
          {tags.length > 10 && !tagsExpanded && (
            <Chip
              label={`+${tags.length - 10}`}
              size="small"
              variant="outlined"
              onClick={() => setTagsExpanded(true)}
              sx={{ cursor: "pointer", borderStyle: "dashed" }}
            />
          )}
          {tagsExpanded && (
            <Chip
              label="↑"
              size="small"
              variant="outlined"
              onClick={() => setTagsExpanded(false)}
              sx={{ cursor: "pointer", borderStyle: "dashed" }}
            />
          )}
        </Box>
      )}

      {/* Songs list */}
      {songsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#0f3eb5" }} />
        </Box>
      ) : pagedSongs.length === 0 ? (
        <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de", py: 4, textAlign: "center" }}>
          {t("repertoire.notFound")}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {pagedSongs.map((song) => (
            <Paper
              key={song.id}
              elevation={0}
              onClick={() => navigate(`/organizations/${organizationId}/repertoire/songs/${song.id}`)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1.5,
                border: "1px solid #dce6f9",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background 0.15s",
                "&:hover": { background: "#f0f4fd" },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    fontFamily: "Century Gothic, sans-serif",
                    color: "#0f3eb5",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {song.title}
                </Typography>

                {song.composer && (
                  <Typography
                    sx={{
                      fontSize: "0.85rem",
                      color: "text.secondary",
                      fontFamily: "Century Gothic, sans-serif",
                    }}
                  >
                    {song.composer}
                  </Typography>
                )}

                {song.tags && song.tags.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                    {song.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                )}
              </Box>

              <ChevronRightIcon sx={{ color: "#7795de", flexShrink: 0 }} />
            </Paper>
          ))}
        </Box>
      )}

      {/* Pagination */}
      {totalPages > 1 && !songsLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      <CreateSongDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        organizationId={organizationId}
        onCreated={(songId) => {
          setCreateDialogOpen(false);
          void loadSongs(debouncedQuery);
          navigate(`/organizations/${organizationId}/repertoire/songs/${songId}`);
        }}
      />
    </Box>
  );
}
