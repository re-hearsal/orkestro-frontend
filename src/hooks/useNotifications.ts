import { useEffect, useState } from "react";
import client from "../api/client";
import type { components } from "../api/schema";
import { withFlatPagination } from "../utils/pagination";
import { useAuth } from "./useAuth";
import { JOIN_REQUESTS_UPDATED_EVENT } from "../utils/joinRequestsEvents";
import { NOTIFICATIONS_UPDATED_EVENT, emitNotificationsUpdated } from "../utils/notificationsEvents";

export { emitNotificationsUpdated };

const POLL_INTERVAL_MS = 10000;

export function useNotifications(): { unreadCount: number } {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    const token = user?.token ?? localStorage.getItem("orkestro_token");

    if (!token) {
      return;
    }

    const syncUnreadCount = async () => {
      try {
        const { data } = await client.GET("/api/v1/notifications", {
          params: {
            query: (withFlatPagination({}, { page: 0, size: 100 }) as unknown as {
              pageable: components["schemas"]["Pageable"];
            }),
          },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) {
          return;
        }

        const count: number =
          (data?.content ?? []).filter(
            (n) => n.isRead === false
          ).length;
        setUnreadCount(count);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch notifications:", err);
        }
      }
    };

    const refreshUnreadCount = () => {
      void syncUnreadCount();
    };

    const initialSyncTimer = window.setTimeout(() => {
      void syncUnreadCount();
    }, 0);

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshUnreadCount as EventListener);
    window.addEventListener(JOIN_REQUESTS_UPDATED_EVENT, refreshUnreadCount as EventListener);

    pollTimer = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialSyncTimer);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshUnreadCount as EventListener);
      window.removeEventListener(JOIN_REQUESTS_UPDATED_EVENT, refreshUnreadCount as EventListener);
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
    };
  }, [user?.token]);

  return { unreadCount };
}
