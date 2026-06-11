import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { useAction } from '../../contexts/ActionContext';

function MainLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearAllActions } = useAction();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Récupérer la page active depuis l'URL
  const getActivePageFromPath = () => {
    const path = location.pathname.replace(/^\//, '');
    if (path === '' || path === 'dashboard') return 'dashboard';
    if (path === 'products') return 'products';
    if (path === 'stock') return 'stock';
    if (path === 'categories') return 'categories';
    if (path === 'invoices') return 'invoices';
    if (path === 'customers') return 'customers';
    if (path === 'suppliers') return 'suppliers';
    if (path === 'purchase-orders') return 'purchase-orders';
    if (path === 'reservations') return 'reservations';
    if (path === 'sales-dashboard') return 'sales-dashboard';
    if (path === 'reports') return 'reports';
    if (path === 'warehouses') return 'warehouses';
    if (path === 'users') return 'users';
    if (path === 'roles') return 'roles';
    if (path === 'settings') return 'settings';
    if (path === 'profile') return 'profile';
    if (path === 'notifications') return 'notifications';
    if (path.startsWith('products/')) return 'product-detail';
    return 'dashboard';
  };

  const [activePage, setActivePage] = useState(getActivePageFromPath());

  // Mettre à jour activePage quand l'URL change
  useEffect(() => {
    setActivePage(getActivePageFromPath());
  }, [location.pathname]);

  // Réinitialiser les actions avant que la nouvelle page enregistre les siennes
  useLayoutEffect(() => {
    clearAllActions();
  }, [location.pathname, clearAllActions]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  // Fonction pour naviguer et sauvegarder la route
  const handleSetActivePage = (page) => {
    setActivePage(page);
    let path = `/${page}`;
    if (page === 'dashboard') path = '/';
    navigate(path);
    // Sauvegarder dans localStorage
    localStorage.setItem('lastRoute', path);
  };

  return (
    <div className="app-layout">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed}
        activePage={activePage}
        setActivePage={handleSetActivePage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="main-wrapper">
        <Header 
          activePage={activePage} 
          onToggleSidebar={handleToggleSidebar}
          onNavigate={handleSetActivePage}
        />
        <main className="main-content">
          <div className="page-viewport">{children}</div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default MainLayout;