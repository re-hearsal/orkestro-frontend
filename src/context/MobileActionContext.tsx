import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface MobileAction {
  icon: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}

interface MobileActionContextType {
  mobileAction: MobileAction | null;
  setMobileAction: (action: MobileAction | null) => void;
}

const MobileActionContext = createContext<MobileActionContextType>({
  mobileAction: null,
  setMobileAction: () => undefined,
});

export function MobileActionProvider({ children }: { children: ReactNode }) {
  const [mobileAction, setMobileAction] = useState<MobileAction | null>(null);
  return (
    <MobileActionContext.Provider value={{ mobileAction, setMobileAction }}>
      {children}
    </MobileActionContext.Provider>
  );
}

export function useMobileActionValue(): MobileAction | null {
  return useContext(MobileActionContext).mobileAction;
}

export function useMobileAction(action: MobileAction | null) {
  const { setMobileAction } = useContext(MobileActionContext);
  const actionRef = useRef(action);
  actionRef.current = action;
  const hasAction = action !== null;

  useEffect(() => {
    setMobileAction(actionRef.current);
    return () => setMobileAction(null);
  }, [setMobileAction, hasAction]);
}
