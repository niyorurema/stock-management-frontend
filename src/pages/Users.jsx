// frontend/src/pages/Users.jsx
import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import { userService, getApiErrorMessage } from "../services/apiService";
import { confirm } from "../services/notificationService";
import { useLanguage } from "../contexts/LanguageContext";
import { useAction } from "../contexts/ActionContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";

const Users = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const { user: currentUser } = useAuth();
  const isDark = theme === "dark";

  // ========== ÉTATS ==========
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    role: "",
    status: "",
  });

  // États pour les loaders
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [resetLoading, setResetLoading] = useState(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    full_name: "",
    phone: "",
    role_id: "",
    is_active: true,
  });

  // ========== CHARGEMENT DES DONNÉES ==========
  const loadUsers = async (params = {}) => {
    setLoading(true);
    try {
      const cleanParams = {};
      if (params.search && params.search.trim() !== "")
        cleanParams.search = params.search.trim();
      if (params.role && params.role !== "") cleanParams.role = params.role;
      if (params.status && params.status !== "")
        cleanParams.status = params.status;

      const response = await userService.getAll(cleanParams);
      setUsers(response.data?.data || []);
      setAppliedFilters(cleanParams);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("error_loading_users")));
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await userService.getRoles();
      setRoles(response.data?.data || []);
    } catch (error) {
      console.error("Erreur chargement rôles:", error);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await userService.getPermissions();
      setPermissions(response.data?.data || []);
    } catch (error) {
      console.error("Erreur chargement permissions:", error);
    }
  };

  // ========== FONCTIONS DE FILTRAGE ==========
  const applyFilters = () => {
    const params = {};
    if (filters.search && filters.search.trim() !== "")
      params.search = filters.search.trim();
    if (filters.role && filters.role !== "") params.role = filters.role;
    if (filters.status && filters.status !== "") params.status = filters.status;

    loadUsers(params);
    setFilterModalOpen(false);
    toast.success(t("filters_applied"));
  };

  const resetFilters = () => {
    setFilters({ search: "", role: "", status: "" });
    setAppliedFilters({ search: "", role: "", status: "" });
    loadUsers();
    setFilterModalOpen(false);
    toast.success(t("filters_reset"));
  };

  const refreshUsers = () => {
    setFilters({ search: "", role: "", status: "" });
    setAppliedFilters({ search: "", role: "", status: "" });
    loadUsers();
    toast.success(t("refresh_success"));
  };

  const hasActiveFilters = () => {
    return !!(
      appliedFilters.search ||
      appliedFilters.role ||
      appliedFilters.status
    );
  };

  // ========== CRUD UTILISATEURS ==========
  const buildUserPayload = () => ({
    username: formData.username.trim(),
    email: formData.email.trim(),
    full_name: formData.full_name.trim(),
    phone: formData.phone?.trim() || "",
    role_id: formData.role_id ? parseInt(formData.role_id, 10) : null,
    is_active: formData.is_active === true || formData.is_active === "true",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.full_name) {
      toast.warning(t("fields_required"));
      return;
    }

    if (!formData.role_id) {
      toast.warning(t("role_required"));
      return;
    }

    const confirmed = await confirm.save(
      editingUser ? t("save_changes") : t("create_user"),
    );
    if (!confirmed) return;

    setSubmitLoading(true);
    const payload = buildUserPayload();

    try {
      if (editingUser) {
        await userService.update(editingUser.id, payload);
        toast.success(t("user_updated"));
      } else {
        const response = await userService.create(payload);
        const tempPassword = response.data?.data?.temporary_password;
        if (tempPassword) {
          toast.success(
            `${t("user_created")} - Mot de passe temporaire: ${tempPassword}`,
            {
              duration: 8000,
            },
          );
        } else {
          toast.success(t("user_created"));
        }
      }
      loadUsers(appliedFilters);
      closeModal();
    } catch (error) {
      toast.error(
        editingUser ? t("error_updating_user") : t("error_creating_user"),
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      toast.warning(t("cannot_delete_self"));
      return;
    }

    const confirmed = await confirm.delete(
      `${t("confirm_delete_user")} "${user.full_name}"`,
    );
    if (!confirmed) return;

    setDeleteLoading(user.id);

    try {
      await userService.delete(user.id);
      toast.success(t("user_deleted"));
      loadUsers(appliedFilters);
    } catch (error) {
      toast.error(t("error_deleting_user"));
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleResetPassword = async (user) => {
    const confirmed = await confirm.save(t("reset_password_confirm"));
    if (!confirmed) return;

    setResetLoading(user.id);

    try {
      const response = await userService.resetPassword(user.id);
      const tempPassword = response.data?.data?.temporary_password;
      if (tempPassword) {
        toast.success(
          `${t("password_reset_success")} - Nouveau mot de passe: ${tempPassword}`,
          {
            duration: 8000,
          },
        );
      } else {
        toast.success(t("password_reset_success"));
      }
    } catch (error) {
      toast.error(t("password_reset_error"));
    } finally {
      setResetLoading(null);
    }
  };

  const parseIsActive = (value) =>
    value === 1 || value === true || value === "1" || value === "true";

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || "",
        role_id: user.role_id != null ? String(user.role_id) : "",
        is_active: parseIsActive(user.is_active),
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        email: "",
        full_name: "",
        phone: "",
        role_id: "",
        is_active: true,
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleModalClick = (e) => e.stopPropagation();

  // ========== EXPORT CSV ==========
  const exportUsersToCSV = async () => {
    toast(t("export_preparing"));
    try {
      const response = await userService.getAll();
      const allUsers = response.data?.data || [];

      if (allUsers.length === 0) {
        toast.error(t("export_no_data"));
        return;
      }

      const headers = [
        t("export_header_username"),
        t("export_header_email"),
        t("export_header_fullname"),
        t("export_header_role"),
        t("export_header_status"),
      ];
      const rows = allUsers.map((u) => [
        u.username || "",
        u.email || "",
        u.full_name || "",
        u.role_name || "-",
        u.is_active ? t("active") : t("inactive"),
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute(
        "download",
        `${t("export_filename_users")}_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        t("export_success_users").replace("{count}", allUsers.length),
      );
    } catch (error) {
      toast.error(t("export_error"));
    }
  };

  // ========== IMPRESSION ==========
  const printUsers = async () => {
    toast(t("print_preparing"));
    try {
      const response = await userService.getAll();
      const allUsers = response.data?.data || [];

      if (allUsers.length === 0) {
        toast.error(t("print_no_data"));
        return;
      }

      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>${t("print_title_users")}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: ${isDark ? "#12121a" : "#f8fafc"}; }
              h1 { color: #667eea; text-align: center; }
              .date { text-align: center; color: #666; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h1>${t("print_header_users")}</h1>
            <div class="date">${t("print_generated_on")} ${new Date().toLocaleString()}</div>
            <table>
              <thead><tr><th>${t("print_header_username")}</th><th>${t("print_header_email")}</th><th>${t("print_header_fullname")}</th><th>${t("print_header_role")}</th><th>${t("print_header_status")}</th></tr></thead>
              <tbody>
                ${allUsers
                  .map(
                    (u) => `
                  <tr>
                    <td>${u.username || ""}</td>
                    <td>${u.email || ""}</td>
                    <td>${u.full_name || ""}</td>
                    <td>${u.role_name || "-"}</td>
                    <td>${u.is_active ? t("active") : t("inactive")}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="footer">${t("print_footer")}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      toast.error(t("print_error"));
    }
  };

  // ========== RENDU DES RÔLES POUR SELECT ==========
  const renderRoleOptions = () => {
    return roles.map((role) => (
      <option key={role.id} value={role.id}>
        {role.role_name}
      </option>
    ));
  };

  // ========== ENREGISTREMENT DES ACTIONS ==========
  useEffect(() => {
    if (
      currentUser?.roles?.includes("super_admin") ||
      (currentUser?.permissions || []).includes("users.create")
    ) {
      registerAction("add", () => openModal());
    }
    registerAction("export", () => exportUsersToCSV());
    registerAction("print", () => printUsers());
    registerAction("filter", () => setFilterModalOpen(true));
    registerAction("refresh", () => refreshUsers());

    return () => {
      unregisterAction("add");
      unregisterAction("export");
      unregisterAction("print");
      unregisterAction("filter");
      unregisterAction("refresh");
    };
  }, []);

  // ========== CHARGEMENT INITIAL ==========
  useEffect(() => {
    loadUsers();
    loadRoles();
    loadPermissions();
  }, []);

  // ========== COLONNES ==========
  const tableColumns = [
    { key: "username", label: t("username") },
    { key: "email", label: t("email") },
    { key: "full_name", label: t("full_name") },
    { key: "role", label: t("role") },
    { key: "status", label: t("status") },
    { key: "last_login", label: t("last_login") },
    { key: "actions", label: t("actions") },
  ];

  if (loading) return <Loader />;

  return (
    <div className={`users-page ${isDark ? "dark" : "light"}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#1e293b",
          },
        }}
      />

      <div className="page-header">
        <div>
          <h2>{t("users")}</h2>
          <p>{t("users_desc")}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">
            👥 {t("total_users")}: {users.length}
            {hasActiveFilters() && (
              <span className="filter-badge"> 🔍 {t("active_filters")}</span>
            )}
          </span>
        </div>
      </div>

      {hasActiveFilters() && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">{t("active_filters_label")}:</span>
          {appliedFilters.search && (
            <span className="filter-tag">
              {t("search")}: {appliedFilters.search}
            </span>
          )}
          {appliedFilters.role && (
            <span className="filter-tag">
              {t("role")}:{" "}
              {roles.find((r) => r.id == appliedFilters.role)?.role_name ||
                appliedFilters.role}
            </span>
          )}
          {appliedFilters.status && (
            <span className="filter-tag">
              {t("status")}:{" "}
              {appliedFilters.status === "active" ? t("active") : t("inactive")}
            </span>
          )}
          <button className="clear-filters-btn" onClick={resetFilters}>
            ✕ {t("clear_filters")}
          </button>
        </div>
      )}

      <div className="page-content">
        {users.length === 0 && !hasActiveFilters() ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_users")}</p>
            <Tippy
              content={t("add_first_user")}
              placement="bottom"
              animation="scale"
            >
              <button className="btn-primary" onClick={() => openModal()}>
                ➕ {t("add_first_user")}
              </button>
            </Tippy>
          </div>
        ) : users.length === 0 && hasActiveFilters() ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_users_match_filters")}</p>
            <button className="btn-secondary" onClick={resetFilters}>
              {t("reset_filters")}
            </button>
          </div>
        ) : (
          <div className={`table-responsive ${isDark ? "dark" : "light"}`}>
            <table className="data-table">
              <thead>
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="user-username">{user.username}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <strong>{user.full_name}</strong>
                    </td>
                    <td>
                      <span className="role-badge">
                        {user.role_name || "-"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${parseIsActive(user.is_active) ? "active" : "inactive"}`}
                      >
                        {parseIsActive(user.is_active)
                          ? t("active")
                          : t("inactive")}
                      </span>
                    </td>
                    <td>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <Tippy
                          content={t("view_details")}
                          placement="top"
                          animation="scale"
                        >
                          <button
                            className="btn-icon view"
                            onClick={() => {
                              setSelectedUser(user);
                              setDetailModalOpen(true);
                            }}
                          >
                            👁️
                          </button>
                        </Tippy>
                        <Tippy
                          content={t("edit")}
                          placement="top"
                          animation="scale"
                        >
                          <button
                            className="btn-icon edit"
                            onClick={() => openModal(user)}
                          >
                            ✏️
                          </button>
                        </Tippy>
                        <Tippy
                          content={t("reset_password")}
                          placement="top"
                          animation="scale"
                        >
                          <button
                            className="btn-icon reset"
                            onClick={() => handleResetPassword(user)}
                            disabled={resetLoading === user.id}
                          >
                            {resetLoading === user.id ? (
                              <span className="btn-spinner"></span>
                            ) : (
                              "🔑"
                            )}
                          </button>
                        </Tippy>
                        {user.id !== currentUser?.id && (
                          <Tippy
                            content={t("delete")}
                            placement="top"
                            animation="scale"
                          >
                            <button
                              className="btn-icon delete"
                              onClick={() => handleDelete(user)}
                              disabled={deleteLoading === user.id}
                            >
                              {deleteLoading === user.id ? (
                                <span className="btn-spinner"></span>
                              ) : (
                                "🗑️"
                              )}
                            </button>
                          </Tippy>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL UTILISATEUR (CRUD) */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <h3>{editingUser ? t("edit_user") : t("new_user")}</h3>
              <Tippy content={t("close")} placement="left" animation="scale">
                <button className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </Tippy>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required">{t("username")} </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      required
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="required">{t("email")} </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="required">{t("full_name")} </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      required
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("phone")}</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("role")}</label>
                    <select
                      value={formData.role_id}
                      onChange={(e) =>
                        setFormData({ ...formData, role_id: e.target.value })
                      }
                      disabled={submitLoading}
                      required
                    >
                      <option value="">{t("select_role")}</option>
                      {renderRoleOptions()}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t("status")}</label>
                    <select
                      value={formData.is_active ? "true" : "false"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.value === "true",
                        })
                      }
                      disabled={submitLoading}
                    >
                      <option value="true">{t("active")}</option>
                      <option value="false">{t("inactive")}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={submitLoading}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <span className="btn-spinner"></span>
                  ) : editingUser ? (
                    t("save")
                  ) : (
                    t("create")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS UTILISATEUR */}
      {detailModalOpen && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className={`modal-container-detail ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>👤 {t("user_details")}</h3>
              <Tippy content={t("close")} placement="left" animation="scale">
                <button
                  className="modal-close"
                  onClick={() => setDetailModalOpen(false)}
                >
                  ✕
                </button>
              </Tippy>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">{t("username")}:</span>
                  <span className="detail-value">{selectedUser.username}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("email")}:</span>
                  <span className="detail-value">{selectedUser.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("full_name")}:</span>
                  <span className="detail-value">{selectedUser.full_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("phone")}:</span>
                  <span className="detail-value">
                    {selectedUser.phone || "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("role")}:</span>
                  <span className="detail-value">
                    {selectedUser.role_name || "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("status")}:</span>
                  <span className="detail-value">
                    <span
                      className={`status-badge ${selectedUser.is_active ? "active" : "inactive"}`}
                    >
                      {selectedUser.is_active ? t("active") : t("inactive")}
                    </span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("last_login")}:</span>
                  <span className="detail-value">
                    {selectedUser.last_login
                      ? new Date(selectedUser.last_login).toLocaleString()
                      : "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("created_at")}:</span>
                  <span className="detail-value">
                    {new Date(selectedUser.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedUser.permissions &&
                selectedUser.permissions.length > 0 && (
                  <div className="permissions-section">
                    <h4>{t("permissions")}</h4>
                    <div className="permissions-list">
                      {selectedUser.permissions.map((perm, idx) => (
                        <span key={idx} className="permission-tag">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FILTRE */}
      {filterModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setFilterModalOpen(false)}
        >
          <div
            className={`modal-container-small ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🔍 {t("filter_users")}</h3>
              <button
                className="modal-close"
                onClick={() => setFilterModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("search")}</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  placeholder={t("search_placeholder")}
                />
              </div>
              <div className="form-group">
                <label>{t("role")}</label>
                <select
                  value={filters.role}
                  onChange={(e) =>
                    setFilters({ ...filters, role: e.target.value })
                  }
                >
                  <option value="">{t("all_roles")}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t("status")}</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">{t("all_status")}</option>
                  <option value="active">{t("active")}</option>
                  <option value="inactive">{t("inactive")}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetFilters}>
                {t("reset_filters")}
              </button>
              <button className="btn-primary" onClick={applyFilters}>
                {t("apply_filters")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .users-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .users-page.light {
          background: var(--bg-main);
        }
        
        .users-page.dark {
          background: var(--bg-main);
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .page-header h2 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--text-primary);
        }
        
        .page-header p {
          color: var(--text-secondary);
          font-size: 14px;
        }
        
        .stats-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 8px 20px;
          border-radius: 20px;
          color: white;
          font-size: 14px;
          font-weight: 500;
        }
        
        .filter-badge {
          background: rgba(255,255,255,0.3);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          margin-left: 8px;
        }
        
        .active-filters-info {
          background: rgba(102,126,234,0.1);
          padding: 10px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 13px;
          border-left: 4px solid #667eea;
        }
        
        .filter-icon { font-size: 14px; }
        .filter-label { font-weight: 600; color: var(--text-primary); }
        .filter-tag { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; }
        .clear-filters-btn { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 12px; margin-left: auto; padding: 4px 8px; border-radius: 6px; transition: all 0.2s; }
        .clear-filters-btn:hover { background: rgba(220,38,38,0.1); }
        
        .btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.4);
        }
        
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-secondary {
          padding: 10px 20px;
          background: var(--bg-card);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-main);
        }
        
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid white;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

         .required::after {
          content: " *";
          color: #dc2626;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .btn-icon {
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin: 0 4px;
          transition: all 0.2s;
          font-size: 14px;
        }
        
        .btn-icon.view { background: rgba(102,126,234,0.1); color: #667eea; }
        .btn-icon.edit { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .btn-icon.reset { background: rgba(245,158,11,0.1); color: #d97706; }
        .btn-icon.delete { background: rgba(239,68,68,0.1); color: #dc2626; }
        
        .btn-icon:hover:not(:disabled) { transform: scale(1.05); }
        .btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .action-buttons { display: flex; gap: 8px; justify-content: flex-start; }
        
        .table-responsive {
          overflow-x: auto;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        
        .data-table th {
          padding: 14px 16px;
          text-align: left;
          font-weight: 600;
          background: var(--bg-header);
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .data-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--text-primary);
        }
        
        .data-table tbody tr:hover {
          background: var(--bg-main);
        }
        
        .user-username {
          font-family: monospace;
          background: var(--bg-main);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-primary);
        }
        
        .role-badge {
          background: rgba(102,126,234,0.1);
          color: #667eea;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-badge {
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-badge.active {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }
        
        .status-badge.inactive {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        
        .empty-state {
          text-align: center;
          padding: 60px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .empty-state p {
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        .form-group {
          margin-bottom: 16px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .form-group input, 
        .form-group select, 
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 14px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .form-group input:focus, 
        .form-group select:focus, 
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .modal-container {
          background: var(--bg-card);
          border-radius: 20px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--border);
        }
        
        .modal-container-small {
          background: var(--bg-card);
          border-radius: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--border);
        }
        
        .modal-container-detail {
          background: var(--bg-card);
          border-radius: 20px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--border);
        }
        
        .modal-header {
          padding: 20px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 20px 20px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }
        
        .modal-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
        }
        
        .modal-close:hover {
          background: rgba(255,255,255,0.3);
          transform: rotate(90deg);
        }
        
        .modal-body {
          padding: 24px;
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          position: sticky;
          bottom: 0;
          background: var(--bg-card);
        }
        
        .detail-section {
          margin-bottom: 20px;
        }
        
        .detail-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
        
        .detail-label {
          width: 140px;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .detail-value {
          flex: 1;
          color: var(--text-secondary);
        }
        
        .permissions-section {
          margin-top: 16px;
        }
        
        .permissions-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 10px;
        }
        
        .permissions-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .permission-tag {
          background: rgba(102,126,234,0.1);
          color: #667eea;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }
        
        @media (max-width: 768px) {
          .users-page {
            padding: 16px;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }
          .stats-badge {
            text-align: center;
          }
          .modal-container, 
          .modal-container-small, 
          .modal-container-detail {
            width: 95%;
          }
          .detail-row {
            flex-direction: column;
          }
          .detail-label {
            width: 100%;
            margin-bottom: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default Users;
