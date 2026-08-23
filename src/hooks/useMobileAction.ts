import { useContext, useEffect, useRef } from "react";
import { MobileActionContext, type MobileAction } from "../context/MobileActionContext.context";

export function useMobileActionValue(): MobileAction | null {
  return useContext(MobileActionContext).mobileAction;
}

export function useMobileAction(action: MobileAction | null) {
  const { setMobileAction } = useContext(MobileActionContext);
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  });

  const hasAction = action !== null;

  useEffect(() => {
    setMobileAction(actionRef.current);
    return () => setMobileAction(null);
  }, [setMobileAction, hasAction]);
}
