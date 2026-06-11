import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/apiService';
import { useLanguage } from '../contexts/LanguageContext';
import { notify } from '../services/notificationService';
import Loader from '../components/common/Loader';

const linkToPath = (link) => {
  if (!link) return null;
  const path = link.startsWith('/') ? link : `/${link}`;
  const map = {
    '/stock': '/stock',
    '/invoices': '/invoices',
    '/products': '/products',
    '/purchase-orders': '/purchase-orders',
    '/reports': '/reports',
    '/settings': '/settings',
  };
  return map[path] || path;
};

const formatTimeAgo = (dateStr, t) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1) return t('just_now');
  if (diff < 60) return t('minutes_ago').replace('{minutes}', diff);
  if (diff < 120) return t('hour_ago');
  return t('hours_ago').replace('{hours}', Math.floor(diff / 60));
};

const Notifications = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (filter === 'unread') params.unread_only = true;
      const res = await notificationService.getAll(params);
      if (res.data?.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      notify.error(t('notifications_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notif) => {
    if (!notif.is_read) {
      try {
        await notificationService.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        /* ignore */
      }
    }
    const path = linkToPath(notif.link);
    if (path) navigate(path);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      notify.success(t('notifications_all_read'));
    } catch (err) {
      notify.error(t('notifications_action_error'));
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notify.success(t('notification_deleted'));
    } catch (err) {
      notify.error(t('notifications_action_error'));
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return <Loader text={t('loading')} />;
  }

  return (
    <div className="notifications-page">
      <div className="notifications-toolbar">
        <div className="filter-tabs">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            {t('all')} ({notifications.length})
          </button>
          <button
            className={filter === 'unread' ? 'active' : ''}
            onClick={() => setFilter('unread')}
          >
            {t('unread')} ({unreadCount})
          </button>
        </div>
        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={handleMarkAllRead}>
            {t('mark_all_read')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <span className="empty-icon">🔔</span>
          <p>{t('no_notifications')}</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`notification-row ${!notif.is_read ? 'unread' : ''}`}
              onClick={() => handleMarkRead(notif)}
            >
              <span className="notif-icon">{notif.icon}</span>
              <div className="notif-content">
                <div className="notif-title">{notif.title}</div>
                <div className="notif-message">{notif.message}</div>
                <div className="notif-time">{formatTimeAgo(notif.created_at, t)}</div>
              </div>
              {!notif.is_read && <span className="unread-dot" />}
              <button
                className="notif-delete"
                onClick={(e) => handleDelete(notif.id, e)}
                title={t('delete')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .notifications-page { max-width: 720px; margin: 0 auto; }
        .notifications-toolbar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
        }
        .filter-tabs { display: flex; gap: 8px; }
        .filter-tabs button {
          padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border);
          background: var(--bg-card); cursor: pointer; font-size: 13px;
          color: var(--text-secondary);
        }
        .filter-tabs button.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white; border-color: transparent;
        }
        .mark-all-btn {
          padding: 8px 16px; border-radius: 10px; border: none; cursor: pointer;
          background: var(--bg-main); color: #667eea; font-size: 13px; font-weight: 500;
        }
        .notifications-empty {
          text-align: center; padding: 60px 20px;
          background: var(--bg-card); border-radius: 16px;
          border: 1px solid var(--border);
        }
        .empty-icon { font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.5; }
        .notifications-list {
          background: var(--bg-card); border-radius: 16px;
          border: 1px solid var(--border); overflow: hidden;
        }
        .notification-row {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px 20px; cursor: pointer; border-bottom: 1px solid var(--border);
          transition: background 0.2s; position: relative;
        }
        .notification-row:last-child { border-bottom: none; }
        .notification-row:hover { background: var(--bg-main); }
        .notification-row.unread { background: rgba(102,126,234,0.04); }
        .notif-icon { font-size: 22px; flex-shrink: 0; }
        .notif-content { flex: 1; min-width: 0; }
        .notif-title { font-weight: 600; font-size: 14px; color: var(--text-primary); }
        .notif-message { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
        .notif-time { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
        .unread-dot {
          width: 8px; height: 8px; background: #667eea; border-radius: 50%;
          flex-shrink: 0; margin-top: 6px;
        }
        .notif-delete {
          background: none; border: none; color: var(--text-muted);
          cursor: pointer; padding: 4px 8px; font-size: 14px; opacity: 0;
          transition: opacity 0.2s;
        }
        .notification-row:hover .notif-delete { opacity: 1; }
        .notif-delete:hover { color: #ef4444; }
      `}</style>
    </div>
  );
};

export default Notifications;
