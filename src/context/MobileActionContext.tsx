import { useState, type ReactNode } from "react";
import { MobileActionContext, type MobileAction } from "./MobileActionContext.context";

export function MobileActionProvider({ children }: { children: ReactNode }) {
  const [mobileAction, setMobileAction] = useState<MobileAction | null>(null);
  return (
    <MobileActionContext.Provider value={{ mobileAction, setMobileAction }}>
      {children}
    </MobileActionContext.Provider>
  );
}
