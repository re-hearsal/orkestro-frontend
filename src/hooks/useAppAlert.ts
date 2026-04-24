import { useContext } from "react";
import { AppAlertContext } from "../context/AppAlertContext";

export function useAppAlert() {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }
  return ctx;
}
