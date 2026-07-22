import { createContext } from "react";
import type { OrganizationDTO } from "./OrganizationContext";

export interface OrganizationContextValue {
  organizations: OrganizationDTO[];
  currentOrganization: OrganizationDTO | null;
  setCurrentOrganization: (org: OrganizationDTO | null) => void;
  refreshOrganizations: () => void;
}

export const OrganizationContext = createContext<OrganizationContextValue | null>(null);
