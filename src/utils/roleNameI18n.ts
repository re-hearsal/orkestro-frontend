import type { TFunction } from "i18next";

const ROLE_NAME_ALIASES: Record<string, string> = {
  leader: "leader",
  "co leader": "coLeader",
  "co-leader": "coLeader",
  coleader: "coLeader",
};

function normalizeRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[._/-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function getLocalizedRoleName(name: string | undefined, t: TFunction): string {
  if (!name) {
    return "";
  }

  const key = ROLE_NAME_ALIASES[normalizeRoleName(name)];
  if (!key) {
    return name;
  }

  return String(t(`organizations.roleNames.${key}`, { defaultValue: name }));
}
