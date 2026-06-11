import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SettingsProvider } from './contexts/SettingsContext';
import Login from './pages/Login';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import SalesDashboard from './pages/SalesDashboard';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Loader from './components/common/Loader';
import './App.css';
import { Toaster } from 'react-hot-toast';
import { notify } from './services/notificationService';
import { ActionProvider } from './contexts/ActionContext';
import { authFetchJson } from './utils/authFetch';
import Categories from './pages/Categories';
import ProductDetail from './pages/ProductDetail';

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = chargement
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [error, setError] = useState('');

  useEffect(() => {
    // Vérifier la session au chargement
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsLoggedIn(true);
      } catch (e) {
        setIsLoggedIn(false);
      }
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const handleLogin = async (username, password) => {
    setError('');
    try {
      const { response, data } = await authFetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (response.ok && data.success) {
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        setUser(data.data.user);
        setIsLoggedIn(true);
        setError('');
      } else {
        setError(data.message || 'Erreur de connexion');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUser(null);
  };

  const renderPage = () => {
    switch(activePage) {
      case 'dashboard': return <Dashboard />;
      case 'products': return <Products />;
      case 'stock': return <Stock />;
      case 'categories': return <Categories />;
      case 'product-detail': return <ProductDetail />;
      case 'invoices': return <Invoices />;
      case 'customers': return <Customers />;
      case 'suppliers': return <Suppliers />;
      case 'purchase-orders': return <PurchaseOrders />;
      case 'sales-dashboard': return <SalesDashboard />;
      case 'reports': return <Reports />;
      case 'users': return <Users />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  const handleGlobalAction = (action) => {
  switch(action) {
    case 'add':
      // Ouvrir le modal de la page active
      if (activePage === 'products') {
        // Déclencher l'ouverture du modal dans Products
        window.dispatchEvent(new CustomEvent('openProductModal'));
      } else if (activePage === 'stock') {
        window.dispatchEvent(new CustomEvent('openStockModal'));
      } else if (activePage === 'invoices') {
        window.dispatchEvent(new CustomEvent('openInvoiceModal'));
      }
      break;
    case 'export':
      notify.info('Export en cours...');
      break;
    case 'print':
      window.print();
      break;
    case 'refresh':
      window.location.reload();
      break;
    default:
      break;
  }
};

  // Afficher le loader pendant la vérification de session
  if (isLoggedIn === null) {
    return <Loader fullScreen text="Vérification de la session..." />;
  }

  if (isLoggedIn) {
    return (
      <MainLayout activePage={activePage} setActivePage={setActivePage}  >
        {renderPage()}
      </MainLayout>
    );
  }

  return <Login onLogin={handleLogin} error={error} />;
}

function App() {
  return (
    <>
    <Toaster position="top-right" />
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <SettingsProvider>
            <ActionProvider> 
              <AppContent />
            </ActionProvider> 
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
    </>
  );
}

export default App;