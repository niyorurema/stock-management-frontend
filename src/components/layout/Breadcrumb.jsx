import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

function Breadcrumb({ activePage, onNavigate }) {
  const { t } = useLanguage();

  const breadcrumbItems = {
    dashboard: { label: t('dashboard'), path: '/dashboard' },
    products: { label: t('products'), path: '/products' },
    stock: { label: t('stock'), path: '/stock' },
    invoices: { label: t('invoices'), path: '/invoices' },
    warehouses: { label: t('warehouses'), path: '/warehouses' },
    reports: { label: t('reports'), path: '/reports' },
    users: { label: t('users'), path: '/users' },
    settings: { label: t('settings'), path: '/settings' }
  };

  const currentItem = breadcrumbItems[activePage];
  const parentItem = null; // Pour les sous-pages si nécessaire

  return (
    <div className="breadcrumb">
      <button 
        className="breadcrumb-link" 
        onClick={() => onNavigate('dashboard')}
      >
        {t('dashboard')}
      </button>
      <span className="breadcrumb-separator">›</span>
      <span className="breadcrumb-current">
        {currentItem?.label || activePage}
      </span>
    </div>
  );
}

export default Breadcrumb;