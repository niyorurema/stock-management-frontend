import React, { useState, useEffect } from 'react';
import { profileService, authService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { notify } from '../services/notificationService';
import Loader from '../components/common/Loader';

const Profile = () => {
  const { t } = useLanguage();
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username || '',
        email: user.email || '',
        full_name: user.full_name || '',
        phone: user.phone || '',
      });
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await profileService.get();
      if (res.data?.success) {
        const data = res.data.data;
        setProfile(data);
        setForm({
          username: data.username || '',
          email: data.email || '',
          full_name: data.full_name || '',
          phone: data.phone || '',
        });
      } else {
        notify.error(res.data?.message || t('profile_load_error'));
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('profile_load_error');
      notify.error(msg);
      if (user && !profile) {
        setProfile({
          ...user,
          roles: user.roles || [],
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileService.update(form);
      if (res.data?.success) {
        setProfile(res.data.data);
        updateUser(res.data.data);
        notify.success(t('profile_save_success'));
      }
    } catch (err) {
      notify.error(err.response?.data?.message || t('profile_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      notify.error(t('password_mismatch'));
      return;
    }
    if (passwordForm.new_password.length < 6) {
      notify.error(t('password_min_length'));
      return;
    }
    setChangingPassword(true);
    try {
      const res = await authService.changePassword(passwordForm);
      if (res.data?.success) {
        notify.success(t('password_change_success'));
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (err) {
      notify.error(err.response?.data?.message || t('password_change_error'));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <Loader text={t('loading')} />;
  }

  const displayUser = profile || user;
  const initials = (displayUser?.full_name || displayUser?.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-header-card">
        <div className="profile-avatar-large">{initials}</div>
        <div className="profile-header-info">
          <h2>{displayUser?.full_name || displayUser?.username}</h2>
          <p className="profile-email">{displayUser?.email}</p>
          {profile?.roles?.length > 0 && (
            <div className="profile-roles">
              {profile.roles.map((role) => (
                <span key={role} className="role-badge">{role}</span>
              ))}
            </div>
          )}
          {profile?.last_login && (
            <p className="profile-meta">
              {t('last_login')}: {new Date(profile.last_login).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="profile-grid">
        <form className="profile-card" onSubmit={handleSubmit}>
          <h3>{t('profile_personal_info')}</h3>
          <div className="form-group">
            <label>{t('full_name')}</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>{t('username')}</label>
            <input name="username" value={form.username} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>{t('email')}</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>{t('phone')}</label>
            <input name="phone" value={form.phone} onChange={handleChange} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </form>

        <form className="profile-card" onSubmit={handlePasswordSubmit}>
          <h3>{t('change_password')}</h3>
          <div className="form-group">
            <label>{t('current_password')}</label>
            <input
              type="password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('new_password')}</label>
            <input
              type="password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label>{t('confirm_password')}</label>
            <input
              type="password"
              name="confirm_password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-secondary" disabled={changingPassword}>
            {changingPassword ? t('saving') : t('change_password')}
          </button>
        </form>
      </div>

      <style>{`
        .profile-page { max-width: 960px; margin: 0 auto; }
        .profile-header-card {
          display: flex; align-items: center; gap: 24px;
          padding: 28px; background: var(--bg-card, #fff);
          border-radius: 16px; border: 1px solid var(--border, #e2e8f0);
          margin-bottom: 24px;
        }
        .profile-avatar-large {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; font-weight: bold; color: white; flex-shrink: 0;
        }
        .profile-header-info h2 { margin: 0 0 4px; font-size: 22px; color: var(--text-primary); }
        .profile-email { color: var(--text-secondary); margin: 0 0 8px; font-size: 14px; }
        .profile-roles { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .role-badge {
          background: rgba(102,126,234,0.15); color: #667eea;
          padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
        }
        .profile-meta { font-size: 12px; color: var(--text-muted); margin: 0; }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) { .profile-grid { grid-template-columns: 1fr; } }
        .profile-card {
          background: var(--bg-card, #fff); border-radius: 16px;
          border: 1px solid var(--border, #e2e8f0); padding: 24px;
        }
        .profile-card h3 { margin: 0 0 20px; font-size: 16px; color: var(--text-primary); }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; margin-bottom: 6px; color: var(--text-secondary); }
        .form-group input {
          width: 100%; padding: 10px 14px; border-radius: 10px;
          border: 1px solid var(--border, #e2e8f0); background: var(--bg-main, #f8fafc);
          color: var(--text-primary); font-size: 14px; box-sizing: border-box;
        }
        .btn-primary, .btn-secondary {
          padding: 10px 20px; border-radius: 10px; border: none; cursor: pointer;
          font-size: 14px; font-weight: 500; margin-top: 8px;
        }
        .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .btn-secondary { background: var(--bg-main); color: var(--text-primary); border: 1px solid var(--border); }
        .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default Profile;
