import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Alert, Snackbar, type AlertColor } from "@mui/material";
import { AppAlertContext } from "./AppAlertContext.context";

interface AppAlertState {
  message: string;
  severity: AlertColor;
  autoHideDuration: number;
}

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AppAlertState | null>(null);

  const clearAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const showAlert = useCallback(
    (message: string, severity: AlertColor = "info", autoHideDuration = 5000) => {
      setAlert({ message, severity, autoHideDuration });
    },
    []
  );

  const value = useMemo(
    () => ({ showAlert, clearAlert }),
    [showAlert, clearAlert]
  );

  return (
    <AppAlertContext.Provider value={value}>
      {children}

      <Snackbar
        open={Boolean(alert)}
        autoHideDuration={alert?.autoHideDuration ?? 5000}
        onClose={clearAlert}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={alert?.severity ?? "info"} onClose={clearAlert} sx={{ whiteSpace: "pre-line" }}>
          {alert?.message ?? ""}
        </Alert>
      </Snackbar>
    </AppAlertContext.Provider>
  );
}
