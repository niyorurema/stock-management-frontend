// frontend/src/pages/Reports.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import Loader from '../components/common/Loader';

import { reportService,warehouseService,getApiErrorMessage } from '../services/apiService';

// Constantes
const DEFAULT_DATE_RANGE = () => ({
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0]
});

const COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6',
  orange: '#f97316',
  cyan: '#06b6d4',
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706'
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#14b8a6'];

// Helpers
const formatNumber = (num) => new Intl.NumberFormat('fr-BI').format(num || 0);
const formatCurrency = (num) => new Intl.NumberFormat('fr-BI', { 
  minimumFractionDigits: 0, 
  maximumFractionDigits: 0 
}).format(num || 0) + ' FBu';

// Mapping des statuts
const getPaymentStatusLabel = (status, t) => {
  const labels = {
    'pending': t('pending'),
    'paid': t('paid'),
    'partial': t('partial'),
    'overdue': t('overdue'),
    'cancelled': t('cancelled')
  };
  return labels[status] || status;
};

const getPaymentMethodLabel = (method, t) => {
  const labels = {
    'cash': t('cash'),
    'bank_transfer': t('bank_transfer'),
    'mobile_money': t('mobile_money'),
    'check': t('check'),
    'credit': t('credit')
  };
  return labels[method] || method;
};

// Composant KPI Card
const KPICard = ({ icon, label, value, color, trend, subtitle }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className={`kpi-card ${isDark ? 'dark' : 'light'}`} style={{ borderLeftColor: color }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-content">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
        {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
        {trend && (
          <span className="kpi-trend" style={{ color: trend > 0 ? COLORS.success : COLORS.danger }}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
};

// Composant Chart Card
const ChartCard = ({ title, subtitle, children, className = "", actions }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className={`chart-card ${isDark ? 'dark' : 'light'} ${className}`}>
      <div className="chart-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="chart-actions">{actions}</div>}
      </div>
      <div className="chart-content">
        {children}
      </div>
    </div>
  );
};

const Reports = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [dashboardData, setDashboardData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [suppliersData, setSuppliersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Chargement des données...');
  const [exportLoading, setExportLoading] = useState(false);
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE());
  const [reportType, setReportType] = useState('sales');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  
  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);

  // Chargement des entrepôts
 const loadWarehouses = useCallback(async () => {
  try {
    const response = await warehouseService.getAll();
    
    if (response.data?.success && isMounted.current) {
      setWarehouses(response.data.data || []);
    }
  } catch (error) {
    console.error('Erreur chargement entrepôts:', error);
    toast.error(getApiErrorMessage(error, 'Erreur chargement des entrepôts'));
  }
}, []);

  // Chargement des données
// Chargement des données
const loadDashboard = useCallback(async () => {
  if (isLoadingRef.current || !isMounted.current) return;
  
  isLoadingRef.current = true;
  setLoading(true);
  setLoadingText('Chargement des statistiques...');
  
  try {
    const params = {
      start_date: dateRange.start,
      end_date: dateRange.end
    };

    setLoadingText('Chargement des ventes...');
    const dashboardResponse = await reportService.getDashboard(params);
    const dashboardResult = dashboardResponse.data?.success ? dashboardResponse.data.data : {};

    setLoadingText('Chargement des performances...');
    const performanceResponse = await reportService.getPerformance(params);
    const performanceResult = performanceResponse.data?.success ? performanceResponse.data.data : {};

    setLoadingText('Chargement de l\'inventaire...');
    const inventoryResponse = await reportService.getInventory({
      warehouse_id: selectedWarehouse,
      critical_only: false
    });
    const inventoryResult = inventoryResponse.data?.success ? inventoryResponse.data.data : {};

    setLoadingText('Chargement des données financières...');
    const financialResponse = await reportService.getFinancial(params);
    const financialResult = financialResponse.data?.success ? financialResponse.data.data : {};

    setLoadingText('Chargement des fournisseurs...');
    const suppliersResponse = await reportService.getSuppliers(params);
    const suppliersResult = suppliersResponse.data?.success ? suppliersResponse.data.data : {};

    if (!isMounted.current) return;
    
    setDashboardData(dashboardResult);
    setPerformanceData(performanceResult);
    setInventoryData(inventoryResult);
    setFinancialData(financialResult);
    setSuppliersData(suppliersResult);
    
  } catch (error) {
    console.error('Erreur chargement:', error);
    toast.error(getApiErrorMessage(error, t('error_connection')));
  } finally {
    if (isMounted.current) {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }
}, [dateRange.start, dateRange.end, selectedWarehouse, t]);

  // Export
  const exportReport = useCallback(async () => {
  if (exportLoading) return;
  setExportLoading(true);
  
  try {
    // Utiliser axios avec responseType: 'blob' pour les fichiers
    const response = await reportService.exportReport({
      report_type: reportType,
      start_date: dateRange.start,
      end_date: dateRange.end
    });
    
    // Axios retourne directement les données blob
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${reportType}_${dateRange.start}_${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success(t('export_success'));
  } catch (error) {
    console.error('Erreur export:', error);
    toast.error(getApiErrorMessage(error, t('export_error')));
  } finally {
    setExportLoading(false);
  }
}, [reportType, dateRange.start, dateRange.end, exportLoading, t]);

  // Initialisation
  useEffect(() => {
    isMounted.current = true;
    loadWarehouses();
    loadDashboard();
    return () => { isMounted.current = false; };
  }, [loadDashboard, loadWarehouses]);

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    loadDashboard();
  };

  // Préparation des données
 const salesChartData = useMemo(() => {
  if (!dashboardData?.monthly_evolution) return [];
  return dashboardData.monthly_evolution.map(item => ({
    month: item.month,
    revenue: item.total_amount || 0,
    invoices: item.invoice_count || 0,
    average: item.invoice_count ? (item.total_amount / item.invoice_count) : 0
  }));
}, [dashboardData]);

  const statusData = useMemo(() => {
  if (!dashboardData?.invoice_statuses) return [];
  return dashboardData.invoice_statuses.map(item => ({
    name: getPaymentStatusLabel(item.status, t),
    originalName: item.status,
    value: item.count || 0
  }));
}, [dashboardData, t]);

 const paymentMethodData = useMemo(() => {
  if (!dashboardData?.payment_methods) return [];
  return dashboardData.payment_methods.map(item => ({
    name: getPaymentMethodLabel(item.method, t),
    originalName: item.method,
    value: item.total_amount || 0,
    count: item.count || 0
  }));
}, [dashboardData, t]);

  const topProducts = useMemo(() => {
  if (!performanceData?.TOP_PRODUCTS) return [];
  return performanceData.TOP_PRODUCTS || [];
}, [performanceData]);

  const topCustomers = useMemo(() => {
  if (!performanceData?.TOP_CUSTOMERS) return [];
  return performanceData.TOP_CUSTOMERS || [];
}, [performanceData]);

  const dailyEvolution = useMemo(() => {
  if (!performanceData?.DAILY_EVOLUTION) return [];
  return performanceData.DAILY_EVOLUTION || [];
}, [performanceData]);

const criticalStock = useMemo(() => {
  if (!inventoryData?.stock_status) return [];
  return (inventoryData.stock_status || []).filter(item => item.stock_status !== 'NORMAL');
}, [inventoryData]);

  const recentMovements = useMemo(() => {
  if (!inventoryData?.recent_movements) return [];
  return inventoryData.recent_movements || [];
}, [inventoryData]);

const agingData = useMemo(() => {
  if (!financialData?.AGING_RECEIVABLES) return [];
  return financialData.AGING_RECEIVABLES || [];
}, [financialData]);

  const suppliers = useMemo(() => {
  if (!suppliersData?.suppliers) return [];
  return suppliersData.suppliers || [];
}, [suppliersData]);

const topSuppliers = useMemo(() => {
  if (!suppliersData?.top_suppliers) return [];
  return suppliersData.top_suppliers || [];
}, [suppliersData]);

 // const stats = dashboardData?.stats || {};

  const stats = dashboardData?.stats || {
  total_revenue: 0,
  total_invoices: 0,
  total_customers: 0,
  total_suppliers: 0,
  total_products: 0
};

  // Afficher le loader transparent pendant le chargement
  if (loading) {
    return <Loader fullScreen text={loadingText} transparent={true} />;
  }

  return (
    <div className={`reports-page ${isDark ? 'dark' : 'light'}`}>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#1e293b',
          },
        }}
      />
      
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>📊 {t('dashboard')}</h1>
          <p>{t('dashboard_desc')}</p>
        </div>
        <div className="header-actions">
          <select 
            className={`report-select ${isDark ? 'dark' : 'light'}`}
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="sales">📈 {t('sales')}</option>
            <option value="products">🏆 {t('products')}</option>
            <option value="customers">👥 {t('customers')}</option>
            <option value="suppliers">🏭 {t('suppliers')}</option>
            <option value="stock">📦 {t('stock')}</option>
          </select>
          <button className="btn-export" onClick={exportReport} disabled={exportLoading}>
            {exportLoading ? '⏳...' : `📥 ${t('export')}`}
          </button>
        </div>
      </div>
      
      {/* Filtres */}
      <div className={`filters-card ${isDark ? 'dark' : 'light'}`}>
        <div className="filters-container">
          <div className="filter-group">
            <label>{t('from_date')}</label>
            <input type="date" value={dateRange.start} onChange={(e) => handleDateChange('start', e.target.value)} />
          </div>
          <div className="filter-group">
            <label>{t('to_date')}</label>
            <input type="date" value={dateRange.end} onChange={(e) => handleDateChange('end', e.target.value)} />
          </div>
          <div className="filter-group">
            <label>{t('warehouse')}</label>
            <select value={selectedWarehouse || ''} onChange={(e) => setSelectedWarehouse(e.target.value || null)}>
              <option value="">{t('all_warehouses')}</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-apply" onClick={handleApplyFilters}>{t('apply')}</button>
        </div>
      </div>
      
      {/* Onglets */}
      <div className={`tabs-container ${isDark ? 'dark' : 'light'}`}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📈 {t('overview')}
        </button>
        <button className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
          🏆 {t('top_products')}
        </button>
        <button className={`tab ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
          👥 {t('top_customers')}
        </button>
        <button className={`tab ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>
          🏭 {t('suppliers')}
        </button>
        <button className={`tab ${activeTab === 'financial' ? 'active' : ''}`} onClick={() => setActiveTab('financial')}>
          💰 {t('financial')}
        </button>
        <button className={`tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          📦 {t('stock')}
        </button>
      </div>
      
      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard 
          icon="💰" 
          label={t('total_revenue')} 
          value={formatCurrency(stats.total_revenue)} 
          color={COLORS.primary}
        />
        <KPICard 
          icon="📄" 
          label={t('total_invoices')} 
          value={formatNumber(stats.total_invoices)} 
          color={COLORS.success}
        />
        <KPICard 
          icon="👥" 
          label={t('total_customers')} 
          value={formatNumber(stats.total_customers)} 
          color={COLORS.info}
        />
        <KPICard 
          icon="🏭" 
          label={t('total_suppliers')} 
          value={formatNumber(stats.total_suppliers)} 
          color={COLORS.purple}
        />
        <KPICard 
          icon="📦" 
          label={t('total_products')} 
          value={formatNumber(stats.total_products)} 
          color={COLORS.warning}
        />
        <KPICard 
          icon="⚠️" 
          label={t('critical_stock')} 
          value={formatNumber(criticalStock.length)} 
          color={COLORS.danger}
          subtitle={t('products_under_alert')}
        />
      </div>
      
      {/* Vue d'ensemble */}
      {activeTab === 'overview' && (
        <>
          {/* Graphique principal */}
          <ChartCard title={t('sales_evolution')} subtitle={t('revenue_vs_invoices')} className="full-width">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={salesChartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="month" stroke={isDark ? '#94a3b8' : '#64748b'} />
                <YAxis yAxisId="left" stroke={COLORS.primary} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" stroke={COLORS.secondary} />
                <Tooltip 
                  contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }}
                  formatter={(value, name) => {
                    if (name === 'revenue') return [formatCurrency(value), t('revenue')];
                    if (name === 'invoices') return [formatNumber(value), t('invoices')];
                    return [formatNumber(value), t('average')];
                  }} 
                />
                <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name={t('revenue')} stroke={COLORS.primary} fill="url(#revenueGradient)" strokeWidth={2} />
                <Bar yAxisId="right" dataKey="invoices" name={t('invoice_count')} fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="average" name={t('average_basket')} stroke={COLORS.warning} strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
          
          {/* Top produits et Top clients */}
          <div className="two-columns">
            <ChartCard title={t('top_products')} subtitle={t('best_sellers')}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topProducts.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <YAxis dataKey="product_name" type="category" width={120} tick={{ fontSize: 12 }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatNumber(value)} />
                  <Bar dataKey="quantity_sold" name={t('quantity_sold')} fill={COLORS.primary} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            
            <ChartCard title={t('top_customers')} subtitle={t('best_contributors')}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topCustomers.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <YAxis dataKey="customer_name" type="category" width={120} tick={{ fontSize: 12 }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total_spent" name={t('total_amount')} fill={COLORS.success} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          
          {/* Statuts et paiements */}
          <div className="two-columns">
            <ChartCard title={t('invoice_statuses')} subtitle={t('status_distribution')}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={{ stroke: isDark ? '#94a3b8' : '#94a3b8', strokeWidth: 1 }}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke={isDark ? '#1e293b' : 'white'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                  <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            
            <ChartCard title={t('payment_methods')} subtitle={t('methods_distribution')}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={{ stroke: isDark ? '#94a3b8' : '#94a3b8', strokeWidth: 1 }}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke={isDark ? '#1e293b' : 'white'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
      
      {/* Top produits - onglet dédié */}
      {activeTab === 'products' && (
        <>
          <ChartCard title={t('top_products')} subtitle={t('products_ranking')} className="full-width">
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 150 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis type="number" stroke={isDark ? '#94a3b8' : '#64748b'} />
                <YAxis dataKey="product_name" type="category" width={140} tick={{ fontSize: 11 }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                <Tooltip 
                  contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }}
                  formatter={(value, name) => {
                    if (name === 'quantity_sold') return [formatNumber(value), t('quantity_sold')];
                    return [formatCurrency(value), t('revenue')];
                  }}
                />
                <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                <Bar dataKey="quantity_sold" name={t('quantity_sold')} fill={COLORS.primary} radius={[0, 8, 8, 0]} />
                <Bar dataKey="revenue" name={t('revenue')} fill={COLORS.success} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          
          <div className="two-columns">
            <ChartCard title={t('daily_sales')} subtitle={t('sales_per_day')}>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={dailyEvolution}>
                  <defs>
                    <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.info} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="sale_date" stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="daily_revenue" name={t('daily_revenue')} stroke={COLORS.info} fill="url(#dailyGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            
            <ChartCard title={t('payment_methods')} subtitle={t('methods_details')}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={paymentMethodData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="value" name={t('total_amount')} fill={COLORS.purple} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
      
      {/* Top clients - onglet dédié */}
      {activeTab === 'customers' && (
        <>
          <ChartCard title={t('top_customers')} subtitle={t('customers_ranking')} className="full-width">
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={topCustomers} layout="vertical" margin={{ left: 150 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                <YAxis dataKey="customer_name" type="category" width={140} tick={{ fontSize: 11 }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                <Bar dataKey="total_spent" name={t('total_amount')} fill={COLORS.success} radius={[0, 8, 8, 0]} />
                <Bar dataKey="avg_invoice" name={t('average_basket')} fill={COLORS.info} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          
          <div className="two-columns">
            <ChartCard title={t('customers_distribution')} subtitle={t('by_purchase_volume')}>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={topCustomers.map(c => ({ name: c.customer_name, value: c.total_spent }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {topCustomers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke={isDark ? '#1e293b' : 'white'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            
            <ChartCard title={t('purchase_frequency')} subtitle={t('invoices_per_customer')}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topCustomers} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="customer_name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                  <Bar dataKey="invoice_count" name={t('invoice_count')} fill={COLORS.warning} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
      
      {/* Fournisseurs */}
      {activeTab === 'suppliers' && (
        <>
          <ChartCard title={t('top_suppliers')} subtitle={t('top_suppliers_by_purchases')} className="full-width">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topSuppliers} layout="vertical" margin={{ left: 150 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                <YAxis dataKey="supplier_name" type="category" width={140} tick={{ fontSize: 11 }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total_amount" name={t('purchases')} fill={COLORS.purple} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          
          <div className="two-columns">
            <ChartCard title={t('suppliers_list')} subtitle={t('active_suppliers')}>
              <div className="suppliers-table-wrapper">
                <table className="suppliers-table">
                  <thead>
                    <tr>
                      <th>{t('code')}</th>
                      <th>{t('name')}</th>
                      <th>{t('contact')}</th>
                      <th>{t('phone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.slice(0, 10).map((supplier, i) => (
                      <tr key={i}>
                        <td className="supplier-code">{supplier.code}</td>
                        <td className="supplier-name">{supplier.name}</td>
                        <td>{supplier.contact_person || '-'}</td>
                        <td>{supplier.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
            
            <ChartCard title={t('supplier_stats')} subtitle={t('purchase_summary')}>
              <div className="supplier-stats">
                {suppliers.slice(0, 8).map((supplier, i) => (
                  <div key={i} className="supplier-stat-item">
                    <div className="supplier-stat-name">{supplier.name}</div>
                    <div className="supplier-stat-bar">
                      <div className="supplier-stat-progress" style={{ width: `${Math.min((supplier.total_purchases / (stats.total_revenue || 1)) * 100, 100)}%` }}></div>
                    </div>
                    <div className="supplier-stat-value">{formatCurrency(supplier.total_purchases)}</div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}
      
      {/* Financier */}
      {activeTab === 'financial' && (
        <>
          <div className="two-columns">
            <ChartCard title={t('revenue_distribution')} subtitle={t('by_source')}>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={[
                      { name: t('net_sales'), value: stats.total_revenue || 0 },
                      { name: t('vat'), value: (stats.total_revenue || 0) * 0.18 },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={{ stroke: isDark ? '#94a3b8' : '#94a3b8', strokeWidth: 1 }}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    <Cell fill={COLORS.primary} stroke={isDark ? '#1e293b' : 'white'} strokeWidth={2} />
                    <Cell fill={COLORS.warning} stroke={isDark ? '#1e293b' : 'white'} strokeWidth={2} />
                  </Pie>
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            
            <ChartCard title={t('aging_receivables')} subtitle={t('payment_delays')}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="aging_bucket" stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} stroke={isDark ? '#94a3b8' : '#64748b'} />
                  <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount_due" name={t('amount_due')} fill={COLORS.danger} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
      
      {/* Stock */}
      {activeTab === 'stock' && (
        <>
          {criticalStock.length > 0 && (
            <div className={`alert-section ${isDark ? 'dark' : 'light'}`}>
              <div className="alert-header">
                <span className="alert-icon">⚠️</span>
                <h3>{t('critical_stock_alert')}</h3>
                <span className="alert-count">{criticalStock.length} {t('products')}</span>
              </div>
              <div className="alert-grid">
                {criticalStock.slice(0, 8).map((product, i) => (
                  <div key={i} className="alert-card">
                    <div className="alert-product">{product.name}</div>
                    <div className="alert-stock">
                      <span className="stock-label">{t('current_stock')}:</span>
                      <span className="stock-value danger">{product.current_stock} {product.unit}</span>
                    </div>
                    <div className="alert-stock">
                      <span className="stock-label">{t('min_alert')}:</span>
                      <span>{product.min_stock_alert} {product.unit}</span>
                    </div>
                    <div className="alert-progress">
                      <div className="progress-bar" style={{ width: `${Math.min((product.current_stock / product.min_stock_alert) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <ChartCard title={t('recent_movements')} subtitle={t('warehouse_activity')} className="full-width">
            <div className="movements-table-wrapper">
              <table className="movements-table">
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('product')}</th>
                    <th>{t('movement_type')}</th>
                    <th>{t('quantity')}</th>
                    <th>{t('warehouse')}</th>
                    <th>{t('user')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.slice(0, 15).map((movement, i) => (
                    <tr key={i}>
                      <td>{movement.movement_date ? new Date(movement.movement_date).toLocaleDateString(language === 'fr' ? 'fr-BI' : 'en-US') : '-'}</td>
                      <td className="product-cell">{movement.product_name || '-'}</td>
                      <td>
                        <span className={`movement-badge ${movement.movement_type === 'EN' || movement.movement_type === 'ER' ? 'entry' : 'exit'}`}>
                          {movement.movement_type === 'EN' ? `📥 ${t('entry')}` : 
                           movement.movement_type === 'SN' ? `📤 ${t('exit')}` :
                           movement.movement_type === 'ER' ? `🔄 ${t('return')}` : `🚚 ${t('transfer')}`}
                        </span>
                      </td>
                      <td className={movement.movement_type === 'EN' || movement.movement_type === 'ER' ? 'positive' : 'negative'}>
                        {movement.movement_type === 'EN' || movement.movement_type === 'ER' ? '+' : '-'}
                        {movement.quantity} {movement.unit}
                      </td>
                      <td>{movement.warehouse_name || '-'}</td>
                      <td>{movement.user_name || '-'}</td>
                    </tr>
                  ))}
                  {recentMovements.length === 0 && (
                    <tr><td colSpan="6" className="empty-row">{t('no_movements')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
      
      <style>{`
        .reports-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .reports-page.light {
          background: var(--bg-main);
        }
        
        .reports-page.dark {
          background: var(--bg-main);
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .page-header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--text-primary);
        }
        
        .page-header p {
          color: var(--text-secondary);
          font-size: 14px;
        }
        
        .header-actions {
          display: flex;
          gap: 12px;
        }
        
        .report-select {
          padding: 10px 18px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg-card);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          color: var(--text-primary);
        }
        
        .btn-export {
          padding: 10px 24px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-export:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        
        .btn-export:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .filters-card {
          border-radius: 16px;
          margin-bottom: 28px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .filters-container {
          display: flex;
          gap: 20px;
          align-items: flex-end;
          padding: 20px;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }
        
        .filter-group input, .filter-group select {
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 14px;
          min-width: 160px;
          background: var(--bg-main);
          color: var(--text-primary);
        }
        
        .btn-apply {
          padding: 10px 28px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-apply:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }
        
        .tabs-container {
          display: flex;
          gap: 8px;
          margin-bottom: 28px;
          padding: 6px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          flex-wrap: wrap;
        }
        
        .tab {
          flex: 1;
          padding: 12px 20px;
          border: none;
          background: transparent;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        
        .tab:hover {
          background: var(--bg-main);
        }
        
        .tab.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          box-shadow: 0 2px 8px rgba(102,126,234,0.3);
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        
        .kpi-card {
          border-radius: 20px;
          padding: 22px;
          display: flex;
          align-items: center;
          gap: 18px;
          border-left: 4px solid;
          transition: all 0.3s;
          border: 1px solid var(--border);
          border-left-width: 4px;
          background: var(--bg-card);
        }
        
        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        
        .kpi-icon {
          font-size: 44px;
        }
        
        .kpi-content {
          flex: 1;
        }
        
        .kpi-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
        }
        
        .kpi-value {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          display: block;
          margin-top: 6px;
        }
        
        .kpi-subtitle {
          font-size: 11px;
          color: var(--text-muted);
          display: block;
          margin-top: 4px;
        }
        
        .chart-card {
          border-radius: 24px;
          padding: 24px;
          transition: all 0.3s;
          margin-bottom: 24px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .chart-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.1);
        }
        
        .chart-card.full-width {
          grid-column: 1 / -1;
        }
        
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid var(--border);
          flex-wrap: wrap;
          gap: 12px;
        }
        
        .chart-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .chart-header p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        
        .chart-content {
          min-height: 350px;
        }
        
        .two-columns {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .alert-section {
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .alert-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid rgba(239,68,68,0.2);
        }
        
        .alert-icon {
          font-size: 28px;
        }
        
        .alert-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #dc2626;
        }
        
        .alert-count {
          margin-left: auto;
          background: rgba(220,38,38,0.1);
          color: #dc2626;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        
        .alert-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        
        .alert-card {
          background: rgba(239,68,68,0.05);
          border-radius: 14px;
          padding: 18px;
          transition: all 0.2s;
          border: 1px solid rgba(239,68,68,0.2);
        }
        
        .alert-card:hover {
          transform: translateX(4px);
        }
        
        .alert-product {
          font-weight: 700;
          margin-bottom: 12px;
          color: #dc2626;
          font-size: 15px;
        }
        
        .alert-stock {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .stock-label {
          color: var(--text-secondary);
        }
        
        .stock-value {
          font-weight: 700;
        }
        
        .stock-value.danger {
          color: #dc2626;
        }
        
        .alert-progress {
          height: 6px;
          background: rgba(239,68,68,0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 8px;
        }
        
        .progress-bar {
          height: 100%;
          background: #dc2626;
          border-radius: 3px;
          transition: width 0.3s;
        }
        
        .movements-table-wrapper {
          overflow-x: auto;
        }
        
        .movements-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .movements-table th {
          text-align: left;
          padding: 14px;
          background: var(--bg-header);
          font-weight: 600;
          font-size: 13px;
          color: var(--text-primary);
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }
        
        .movements-table td {
          padding: 14px;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
          color: var(--text-primary);
        }
        
        .movements-table tr:hover {
          background: var(--bg-main);
        }
        
        .product-cell {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .movement-badge {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .movement-badge.entry {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }
        
        .movement-badge.exit {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        
        .positive {
          color: #10b981;
          font-weight: 700;
        }
        
        .negative {
          color: #dc2626;
          font-weight: 700;
        }
        
        .empty-row {
          text-align: center;
          color: var(--text-secondary);
          padding: 48px;
        }
        
        .suppliers-table-wrapper {
          overflow-x: auto;
        }
        
        .suppliers-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .suppliers-table th {
          text-align: left;
          padding: 12px;
          background: var(--bg-header);
          font-weight: 600;
          font-size: 12px;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border);
        }
        
        .suppliers-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .supplier-code {
          font-family: monospace;
          font-weight: 600;
          color: #667eea;
        }
        
        .supplier-name {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .supplier-stats {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .supplier-stat-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .supplier-stat-name {
          width: 120px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .supplier-stat-bar {
          flex: 1;
          height: 8px;
          background: var(--border);
          border-radius: 4px;
          overflow: hidden;
        }
        
        .supplier-stat-progress {
          height: 100%;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          border-radius: 4px;
          transition: width 0.3s;
        }
        
        .supplier-stat-value {
          width: 100px;
          text-align: right;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        @media (max-width: 1024px) {
          .reports-page {
            padding: 16px;
          }
          .two-columns {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
          .filters-container {
            flex-direction: column;
            align-items: stretch;
          }
          .header-actions {
            flex-direction: column;
            width: 100%;
          }
          .report-select, .btn-export {
            width: 100%;
          }
          .tabs-container {
            flex-direction: column;
          }
          .filter-group input, .filter-group select {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Reports;
