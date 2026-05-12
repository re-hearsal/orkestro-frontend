import { Box, IconButton, SvgIcon } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import YouTubeIcon from "@mui/icons-material/YouTube";
import InstagramIcon from "@mui/icons-material/Instagram";
import FacebookIcon from "@mui/icons-material/Facebook";
import TelegramIcon from "@mui/icons-material/Telegram";
import LinkIcon from "@mui/icons-material/Link";
import type { components } from "../../api/schema";

type OrganizationLinkDTO = components["schemas"]["OrganizationLinkDTO"];
type LinkType = OrganizationLinkDTO["linkType"];

interface OrgSocialLinksProps {
  links?: OrganizationLinkDTO[];
}

function getIcon(linkType: LinkType) {
  switch (linkType) {
    case "WEBSITE":
      return <LanguageIcon sx={{ color: "#0f3eb5" }} />;
    case "YOUTUBE":
      return <YouTubeIcon sx={{ color: "#0f3eb5" }} />;
    case "INSTAGRAM":
      return <InstagramIcon sx={{ color: "#0f3eb5" }} />;
    case "FACEBOOK":
      return <FacebookIcon sx={{ color: "#0f3eb5" }} />;
    case "TELEGRAM":
      return <TelegramIcon sx={{ color: "#0f3eb5" }} />;
    case "VK":
      return (
        <SvgIcon sx={{ color: "#0f3eb5" }} viewBox="0 0 101 100">
          <path d="M53.7085 72.042C30.9168 72.042 17.9169 56.417 17.3752 30.417H28.7919C29.1669 49.5003 37.5834 57.5836 44.25 59.2503V30.417H55.0004V46.8752C61.5837 46.1669 68.4995 38.667 70.8329 30.417H81.5832C79.7915 40.5837 72.2915 48.0836 66.9582 51.1669C72.2915 53.6669 80.8336 60.2086 84.0836 72.042H72.2499C69.7082 64.1253 63.3754 58.0003 55.0004 57.1669V72.042H53.7085Z" />
        </SvgIcon>
      );
    case "OTHER":
      return <LinkIcon sx={{ color: "#0f3eb5" }} />;
    default:
      return <LinkIcon sx={{ color: "#0f3eb5" }} />;
  }
}

export default function OrgSocialLinks({ links }: OrgSocialLinksProps) {
  const normalizedLinks = (links ?? []).filter((link) => Boolean(link.url));

  if (normalizedLinks.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {normalizedLinks.map((link) => (
        <IconButton
          key={`${link.linkType}-${link.url}`}
          component="a"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            border: "1px solid #7795de",
            borderRadius: "12px",
            "&:hover": {
              backgroundColor: "rgba(15,62,181,0.08)",
            },
          }}
        >
          {getIcon(link.linkType)}
        </IconButton>
      ))}
    </Box>
  );
}
