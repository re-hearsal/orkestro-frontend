import { useContext } from "react";
import { AppAlertContext } from "../context/AppAlertContext.context";

export function useAppAlert() {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }
  return ctx;
}
