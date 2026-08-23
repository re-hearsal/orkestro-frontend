import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import type { SectionDTO } from "./types";

const labelSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "#0f3eb5",
  mb: 1,
};

const subLabelSx = {
  fontFamily: "Century Gothic, sans-serif",
  fontWeight: 600,
  fontSize: "0.88rem",
  color: "#0f3eb5",
  mb: 0.75,
};

const blockSx = {
  border: "1px solid #dce6f9",
  borderRadius: "10px",
  p: 1.5,
  mb: 1.5,
};

interface ScheduleFiltersProps {
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  sections: SectionDTO[];
  sectionMode: "all" | "bySection";
  onSectionModeChange: (mode: "all" | "bySection") => void;
  selectedSectionIds: number[];
  onSelectedSectionsChange: (ids: number[]) => void;
}

export default function ScheduleFilters({
  allTags,
  selectedTags,
  onTagsChange,
  sections,
  sectionMode,
  onSectionModeChange,
  selectedSectionIds,
  onSelectedSectionsChange,
}: ScheduleFiltersProps) {
  const { t } = useTranslation();
  const [sectionMenuAnchor, setSectionMenuAnchor] = useState<HTMLElement | null>(null);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const addSection = (sectionId: number) => {
    if (!selectedSectionIds.includes(sectionId)) {
      onSelectedSectionsChange([...selectedSectionIds, sectionId]);
    }
    setSectionMenuAnchor(null);
  };

  const removeSection = (sectionId: number) => {
    onSelectedSectionsChange(selectedSectionIds.filter((id) => id !== sectionId));
  };

  const availableSectionsToAdd = sections.filter((s) => s.id != null && !selectedSectionIds.includes(s.id!));

  return (
    <Box>
      <Typography sx={labelSx}>{t("schedule.filters")}</Typography>

      <Box sx={blockSx}>
        <Typography sx={subLabelSx}>{t("schedule.filterTags")}</Typography>
        {allTags.length === 0 && (
          <Typography
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.82rem",
              color: "#7795de",
            }}
          >
            {t("schedule.noTags")}
          </Typography>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {allTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color={selectedTags.includes(tag) ? "primary" : "default"}
              onClick={() => toggleTag(tag)}
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                cursor: "pointer",
                ...(selectedTags.includes(tag)
                  ? {}
                  : {
                      backgroundColor: "#f0f4ff",
                      color: "#0f3eb5",
                      border: "1px solid #dce6f9",
                    }),
              }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={blockSx}>
        <Typography sx={subLabelSx}>{t("schedule.filterSections")}</Typography>
        <ToggleButtonGroup
          value={sectionMode}
          exclusive
          orientation="vertical"
          size="small"
          onChange={(_, val: "all" | "bySection") => {
            if (val) {onSectionModeChange(val);}
          }}
          sx={{ mb: 1, width: "100%" }}
        >
          <ToggleButton
            value="all"
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.78rem",
              textTransform: "none",
            }}
          >
            {t("schedule.allEvents")}
          </ToggleButton>
          <ToggleButton
            value="bySection"
            sx={{
              fontFamily: "Century Gothic, sans-serif",
              fontSize: "0.78rem",
              textTransform: "none",
            }}
          >
            {t("schedule.bySection")}
          </ToggleButton>
        </ToggleButtonGroup>

        {sectionMode === "bySection" && (
          <Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.75 }}>
              {selectedSectionIds.map((sectionId) => {
                const section = sections.find((s) => s.id === sectionId);
                return (
                  <Chip
                    key={sectionId}
                    label={section?.name ?? `#${sectionId}`}
                    size="small"
                    onDelete={() => removeSection(sectionId)}
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
              disabled={availableSectionsToAdd.length === 0}
              onClick={(e) => setSectionMenuAnchor(e.currentTarget)}
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                fontSize: "0.78rem",
                textTransform: "none",
                borderColor: "#7795de",
                color: "#0f3eb5",
              }}
            >
              {t("schedule.addSection")}
            </Button>
            <Menu
              anchorEl={sectionMenuAnchor}
              open={Boolean(sectionMenuAnchor)}
              onClose={() => setSectionMenuAnchor(null)}
            >
              {availableSectionsToAdd.map((section) => (
                <MenuItem
                  key={section.id}
                  onClick={() => addSection(section.id!)}
                  sx={{ fontFamily: "Century Gothic, sans-serif", fontSize: "0.88rem" }}
                >
                  {section.name}
                </MenuItem>
              ))}
            </Menu>
          </Box>
        )}
      </Box>
    </Box>
  );
}
