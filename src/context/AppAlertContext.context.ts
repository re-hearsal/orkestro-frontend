import { createContext } from "react";
import type { AlertColor } from "@mui/material";

export interface AppAlertContextValue {
  showAlert: (message: string, severity?: AlertColor, autoHideDuration?: number) => void;
  clearAlert: () => void;
}

export const AppAlertContext = createContext<AppAlertContextValue | null>(null);
