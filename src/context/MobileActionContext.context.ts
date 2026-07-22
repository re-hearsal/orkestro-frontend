import { createContext, type ReactNode } from "react";

export interface MobileAction {
  icon: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}

export interface MobileActionContextType {
  mobileAction: MobileAction | null;
  setMobileAction: (action: MobileAction | null) => void;
}

export const MobileActionContext = createContext<MobileActionContextType>({
  mobileAction: null,
  setMobileAction: () => undefined,
});
