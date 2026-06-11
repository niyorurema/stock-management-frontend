// frontend/src/App.js
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ActionProvider } from './contexts/ActionContext';
import Login from './pages/Login';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Reservations from './pages/Reservations';
import SalesDashboard from './pages/SalesDashboard';
import Warehouses from './pages/Warehouses';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Roles from './pages/Roles';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Categories from './pages/Categories';
import ProductDetail from './pages/ProductDetail';
import Loader from './components/common/Loader';
import ApiStatusBanner from './components/common/ApiStatusBanner';
import { Toaster } from 'react-hot-toast';
import './App.css';
import './styles/responsive.css';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './contexts/LanguageContext';

function AppContent() {
  const { user, loading, login } = useAuth();
  const { t } = useLanguage();
  const [error, setError] = useState('');

  const handleLogin = async (username, password) => {
    setError('');
    const result = await login(username, password);
    if (!result.success) {
      setError(result.message || t('login_error'));
    }
  };

  if (loading) {
    return <Loader fullScreen text={t('session_check')} />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} error={error} />;
  }

  return (
    <MainLayout>
      <ApiStatusBanner />
      <Routes>
        <Route path="/" element={<ProtectedRoute page="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/products" element={<ProtectedRoute page="products"><Products /></ProtectedRoute>} />
        <Route path="/products/:id" element={<ProtectedRoute page="products"><ProductDetail /></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute page="stock"><Stock /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute page="categories"><Categories /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute page="invoices"><Invoices /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute page="customers"><Customers /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute page="suppliers"><Suppliers /></ProtectedRoute>} />
        <Route path="/purchase-orders" element={<ProtectedRoute page="purchase-orders"><PurchaseOrders /></ProtectedRoute>} />
        <Route path="/reservations" element={<ProtectedRoute page="reservations"><Reservations /></ProtectedRoute>} />
        <Route path="/sales-orders" element={<Navigate to="/reservations" replace />} />
        <Route path="/sales-dashboard" element={<ProtectedRoute page="sales-dashboard"><SalesDashboard /></ProtectedRoute>} />
        <Route path="/warehouses" element={<ProtectedRoute page="warehouses"><Warehouses /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute page="reports"><Reports /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute page="users"><Users /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute page="roles"><Roles /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute page="settings"><Settings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute page="profile"><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute page="notifications"><Notifications /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
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