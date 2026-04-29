import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Pagination, TextField, Typography } from "@mui/material";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import i18n from "../i18n";
import type { components } from "../api/schema";
import { useAppAlert } from "../hooks/useAppAlert";
import { useAuth } from "../hooks/useAuth";
import { useOrgMemberContext } from "../hooks/useOrgMemberContext";
import { useOrganization } from "../hooks/useOrganization";
import { withFlatPagination } from "../utils/pagination";
import { onFundRealtimeSnapshot } from "../utils/fundEvents";
import FundTransactionRow from "../components/fund/FundTransactionRow";
import CreateFundTransactionDialog from "../components/fund/CreateFundTransactionDialog";

type OrgFundDTO = components["schemas"]["OrgFundDTO"];
type OrgFundTransactionDTO = components["schemas"]["OrgFundTransactionDTO"];

interface FundTransactionsPage {
  content?: OrgFundTransactionDTO[];
  page?: {
    totalPages?: number;
  };
}

const PAGE_SIZE = 5;

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return null;
}

function toUserTimezoneBoundaryIso(value: string, boundary: "start" | "end"): string | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return undefined;
  }

  const date =
    boundary === "start"
      ? new Date(year, monthIndex, day, 0, 0, 0, 0)
      : new Date(year, monthIndex, day, 23, 59, 59, 999);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export default function OrgFundPage() {
  const { t } = useTranslation();
  const { organizationId: rawOrganizationId } = useParams();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const organizationId = useMemo(() => Number(rawOrganizationId), [rawOrganizationId]);
  const isValidOrganizationId = Number.isFinite(organizationId) && organizationId > 0;

  const {
    permissions,
    loading: memberContextLoading,
    initialized: memberContextInitialized,
    error: memberContextError,
  } = useOrgMemberContext(isValidOrganizationId ? organizationId : 0);

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [transactions, setTransactions] = useState<OrgFundTransactionDTO[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");

  const loadBalance = useCallback(async () => {
    if (!user || !isValidOrganizationId) {
      setBalance(null);
      setBalanceLoading(false);
      return;
    }

    setBalanceLoading(true);

    try {
      const { data, error } = await client.GET("/api/v1/organizations/{organizationId}/fund", {
        params: { path: { organizationId } },
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (error) {
        throw error;
      }

      const payload = data as OrgFundDTO;
      setBalance(typeof payload?.balance === "number" ? payload.balance : null);
    } catch (error) {
      setBalance(null);
      showAlert(getErrorMessage(error) ?? String(i18n.t("fund.page.balanceLoadError")), "error");
    } finally {
      setBalanceLoading(false);
    }
  }, [isValidOrganizationId, organizationId, showAlert, user]);

  const loadTransactions = useCallback(
    async (targetPage: number) => {
      if (!user || !isValidOrganizationId) {
        setTransactions([]);
        setTransactionsLoading(false);
        setTransactionsError(null);
        setTotalPages(0);
        setPage(0);
        return;
      }

      setTransactionsLoading(true);
      setTransactionsError(null);

      try {
        const query = withFlatPagination(
          {},
          { page: targetPage, size: PAGE_SIZE, sort: ["createdAt,desc"] }
        ) as unknown as {
          page?: number;
          size?: number;
          sort?: string[];
          pageable: components["schemas"]["Pageable"];
        };

        const { data, error } = await client.GET("/api/v1/organizations/{organizationId}/fund/transactions", {
          params: {
            path: { organizationId },
            query,
          },
          headers: { Authorization: `Bearer ${user.token}` },
        });

        if (error) {
          throw error;
        }

        const payload = (data as unknown as FundTransactionsPage) ?? {};
        setTransactions(payload.content ?? []);
        setTotalPages(payload.page?.totalPages ?? 0);
        setPage(targetPage);
      } catch (error) {
        setTransactions([]);
        setTransactionsError(getErrorMessage(error) ?? String(i18n.t("fund.page.transactionsLoadError")));
      } finally {
        setTransactionsLoading(false);
      }
    },
    [isValidOrganizationId, organizationId, user]
  );

  useEffect(() => {
    if (!memberContextInitialized || memberContextLoading || memberContextError) {
      return;
    }

    void loadBalance();
  }, [loadBalance, memberContextError, memberContextInitialized, memberContextLoading]);

  useEffect(() => {
    if (!memberContextInitialized || memberContextLoading || memberContextError) {
      return;
    }

    void loadTransactions(0);
  }, [loadTransactions, memberContextError, memberContextInitialized, memberContextLoading]);

  useEffect(() => {
    if (!isValidOrganizationId) {
      return;
    }

    if (currentOrganization?.id === organizationId) {
      return;
    }

    const matchedOrganization = organizations.find((org) => org.id === organizationId);
    if (matchedOrganization) {
      setCurrentOrganization(matchedOrganization);
    }
  }, [currentOrganization?.id, isValidOrganizationId, organizationId, organizations, setCurrentOrganization]);

  useEffect(() => {
    const unsubscribe = onFundRealtimeSnapshot((snapshot) => {
      if (!isValidOrganizationId || snapshot.organizationId !== organizationId) {
        return;
      }

      setBalance(typeof snapshot.balance === "number" ? snapshot.balance : null);
      setBalanceLoading(false);

      const nextTransactions = snapshot.transactions ?? [];
      setTransactions(nextTransactions);
      setTransactionsError(null);
      setTransactionsLoading(false);

      const totalTransactions =
        typeof snapshot.totalTransactions === "number"
          ? snapshot.totalTransactions
          : nextTransactions.length;
      setTotalPages(Math.ceil(totalTransactions / PAGE_SIZE));
      setPage(0);
    });

    return unsubscribe;
  }, [isValidOrganizationId, organizationId]);

  if (!isValidOrganizationId) {
    return <Navigate to="/organizations" replace />;
  }

  if (memberContextInitialized && !memberContextLoading && memberContextError) {
    return <Navigate to={`/organizations/${organizationId}`} replace />;
  }

  if (!memberContextInitialized || memberContextLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#0f3eb5" }} />
      </Box>
    );
  }

  const canCreateTransaction = permissions.has("ORG_FUND_MANIPULATION");
  const formattedBalance =
    typeof balance === "number"
      ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(balance)
      : "-";

  const handleTransactionCreated = async () => {
    setCreateDialogOpen(false);
    showAlert(String(t("fund.create.success")), "success");
    await Promise.all([loadBalance(), loadTransactions(0)]);
  };

  const handleExportCsv = async () => {
    if (!user || !isValidOrganizationId || exportingCsv) {
      return;
    }

    if (exportDateFrom && exportDateTo && exportDateFrom > exportDateTo) {
      showAlert(String(t("fund.export.invalidRange")), "warning");
      return;
    }

    setExportingCsv(true);

    try {
      const dateFromIso = exportDateFrom
        ? toUserTimezoneBoundaryIso(exportDateFrom, "start")
        : undefined;
      const dateToIso = exportDateTo
        ? toUserTimezoneBoundaryIso(exportDateTo, "end")
        : undefined;

      const { data, error, response } = await client.GET(
        "/api/v1/organizations/{organizationId}/fund/transactions/export",
        {
          params: {
            path: { organizationId },
            query: {
              dateFrom: dateFromIso,
              dateTo: dateToIso,
            },
          },
          headers: { Authorization: `Bearer ${user.token}` },
          parseAs: "blob",
        }
      );

      if (error || !data) {
        throw error ?? new Error("Empty CSV response");
      }

      const fallbackName = `org-fund-transactions-${organizationId}.csv`;
      const contentDisposition = response.headers.get("content-disposition");
      const parsedFilename = contentDisposition
        ?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
        ?.slice(1)
        .find(Boolean);
      const fileName = parsedFilename ? decodeURIComponent(parsedFilename) : fallbackName;

      const url = URL.createObjectURL(data as unknown as Blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAlert(getErrorMessage(error) ?? String(t("fund.export.exportFailed")), "error");
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1040, mx: "auto" }}>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            fontWeight: 700,
            color: "#0f3eb5",
          }}
        >
          {t("fund.page.title")}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {canCreateTransaction && (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              variant="outlined"
              sx={{
                borderRadius: "8px",
                borderColor: "#0f3eb5",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                fontWeight: 700,
                textTransform: "none",
                whiteSpace: "nowrap",
                "&:hover": {
                  borderColor: "#0f3eb5",
                  backgroundColor: "rgba(15,62,181,0.08)",
                },
              }}
            >
              {t("fund.create.openButton")}
            </Button>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid #dce6f9",
          background: "#ffffff",
          p: { xs: 2, sm: 3 },
          mb: 3,
        }}
      >
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#7795de",
            fontSize: "0.9rem",
            mb: 0.5,
          }}
        >
          {t("fund.page.balanceLabel")}
        </Typography>

        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#0f3eb5",
            fontWeight: 700,
            fontSize: { xs: "1.9rem", sm: "2.8rem" },
            lineHeight: 1.1,
            wordBreak: "break-word",
          }}
        >
          {balanceLoading ? "..." : formattedBalance}
        </Typography>
      </Box>

      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid #dce6f9",
          background: "#ffffff",
          p: { xs: 2, sm: 3 },
        }}
      >
        <Typography
          sx={{
            fontFamily: "Century Gothic, sans-serif",
            color: "#0f3eb5",
            fontWeight: 700,
            fontSize: "1.1rem",
            mb: 1.5,
          }}
        >
          {t("fund.page.transactionsTitle")}
        </Typography>

        {transactionsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress sx={{ color: "#0f3eb5" }} />
          </Box>
        ) : transactionsError ? (
          <Box sx={{ py: 1 }}>
            <Typography
              sx={{
                fontFamily: "Century Gothic, sans-serif",
                color: "#d32f2f",
                mb: 1,
              }}
            >
              {transactionsError}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                void loadTransactions(page);
              }}
              sx={{
                borderRadius: "8px",
                borderColor: "#0f3eb5",
                color: "#0f3eb5",
                fontFamily: "Century Gothic, sans-serif",
                textTransform: "none",
                "&:hover": {
                  borderColor: "#0f3eb5",
                  backgroundColor: "rgba(15,62,181,0.08)",
                },
              }}
            >
              {t("fund.page.retry")}
            </Button>
          </Box>
        ) : transactions.length === 0 ? (
          <Typography sx={{ fontFamily: "Century Gothic, sans-serif", color: "#7795de" }}>
            {t("fund.page.empty")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {transactions.map((transaction) => (
              <FundTransactionRow
                key={`${transaction.id ?? "tx"}-${transaction.createdAt ?? ""}`}
                transaction={transaction}
              />
            ))}
          </Box>
        )}

        {totalPages > 1 && !transactionsLoading && !transactionsError && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page + 1}
              onChange={(_, value) => { void loadTransactions(value - 1); }}
              color="primary"
            />
          </Box>
        )}

        <Box
          sx={{
            mt: 2.5,
            pt: 2,
            borderTop: "1px solid #e7effb",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
          }}
        >
          <TextField
            type="date"
            size="small"
            label={t("fund.export.dateFrom")}
            value={exportDateFrom}
            onChange={(event) => setExportDateFrom(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true, sx: { fontFamily: "Century Gothic, sans-serif" } },
              input: { sx: { fontFamily: "Century Gothic, sans-serif" } },
            }}
          />

          <TextField
            type="date"
            size="small"
            label={t("fund.export.dateTo")}
            value={exportDateTo}
            onChange={(event) => setExportDateTo(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true, sx: { fontFamily: "Century Gothic, sans-serif" } },
              input: { sx: { fontFamily: "Century Gothic, sans-serif" } },
            }}
          />

          <Button
            onClick={() => {
              void handleExportCsv();
            }}
            disabled={exportingCsv}
            variant="outlined"
            sx={{
              borderRadius: "8px",
              borderColor: "#0f3eb5",
              color: "#0f3eb5",
              fontFamily: "Century Gothic, sans-serif",
              fontWeight: 700,
              textTransform: "none",
              whiteSpace: "nowrap",
              "&:hover": {
                borderColor: "#0f3eb5",
                backgroundColor: "rgba(15,62,181,0.08)",
              },
            }}
          >
            {exportingCsv ? t("fund.export.loading") : t("fund.export.button")}
          </Button>
        </Box>
      </Box>

      <CreateFundTransactionDialog
        organizationId={organizationId}
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={handleTransactionCreated}
      />
    </Box>
  );
}
