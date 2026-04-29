import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Popover, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import type { components } from '../../api/schema';
import { withFlatPagination } from '../../utils/pagination';
import { emitNotificationsUpdated } from '../../utils/notificationsEvents';
import { useAuth } from '../../hooks/useAuth';

type InAppNotificationDTO = components['schemas']['InAppNotificationDTO'];

const PAGE_SIZE = 10;

interface NotificationsDropdownProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '-';
  const datePart = parsed.toLocaleDateString('ru-RU');
  const timePart = parsed.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

export default function NotificationsDropdown({ anchorEl, onClose }: NotificationsDropdownProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const hoverTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const fetchPage = (pageNum: number, append: boolean, token: string, cancelled: { value: boolean }) => {
    const isFirst = !append;
    if (isFirst) setLoading(true); else setLoadingMore(true);

    client
      .GET('/api/v1/notifications', {
        params: {
          query: withFlatPagination({}, { page: pageNum, size: PAGE_SIZE, sort: ['createdAt,desc'] }) as never,
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (cancelled.value) return;
        const items = data?.content ?? [];
        const tp = (data?.page?.totalPages as number) ?? 0;
        setTotalPages(tp);
        setPage(pageNum);
        setNotifications((prev) => append ? [...prev, ...items] : items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled.value) {
          if (isFirst) setLoading(false); else setLoadingMore(false);
        }
      });
  };

  useEffect(() => {
    if (!Boolean(anchorEl)) {
      setNotifications([]);
      setPage(0);
      setTotalPages(0);
      return;
    }

    const token = user?.token ?? localStorage.getItem('orkestro_token');
    if (!token) return;

    const cancelled = { value: false };
    fetchPage(0, false, token, cancelled);
    return () => { cancelled.value = true; };
  }, [anchorEl, user?.token]);

  const handleLoadMore = () => {
    const token = user?.token ?? localStorage.getItem('orkestro_token');
    if (!token) return;
    const cancelled = { value: false };
    fetchPage(page + 1, true, token, cancelled);
  };

  const handleMouseEnter = (notification: InAppNotificationDTO) => {
    if (notification.isRead || notification.id == null) return;
    const id = notification.id;
    const token = user?.token ?? localStorage.getItem('orkestro_token');
    if (!token) return;

    const timer = setTimeout(() => {
      client
        .PATCH('/api/v1/notifications/{id}/read', {
          params: { path: { id } },
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(({ data }) => {
          if (data) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );
            emitNotificationsUpdated();
          }
        })
        .catch(() => {});
    }, 500);

    hoverTimers.current.set(id, timer);
  };

  const handleMouseLeave = (id?: number) => {
    if (id == null) return;
    const timer = hoverTimers.current.get(id);
    if (timer != null) {
      clearTimeout(timer);
      hoverTimers.current.delete(id);
    }
  };

  const hasMore = page < totalPages - 1;

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: 360,
            maxHeight: 480,
            overflowY: 'auto',
            borderRadius: 2,
            mt: 1,
          },
        },
      }}
    >
      <Typography
        sx={{
          fontFamily: 'Century Gothic, sans-serif',
          fontWeight: 700,
          px: 2,
          py: 1.5,
        }}
      >
        {t('notifications.title')}
      </Typography>
      <Divider />

      {loading ? (
        <Box
          sx={{
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
          }}
        >
          <Typography sx={{ fontFamily: 'Century Gothic, sans-serif', color: 'text.secondary' }}>
            {t('notifications.empty')}
          </Typography>
        </Box>
      ) : (
        <>
          {notifications.map((notification, index) => (
            <Box key={notification.id ?? index}>
              {index > 0 && <Divider />}
              <Box
                onMouseEnter={() => handleMouseEnter(notification)}
                onMouseLeave={() => handleMouseLeave(notification.id)}
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: notification.isRead ? '#fff' : 'rgba(15,62,181,0.07)',
                  cursor: 'default',
                  transition: 'background-color 0.2s',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Century Gothic, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    mb: 0.5,
                  }}
                >
                  {notification.title}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Century Gothic, sans-serif',
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    mb: 0.5,
                  }}
                >
                  {notification.body}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Century Gothic, sans-serif',
                    fontSize: '0.75rem',
                    color: 'text.disabled',
                  }}
                >
                  {formatDate(notification.createdAt)}
                </Typography>
              </Box>
            </Box>
          ))}

          {hasMore && (
            <>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  size="small"
                  sx={{
                    fontFamily: 'Century Gothic, sans-serif',
                    textTransform: 'none',
                    color: '#0f3eb5',
                  }}
                >
                  {loadingMore ? <CircularProgress size={16} /> : t('notifications.loadMore')}
                </Button>
              </Box>
            </>
          )}
        </>
      )}
    </Popover>
  );
}
