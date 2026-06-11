import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { roleService, userService, getApiErrorMessage } from '../services/apiService';
import { usePermission } from '../hooks/usePermission';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import Can from '../components/common/Can';
import Loader from '../components/common/Loader';

const Roles = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { can } = usePermission();
  const isDark = theme === 'dark';

  const [roles, setRoles] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermIds, setSelectedPermIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const groupByModule = (perms) => {
    const g = {};
    perms.forEach((p) => {
      const m = p.module || 'general';
      if (!g[m]) g[m] = [];
      g[m].push(p);
    });
    return g;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permRes] = await Promise.all([
        roleService.getAll(),
        userService.getPermissions(),
      ]);
      setRoles(rolesRes.data?.data || []);
      const perms = permRes.data?.data || [];
      setGrouped(permRes.data?.grouped || groupByModule(perms));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('error_loading_roles')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (can('roles.view')) {
      load();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const openRole = async (role) => {
    setRoleLoading(true);
    try {
      const res = await roleService.getById(role.id);
      const data = res.data?.data;
      setSelectedRole(data);
      setSelectedPermIds(data.permission_ids || []);
    } catch (e) {
      toast.error(t('error_loading_role'));
    } finally {
      setRoleLoading(false);
    }
  };

  const togglePerm = (id) => {
    setSelectedPermIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleModule = (modulePerms, checked) => {
    const ids = modulePerms.map((p) => p.id);
    setSelectedPermIds((prev) => {
      if (checked) {
        return [...new Set([...prev, ...ids])];
      }
      return prev.filter((id) => !ids.includes(id));
    });
  };

  const savePermissions = async () => {
    if (!selectedRole || !can('roles.manage')) return;
    setSaving(true);
    try {
      await roleService.updatePermissions(selectedRole.id, selectedPermIds);
      toast.success(t('permissions_saved'));
      await load();
      await openRole({ id: selectedRole.id });
    } catch (e) {
      toast.error(e.response?.data?.message || t('error_saving_permissions'));
    } finally {
      setSaving(false);
    }
  };

  if (!can('roles.view')) {
    return (
      <div className={`roles-page ${isDark ? 'dark' : 'light'}`}>
        <div className="empty-state">
          <p>{t('access_denied_roles')}</p>
        </div>
      </div>
    );
  }

  if (loading) return <Loader />;

  return (
    <div className={`roles-page ${isDark ? 'dark' : 'light'}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#1e293b',
          },
        }}
      />

      <div className="page-header">
        <div>
          <h2>{t('roles')}</h2>
          <p>{t('roles_desc')}</p>
        </div>
        <div className="stats-badge">
          <span>🔐 {t('total_roles')}: {roles.length}</span>
        </div>
      </div>

      <div className="page-content">
        <div className="roles-layout">
          <div className={`roles-panel roles-list-panel ${isDark ? 'dark' : 'light'}`}>
            <h3 className="panel-title">{t('roles_list')}</h3>
            <ul className="roles-list">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`role-item ${selectedRole?.id === r.id ? 'active' : ''}`}
                    onClick={() => openRole(r)}
                  >
                    <span className="role-name">{r.role_name}</span>
                    <span className="role-meta">
                      {t('permissions_count').replace('{count}', r.permission_count ?? 0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={`roles-panel roles-editor-panel ${isDark ? 'dark' : 'light'}`}>
            <h3 className="panel-title">{t('roles_permissions_editor')}</h3>

            {roleLoading ? (
              <div className="panel-loader">
                <Loader />
              </div>
            ) : !selectedRole ? (
              <div className="empty-state inner">
                <span className="empty-icon">🔐</span>
                <p>{t('select_role_to_edit')}</p>
              </div>
            ) : (
              <>
                <div className="role-header">
                  <h4>{selectedRole.role_name}</h4>
                  {selectedRole.description && (
                    <p className="role-description">{selectedRole.description}</p>
                  )}
                </div>

                {selectedRole.role_name === 'super_admin' ? (
                  <div className="info-banner">{t('role_system_full_access')}</div>
                ) : (
                  <>
                    <p className="module-label">{t('module_permissions')}</p>
                    <div className="perm-modules">
                      {Object.entries(grouped).map(([module, perms]) => {
                        const allChecked = perms.every((p) => selectedPermIds.includes(p.id));
                        const someChecked = perms.some((p) => selectedPermIds.includes(p.id));
                        return (
                          <div key={module} className="perm-module">
                            <div className="perm-module-header">
                              <label className="module-toggle">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someChecked && !allChecked;
                                  }}
                                  onChange={(e) => toggleModule(perms, e.target.checked)}
                                  disabled={!can('roles.manage')}
                                />
                                <span className="module-name">{module}</span>
                              </label>
                            </div>
                            <div className="perm-checks">
                              {perms.map((p) => (
                                <label key={p.id} className="perm-check">
                                  <input
                                    type="checkbox"
                                    checked={selectedPermIds.includes(p.id)}
                                    onChange={() => togglePerm(p.id)}
                                    disabled={!can('roles.manage')}
                                  />
                                  <span title={p.description || ''}>{p.permission_name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Can permission="roles.manage">
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={savePermissions}
                          disabled={saving}
                        >
                          {saving ? t('saving_permissions') : `💾 ${t('save_role_permissions')}`}
                        </button>
                      </div>
                    </Can>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .roles-page {
          min-height: 100%;
          color: var(--text-primary);
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

        .roles-layout {
          display: grid;
          grid-template-columns: minmax(260px, 320px) 1fr;
          gap: 20px;
          align-items: start;
        }

        @media (max-width: 960px) {
          .roles-layout { grid-template-columns: 1fr; }
        }

        .roles-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .roles-page.dark .roles-panel {
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
        }

        .panel-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px;
          color: var(--text-primary);
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }

        .roles-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: calc(100vh - 280px);
          overflow-y: auto;
        }

        .role-item {
          width: 100%;
          text-align: left;
          padding: 12px 14px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: var(--bg-main);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .role-item:hover {
          border-color: rgba(102, 126, 234, 0.4);
        }

        .role-item.active {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.12));
          border-color: #667eea;
        }

        .role-name {
          font-weight: 600;
          color: var(--text-primary);
          text-transform: capitalize;
        }

        .role-meta {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .roles-editor-panel {
          min-height: 400px;
        }

        .panel-loader {
          display: flex;
          justify-content: center;
          padding: 48px;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-secondary);
        }

        .empty-state.inner {
          padding: 64px 24px;
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .role-header h4 {
          margin: 0 0 8px;
          font-size: 20px;
          text-transform: capitalize;
          color: var(--text-primary);
        }

        .role-description {
          margin: 0 0 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .info-banner {
          background: rgba(102, 126, 234, 0.12);
          border-left: 4px solid #667eea;
          padding: 12px 16px;
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .module-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 16px 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .perm-modules {
          max-height: calc(100vh - 380px);
          overflow-y: auto;
          padding-right: 8px;
        }

        .perm-module {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--bg-main);
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .perm-module-header {
          margin-bottom: 10px;
        }

        .module-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-primary);
        }

        .module-name {
          text-transform: capitalize;
        }

        .perm-checks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          padding-left: 4px;
        }

        .perm-check {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .perm-check input {
          accent-color: #667eea;
        }

        .form-actions {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .btn-primary {
          padding: 10px 24px;
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
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default Roles;
