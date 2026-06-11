// src/components/layout/Header.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAction } from "../../contexts/ActionContext";
import { useSettings } from "../../contexts/SettingsContext";
import { notificationService } from "../../services/apiService";

const TOOLBAR_ACTIONS = [
  { id: "add", icon: "➕", labelKey: "add_item" },
  { id: "export", icon: "📥", labelKey: "export_data" },
  { id: "print", icon: "🖨️", labelKey: "print" },
  { id: "filter", icon: "🔽", labelKey: "filter_results" },
];

const REFRESH_ACTION = { id: "refresh", icon: "🔄", labelKey: "refresh_data" };

function Header({ activePage, onToggleSidebar, onNavigate }) {
  const { triggerAction, hasAction } = useAction();
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { companyName } = useSettings();
  const [actionLoading, setActionLoading] = useState(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const userRef = useRef(null);
  const notifRef = useRef(null);

  const handleActionClick = async (action) => {
    if (action !== "refresh" && !hasAction(action)) return;
    setActionLoading(action);
    if (hasAction(action)) {
      triggerAction(action);
    } else if (action === "refresh") {
      window.location.reload();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    setActionLoading(null);
  };

  const visibleToolbarActions = [
    ...TOOLBAR_ACTIONS.filter((a) => hasAction(a.id)),
    REFRESH_ACTION,
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pageTitles = {
    dashboard: t("dashboard"),
    products: t("products"),
    categories: t("categories"),
    stock: t("stock"),
    invoices: t("invoices"),
    customers: t("customers"),
    suppliers: t("suppliers"),
    "purchase-orders": t("purchase_orders"),
    reservations: t("reservations"),
    "sales-dashboard": t("sales_dashboard"),
    reports: t("reports"),
    users: t("users"),
    roles: t("roles"),
    warehouses: t("warehouses"),
    settings: t("settings"),
    profile: t("my_profile"),
    notifications: t("notifications"),
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 1) return t("just_now");
    if (diff < 60) return t("minutes_ago").replace("{minutes}", diff);
    if (diff < 120) return t("hour_ago");
    return t("hours_ago").replace("{hours}", Math.floor(diff / 60));
  };

  const linkToPage = (link) => {
    if (!link) return null;
    const path = link.startsWith("/") ? link.slice(1) : link;
    const map = {
      stock: "stock",
      invoices: "invoices",
      products: "products",
      "purchase-orders": "purchase-orders",
      reservations: "reservations",
      reports: "reports",
      settings: "settings",
    };
    return map[path] || path;
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      if (res.data?.success) {
        setUnreadCount(res.data.data.count);
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res = await notificationService.getAll({ limit: 8 });
      if (res.data?.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.data.filter((n) => !n.is_read).length);
      }
    } catch (e) {
      /* ignore */
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (notifDropdownOpen) {
      fetchNotifications();
    }
  }, [notifDropdownOpen, fetchNotifications]);

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await notificationService.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e) {
        /* ignore */
      }
    }
    setNotifDropdownOpen(false);
    const page = linkToPage(notif.link);
    if (page && onNavigate) onNavigate(page);
  };

  const handleNavigate = (page) => {
    setUserDropdownOpen(false);
    setNotifDropdownOpen(false);
    if (onNavigate) onNavigate(page);
  };

  const handleBreadcrumbClick = (page) => {
    if (page !== activePage && onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <header className="app-header">
      {/* Partie 1: Header principal */}
      <div className="header-top">
        <div className="header-left">
          <Tippy content={t("main_menu")} placement="bottom" animation="scale">
            <button className="menu-toggle" onClick={onToggleSidebar}>
              ☰
            </button>
          </Tippy>

          {/* Nom de l'entreprise - visible sur desktop */}
          <div className="header-company desktop-only">
            <span className="company-icon">🏢</span>
            <span className="company-name">
              {companyName || "StockManager Pro"}
            </span>
          </div>
        </div>

        <div className="header-right">
          {/* Notifications */}
          <Tippy
            content={t("notifications")}
            placement="bottom"
            animation="scale"
          >
            <div className="notification-wrapper" ref={notifRef}>
              <button
                className="notification-btn"
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>
              {notifDropdownOpen && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    {t("notifications")}
                    {unreadCount > 0 && (
                      <span className="notification-header-count">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {loadingNotifs ? (
                    <div className="notification-loading">{t("loading")}</div>
                  ) : notifications.length === 0 ? (
                    <div className="notification-empty">
                      {t("no_notifications")}
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="notification-item"
                        onClick={() => handleNotifClick(notif)}
                      >
                        <span className="notification-icon">{notif.icon}</span>
                        <div className="notification-text">
                          <div className="notification-title">
                            {notif.title}
                          </div>
                          <div className="notification-desc">
                            {notif.message}
                          </div>
                          <div className="notification-time">
                            {formatTimeAgo(notif.created_at)}
                          </div>
                        </div>
                        {!notif.is_read && (
                          <span className="notification-unread"></span>
                        )}
                      </div>
                    ))
                  )}
                  <div
                    className="notification-view-all"
                    onClick={() => handleNavigate("notifications")}
                  >
                    {t("view_all")}
                  </div>
                </div>
              )}
            </div>
          </Tippy>

          {/* User Menu */}
          <Tippy content={t("my_account")} placement="bottom" animation="scale">
            <div className="user-menu" ref={userRef}>
              <div
                className="user-avatar"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              >
                <div className="avatar-img">
                  {user?.full_name?.charAt(0) ||
                    user?.username?.charAt(0) ||
                    "U"}
                </div>
                <span className="user-name desktop-only">
                  {user?.full_name || user?.username}
                </span>
              </div>
              {userDropdownOpen && (
                <div className="dropdown">
                  <div
                    className="dropdown-item"
                    onClick={() => handleNavigate("profile")}
                  >
                    <span>👤</span> {t("my_profile")}
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => handleNavigate("settings")}
                  >
                    <span>⚙️</span> {t("settings")}
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item language-select">
                    <span>🌐</span>
                    <select
                      value={language}
                      onChange={(e) => changeLanguage(e.target.value)}
                      className="language-dropdown-select"
                    >
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="bi">🇧🇮 Kirundi</option>
                    </select>
                  </div>
                  <div className="dropdown-item" onClick={toggleTheme}>
                    <span>{theme === "light" ? "🌙" : "☀️"}</span>
                    {theme === "light" ? t("dark_mode") : t("light_mode")}
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item" onClick={logout}>
                    <span>🚪</span> {t("logout")}
                  </div>
                </div>
              )}
            </div>
          </Tippy>
        </div>
      </div>

      {/* Partie 2: Toolbar avec séparation subtile */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="breadcrumb">
            <button
              className="breadcrumb-link"
              onClick={() => handleBreadcrumbClick("dashboard")}
            >
              {t("dashboard")}
            </button>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-current">
              {pageTitles[activePage] || activePage}
            </span>
          </div>
        </div>

        <div className="toolbar-center">
          <h1 className="page-title">{pageTitles[activePage] || activePage}</h1>
        </div>

        <div className="toolbar-actions">
          {visibleToolbarActions.map((action) => (
            <Tippy
              key={action.id}
              content={t(action.labelKey)}
              placement="bottom"
              animation="scale"
            >
              <button
                className="action-icon"
                onClick={() => handleActionClick(action.id)}
                disabled={actionLoading === action.id}
              >
                {actionLoading === action.id ? (
                  <span className="action-spinner"></span>
                ) : (
                  action.icon
                )}
              </button>
            </Tippy>
          ))}
        </div>
      </div>

      <style jsx="true">{`
        /* ============================================
           HEADER PRINCIPAL
        ============================================ */
        .app-header {
          flex-shrink: 0;
          background: var(--bg-header, #ffffff);
          z-index: 100;
        }

        /* Header top */
        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2px 24px;
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Menu toggle */
        .menu-toggle {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-primary, #1e293b);
          padding: 8px;
          border-radius: 10px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .menu-toggle:hover {
          background: var(--bg-main, #f1f5f9);
        }

        /* Company name */
        .header-company {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          background: var(--bg-main, #f1f5f9);
          border-radius: 30px;
        }

        .company-icon {
          font-size: 16px;
          opacity: 0.7;
        }

        .company-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
        }

        /* ============================================
           TOOLBAR - SÉPARATION SUBTILE
        ============================================ */
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2px 24px;
          background: var(--bg-header, #ffffff);
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          flex-wrap: wrap;
          gap: 12px;
        }

        [data-theme="dark"] .toolbar {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }

        .toolbar-center {
          flex: 1;
          text-align: center;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: flex-end;
        }

        /* Breadcrumb */
        .breadcrumb {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .breadcrumb-link {
          background: none;
          border: none;
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          font-size: 13px;
          padding: 0;
          transition: color 0.2s;
          font-family: inherit;
        }

        .breadcrumb-link:hover {
          color: #667eea;
        }

        .breadcrumb-separator {
          color: var(--text-secondary, #64748b);
          font-size: 13px;
        }

        .breadcrumb-current {
          color: var(--text-primary, #1e293b);
          font-weight: 500;
          font-size: 13px;
        }

        /* Page title */
        .page-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0;
          padding: 4px 0;
        }

        /* Action buttons */
        .action-icon {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid var(--border, #e2e8f0);
          background: var(--bg-card, white);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary, #1e293b);
        }

        .action-icon:hover:not(:disabled) {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-color: transparent;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .action-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-top: 2px solid #667eea;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ============================================
           NOTIFICATIONS
        ============================================ */
        .notification-wrapper {
          position: relative;
        }

        .notification-btn {
          position: relative;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
          color: var(--text-primary, #1e293b);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .notification-btn:hover {
          background: var(--bg-main, #f1f5f9);
        }

        .notification-badge {
          position: absolute;
          top: 0;
          right: 0;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 20px;
          min-width: 18px;
          text-align: center;
        }

        .notification-dropdown {
          position: absolute;
          top: 45px;
          right: 0;
          width: 340px;
          background: var(--bg-card, white);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border, #e2e8f0);
          z-index: 100;
        }

        .notification-header {
          padding: 16px;
          border-bottom: 1px solid var(--border, #e2e8f0);
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .notification-header-count {
          background: #ef4444;
          color: white;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .notification-loading,
        .notification-empty {
          padding: 24px 16px;
          text-align: center;
          font-size: 13px;
          color: var(--text-secondary, #64748b);
        }

        .notification-item {
          padding: 12px 16px;
          display: flex;
          gap: 12px;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }

        .notification-item:hover {
          background: var(--bg-main, #f1f5f9);
        }

        .notification-icon {
          font-size: 20px;
        }

        .notification-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
        }

        .notification-desc {
          font-size: 11px;
          color: var(--text-secondary, #64748b);
          margin-top: 2px;
        }

        .notification-time {
          font-size: 10px;
          color: var(--text-muted, #94a3b8);
          margin-top: 4px;
        }

        .notification-unread {
          width: 8px;
          height: 8px;
          background: #667eea;
          border-radius: 50%;
          margin-left: 8px;
          flex-shrink: 0;
        }

        .notification-view-all {
          padding: 12px;
          text-align: center;
          color: #667eea;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }

        /* ============================================
           USER MENU
        ============================================ */
        .user-menu {
          position: relative;
          cursor: pointer;
        }

        .user-avatar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 12px;
          border-radius: 40px;
          transition: background 0.2s;
        }

        .user-avatar:hover {
          background: var(--bg-main, #f1f5f9);
        }

        .avatar-img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          color: white;
        }

        .user-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
        }

        .dropdown {
          position: absolute;
          top: 48px;
          right: 0;
          background: var(--bg-card, white);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          min-width: 200px;
          overflow: hidden;
          z-index: 100;
          border: 1px solid var(--border, #e2e8f0);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
          color: var(--text-primary, #1e293b);
          font-size: 13px;
        }

        .dropdown-item:hover {
          background: var(--bg-main, #f1f5f9);
        }

        .dropdown-item.language-select {
          padding: 8px 12px;
        }

        .language-dropdown-select {
          background: transparent;
          border: none;
          color: var(--text-primary, #1e293b);
          font-size: 13px;
          cursor: pointer;
          flex: 1;
          font-family: inherit;
        }

        .language-dropdown-select:focus {
          outline: none;
        }

        .language-dropdown-select option {
          background: var(--bg-card, white);
          color: var(--text-primary, #1e293b);
        }

        .dropdown-divider {
          height: 1px;
          background: var(--border, #e2e8f0);
          margin: 4px 0;
        }

        /* ============================================
           CLASSES UTILITAIRES
        ============================================ */
        .desktop-only {
          display: flex;
        }

        /* ============================================
           RESPONSIVE MOBILE
        ============================================ */
        @media (max-width: 768px) {
          .header-top {
            padding: 10px 16px;
          }

          .desktop-only {
            display: none !important;
          }

          .header-left {
            flex: none;
          }

          .toolbar {
            padding: 12px 16px;
            flex-direction: column;
            align-items: stretch;
          }

          .toolbar-left,
          .toolbar-center,
          .toolbar-actions {
            width: 100%;
            justify-content: center;
          }

          .toolbar-center {
            order: -1;
            margin-bottom: 8px;
          }

          .toolbar-left {
            order: 1;
          }

          .toolbar-actions {
            order: 2;
            gap: 12px;
          }

          .action-icon {
            width: 42px;
            height: 42px;
          }

          .breadcrumb {
            justify-content: center;
          }

          .page-title {
            font-size: 18px;
            text-align: center;
          }

          .notification-dropdown {
            position: fixed;
            top: 60px;
            right: 16px;
            left: 16px;
            width: auto;
          }

          .dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            border-radius: 20px 20px 0 0;
            animation: slideUp 0.3s ease;
          }

          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        }

        /* ============================================
           TABLETTE
        ============================================ */
        @media (min-width: 769px) and (max-width: 1024px) {
          .header-company {
            max-width: 200px;
          }

          .company-name {
            font-size: 12px;
          }

          .page-title {
            font-size: 18px;
          }
        }
      `}</style>
    </header>
  );
}

export default Header;
