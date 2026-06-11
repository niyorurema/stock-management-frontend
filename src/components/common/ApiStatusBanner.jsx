import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_BASE } from '../../config/api';

export default function ApiStatusBanner() {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const r = await fetch(`${API_BASE}/test`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!cancelled) setOffline(!r.ok);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };

    check();
    const id = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      style={{
        background: '#fef3c7',
        color: '#92400e',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: 14,
        borderBottom: '1px solid #fcd34d',
        zIndex: 9999,
      }}
    >
      {t('api_offline_banner')}
    </div>
  );
}
