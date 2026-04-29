import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import client from "../../api/client";
import type { components } from "../../api/schema";
import { useAuth } from "../../hooks/useAuth";

type OrgFundTransactionDTO = components["schemas"]["OrgFundTransactionDTO"];

type OperationType = "DEPOSIT" | "WITHDRAWAL";

const DESCRIPTION_MAX_LENGTH = 500;

interface CreateFundTransactionDialogProps {
  organizationId: number;
  open: boolean;
  onClose: () => void;
  onCreated: (transaction: OrgFundTransactionDTO) => Promise<void> | void;
}

function parseApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if ("details" in error && Array.isArray(error.details)) {
    const details = error.details.filter((item): item is string => typeof item === "string");
    if (details.length > 0) {
      return details.join("\n");
    }
  }

  return null;
}

export default function CreateFundTransactionDialog({
  organizationId,
  open,
  onClose,
  onCreated,
}: CreateFundTransactionDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [operationType, setOperationType] = useState<OperationType>("DEPOSIT");
  const [amountInput, setAmountInput] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const parsedAmount = useMemo(() => {
    const normalized = amountInput.replace(",", ".").trim();
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric;
  }, [amountInput]);

  const resetForm = () => {
    setOperationType("DEPOSIT");
    setAmountInput("");
    setDescription("");
    setFormError(null);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!user) {
      return;
    }

    if (parsedAmount == null || parsedAmount <= 0) {
      setFormError(String(t("fund.create.amountInvalid")));
      return;
    }

    const signedAmount = operationType === "WITHDRAWAL" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    setSubmitting(true);
    setFormError(null);

    try {
      const { data, error } = await client.POST("/api/v1/organizations/{organizationId}/fund/transactions", {
        params: { path: { organizationId } },
        body: {
          amount: signedAmount,
          description: description.trim() || undefined,
        },
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (error) {
        const errorMessage = parseApiErrorMessage(error);
        if (errorMessage?.toLowerCase().includes("negative balance")) {
          setFormError(String(t("fund.create.overdraftError")));
        } else {
          setFormError(errorMessage ?? String(t("fund.create.createFailed")));
        }
        return;
      }

      await onCreated((data as OrgFundTransactionDTO) ?? {});
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle
        sx={{
          fontFamily: "Century Gothic, sans-serif",
          fontWeight: 700,
          color: "#0f3eb5",
        }}
      >
        {t("fund.create.title")}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontFamily: "Century Gothic, sans-serif" }}>
              {t("fund.create.operationLabel")}
            </InputLabel>
            <Select
              value={operationType}
              label={t("fund.create.operationLabel")}
              onChange={(event) => {
                setOperationType(event.target.value as OperationType);
              }}
              disabled={submitting}
              sx={{ fontFamily: "Century Gothic, sans-serif" }}
            >
              <MenuItem value="DEPOSIT">{t("fund.create.operationDeposit")}</MenuItem>
              <MenuItem value="WITHDRAWAL">{t("fund.create.operationWithdrawal")}</MenuItem>
            </Select>
          </FormControl>

          <TextField
            type="number"
            fullWidth
            size="small"
            label={t("fund.create.amountLabel")}
            value={amountInput}
            onChange={(event) => {
              setAmountInput(event.target.value);
              if (formError) {
                setFormError(null);
              }
            }}
            disabled={submitting}
            slotProps={{
              inputLabel: { sx: { fontFamily: "Century Gothic, sans-serif" } },
              input: { sx: { fontFamily: "Century Gothic, sans-serif" } },
            }}
          />

          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            size="small"
            label={t("fund.create.descriptionLabel")}
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
            disabled={submitting}
            helperText={`${description.length}/${DESCRIPTION_MAX_LENGTH}`}
            slotProps={{
              inputLabel: { sx: { fontFamily: "Century Gothic, sans-serif" } },
              htmlInput: { maxLength: DESCRIPTION_MAX_LENGTH },
              input: { sx: { fontFamily: "Century Gothic, sans-serif" } },
            }}
          />

          {formError && (
            <Typography sx={{ color: "#d32f2f", fontFamily: "Century Gothic, sans-serif", fontSize: "0.9rem" }}>
              {formError}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, px: 3, py: 2 }}>
        <Button
          onClick={handleClose}
          disabled={submitting}
          variant="outlined"
          sx={{
            borderRadius: "8px",
            borderColor: "#7795de",
            color: "#7795de",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
          }}
        >
          {t("fund.create.cancel")}
        </Button>

        <Button
          onClick={() => {
            void handleSubmit();
          }}
          disabled={submitting}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
          sx={{
            borderRadius: "8px",
            backgroundColor: "#0f3eb5",
            fontFamily: "Century Gothic, sans-serif",
            textTransform: "none",
            "&:hover": { backgroundColor: "#0c32a0" },
          }}
        >
          {t("fund.create.submit")}
        </Button>
      </Box>
    </Dialog>
  );
}
