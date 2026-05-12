import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import DateRangeIcon from "@mui/icons-material/DateRange";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";

export interface NavItemDef {
  key: string;
  icon: ComponentType<SvgIconProps>;
  labelKey: string;
  getPath: (orgId: number | null) => string;
  requiresOrg: boolean;
  requiresFund?: boolean;
  requiresJoinRequestView?: boolean;
  isBottom?: boolean;
}

const orgSegment =
  (segment: string) =>
  (orgId: number | null): string =>
    orgId != null ? `/organizations/${orgId}/${segment}` : "/organizations";

export const NAV_ITEMS: NavItemDef[] = [
  {
    key: "organizations",
    icon: GroupsIcon,
    labelKey: "nav.organizations",
    getPath: () => "/organizations",
    requiresOrg: false,
  },
  {
    key: "schedule",
    icon: DateRangeIcon,
    labelKey: "schedule.title",
    getPath: orgSegment("schedule"),
    requiresOrg: true,
  },
  {
    key: "feedback",
    icon: FeedbackOutlinedIcon,
    labelKey: "sidebar.feedback",
    getPath: orgSegment("feedback"),
    requiresOrg: true,
  },
  {
    key: "fund",
    icon: AccountBalanceWalletIcon,
    labelKey: "sidebar.fund",
    getPath: orgSegment("fund"),
    requiresOrg: true,
    requiresFund: true,
  },
  {
    key: "repertoire",
    icon: LibraryMusicIcon,
    labelKey: "sidebar.repertoire",
    getPath: orgSegment("repertoire"),
    requiresOrg: true,
  },
  {
    key: "tasks",
    icon: AssignmentIcon,
    labelKey: "sidebar.tasks",
    getPath: orgSegment("tasks"),
    requiresOrg: true,
  },
  {
    key: "sections",
    icon: FolderOutlinedIcon,
    labelKey: "sections.sections",
    getPath: orgSegment("sections"),
    requiresOrg: true,
  },
  {
    key: "joinRequests",
    icon: GroupAddIcon,
    labelKey: "sidebar.joinRequests",
    getPath: orgSegment("join-requests"),
    requiresOrg: true,
    requiresJoinRequestView: true,
    isBottom: true,
  },
];
