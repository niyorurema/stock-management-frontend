// frontend/src/pages/Dashboard.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";
import DailyPerformanceChart from "../components/charts/DailyPerformanceChart";
//import { authFetchJson } from "../utils/authFetch";
import { reportService, getApiErrorMessage } from "../services/apiService";
// Helpers
const formatNumber = (num) => new Intl.NumberFormat("fr-BI").format(num || 0);
const formatCurrency = (num) =>
  new Intl.NumberFormat("fr-BI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num || 0) + " BIF";

// Couleurs pour graphiques
const chartColors = {
  primary: "#667eea",
  secondary: "#764ba2",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#8b5cf6",
  teal: "#14b8a6",
  orange: "#f97316",
  cyan: "#06b6d4",
  pink: "#ec4899",
  indigo: "#6366f1",
};

// Composant KPI Card
const KPICard = ({ title, value, icon, color, change, changeType }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`kpi-card ${isDark ? "dark" : "light"}`}>
      <div
        className="kpi-icon"
        style={{ backgroundColor: color + "15", color: color }}
      >
        <span>{icon}</span>
      </div>
      <div className="kpi-info">
        <span className="kpi-title">{title}</span>
        <span className="kpi-value">{value}</span>
        {change && (
          <span
            className={`kpi-change ${changeType === "up" ? "positive" : "negative"}`}
          >
            {changeType === "up" ? "↑" : "↓"} {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
};

// Composant Chart Card
const ChartCard = ({ title, children, height = 350 }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`chart-card ${isDark ? "dark" : "light"}`}>
      <div className="chart-title">{title}</div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Custom Tooltip pour les graphiques
/*const CustomTooltip = ({ active, payload, label }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (active && payload && payload.length) {
    return (
      <div className={`custom-tooltip ${isDark ? "dark" : "light"}`}>
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <p
            key={index}
            className="tooltip-value"
            style={{ color: entry.color }}
          >
            {entry.name}:{" "}
            {typeof entry.value === "number"
              ? formatCurrency(entry.value)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};*/

const Dashboard = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [dashboardData, setDashboardData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  const isMounted = useRef(true);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="custom-tooltip"
          style={{
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <p
            className="tooltip-label"
            style={{
              margin: 0,
              fontWeight: "bold",
              color: isDark ? "#f1f5f9" : "#1e293b",
            }}
          >
            {payload[0]?.name}
          </p>
          <p
            className="tooltip-value"
            style={{ margin: "4px 0 0", color: "#667eea" }}
          >
            {formatCurrency(payload[0]?.value)}
          </p>
          {payload[0]?.payload?.count && (
            <p
              className="tooltip-count"
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                color: isDark ? "#94a3b8" : "#64748b",
              }}
            >
              {payload[0].payload.count} transaction(s)
            </p>
          )}
        </div>
      );
    }
    return null;
  }; // Chargement des données
  const loadDashboard = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    //setLoadingText("Chargement des données...");

    try {
      const params = {
        start_date: dateRange.start,
        end_date: dateRange.end,
      };

      // Dashboard
      let dashboardData = null;
      try {
        const dashboardResponse = await reportService.getDashboard(params);
        if (dashboardResponse.data?.success) {
          dashboardData = dashboardResponse.data.data;
        }
      } catch (err) {
        console.error("Erreur dashboard:", err);
      }

      // Performance
      let performanceData = null;
      try {
        const performanceResponse = await reportService.getPerformance(params);
        if (performanceResponse.data?.success) {
          performanceData = performanceResponse.data.data;
        }
      } catch (err) {
        console.error("Erreur performance:", err);
      }

      if (!isMounted.current) return;

      if (dashboardData) setDashboardData(dashboardData);
      if (performanceData) setPerformanceData(performanceData);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error(getApiErrorMessage(error, t("error_connection")));
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [dateRange.start, dateRange.end, t]);
  useEffect(() => {
    isMounted.current = true;
    loadDashboard();
    return () => {
      isMounted.current = false;
    };
  }, [loadDashboard]);

  const handleDateChange = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    loadDashboard();
  };

  // Préparation des données
  const salesData = useMemo(() => {
    if (!dashboardData?.monthly_evolution) return [];
    return dashboardData.monthly_evolution.map((item) => ({
      month: item.month,
      revenue: formatCurrency(item.total_amount || 0),
      invoices: item.invoice_count || 0,
      average: formatCurrency(
        item.invoice_count ? item.total_amount / item.invoice_count : 0,
      ),
    }));
  }, [dashboardData]);

  /*const statusData = useMemo(() => {
    if (!dashboardData?.invoice_statuses) return [];
    const statusLabels = {
      pending: t("pending"),
      paid: t("paid"),
      partial: t("partial"),
      overdue: t("overdue"),
      cancelled: t("cancelled"),
    };
    return dashboardData.invoice_statuses.map((item) => ({
      name: statusLabels[item.status] || item.status,
      value: item.count,
    }));
  }, [dashboardData, t]);*/

  const statusData = useMemo(() => {
    if (
      !dashboardData?.invoice_statuses ||
      dashboardData.invoice_statuses.length === 0
    ) {
      // Données par défaut si aucune donnée
      return [
        { name: t("pending"), value: 0 },
        { name: t("paid"), value: 0 },
        { name: t("partial"), value: 0 },
        { name: t("overdue"), value: 0 },
        { name: t("cancelled"), value: 0 },
        { name: t("draft"), value: 0 },
      ];
    }

    const statusLabels = {
      pending: t("pending"),
      paid: t("paid"),
      partial: t("partial"),
      overdue: t("overdue"),
      cancelled: t("cancelled"),
      draft: t("draft"),
    };

    return dashboardData.invoice_statuses
      .filter((item) => item.count > 0) // Filtrer les valeurs nulles
      .map((item) => ({
        name: statusLabels[item.status] || item.status || t("unknown"),
        value: parseInt(item.count) || 0,
      }));
  }, [dashboardData, t]);
  const paymentData = useMemo(() => {
    if (
      !dashboardData?.payment_methods ||
      dashboardData.payment_methods.length === 0
    ) {
      return [];
    }

    const methodLabels = {
      cash: "Espèces",
      bank_transfer: "Virement bancaire",
      mobile_money: "Mobile Money",
      check: "Chèque",
      credit: "Crédit",
    };

    return dashboardData.payment_methods
      .filter((item) => item.count > 0 || item.total_amount > 0)
      .map((item) => ({
        name: methodLabels[item.method] || item.method,
        value: parseFloat(item.total_amount) || item.count || 0,
        count: item.count,
      }));
  }, [dashboardData, t]);
  /* const dailyData = useMemo(() => {
    if (!performanceData?.DAILY_EVOLUTION) return [];
    return performanceData.DAILY_EVOLUTION.slice(-14).map((item) => ({
      date: new Date(item.sale_date).toLocaleDateString(
        language === "fr" ? "fr-BI" : "en-US",
        { day: "2-digit", month: "short" },
      ),
      revenue: item.daily_revenue || 0,
      invoices: item.invoice_count || 0,
    }));
  }, [performanceData, language]);*/
  const dailyData = useMemo(() => {
    // La clé pourrait être différente
    const evolutionData =
      performanceData?.DAILY_EVOLUTION ||
      performanceData?.daily_evolution ||
      performanceData?.sales_evolution ||
      [];

    if (!Array.isArray(evolutionData) || evolutionData.length === 0) {
      return [];
    }

    return evolutionData.slice(-14).map((item) => ({
      date: new Date(
        item.sale_date || item.date || item.day,
      ).toLocaleDateString(language === "fr" ? "fr-BI" : "en-US", {
        day: "2-digit",
        month: "short",
      }),
      revenue: Number(
        item.daily_revenue || item.revenue || item.total_amount || 0,
      ),
      invoices: Number(item.invoice_count || item.count || 0),
    }));
  }, [performanceData, language]);
  const topProducts = useMemo(() => {
    if (!performanceData?.TOP_PRODUCTS) return [];
    return performanceData.TOP_PRODUCTS.slice(0, 5);
  }, [performanceData]);

  const stats = dashboardData?.stats || {};
  const totalRevenue = stats.total_revenue || 0;
  const totalPaid = stats.total_paid || 0;
  const totalRemaining = stats.total_remaining || 0;

  const paymentRate =
    totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : 0;

  console.log(paymentRate);
  const unpaidRate = totalRevenue > 0 ? (100 - paymentRate).toFixed(1) : 0;
  if (loading) {
    return (
      <Loader fullScreen text={t("loading_dashboard")} transparent={true} />
    );
  }

  return (
    <div className="dashboard-container">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#1e293b",
          },
        }}
      />

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">📊 {t("dashboard")}</h1>
          <p className="dashboard-subtitle">{t("dashboard_desc")}</p>
        </div>
        <div className="dashboard-actions">
          <div className="date-filters">
            <div className="filter-group">
              <label>{t("from_date")}</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => handleDateChange("start", e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>{t("to_date")}</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleDateChange("end", e.target.value)}
              />
            </div>
            <button className="btn-refresh" onClick={handleApplyFilters}>
              🔄 {t("refresh")}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title={t("total_revenue")}
          value={formatCurrency(stats.total_revenue)}
          icon="💰"
          color={chartColors.primary}
          change=""
          changeType=""
        />
        <KPICard
          title={t("total_invoices")}
          value={formatNumber(stats.total_invoices)}
          icon="📄"
          color={chartColors.success}
          change=""
          changeType=""
        />
        <KPICard
          title={t("total_suppliers")}
          value={formatNumber(stats.total_suppliers)}
          icon="🚚"
          color={chartColors.pink}
        />
        <KPICard
          title={t("total_customers")}
          value={formatNumber(stats.total_customers)}
          icon="👥"
          color={chartColors.info}
        />
        <KPICard
          title={t("total_products")}
          value={formatNumber(stats.total_products)}
          icon="📦"
          color={chartColors.primary}
        />
        <KPICard
          title={t("total_payments_paid")}
          value={formatCurrency(stats.total_paid)}
          change=""
          icon="✅"
          color={chartColors.success}
        />
        <KPICard
          title={t("total_payments_unpaid")}
          value={formatCurrency(stats.total_remaining)}
          change=""
          icon="⚠️"
          color={chartColors.warning}
        />
        <KPICard
          title={t("pending_payments")}
          value={formatCurrency(stats.pending_payments)}
          icon="⏳"
          color={chartColors.orange}
        />
        <KPICard
          title={t("overdue_payments")}
          value={formatCurrency(stats.overdue_payments)}
          icon="⏰"
          color={chartColors.danger}
        />
      </div>

      {/* Graphique principal - Évolution des ventes */}
      {/* <ChartCard title={t("sales_evolution")} height={400}> */}
      {/* Graphique des performances journalières */}
      <div className="dashboard-section" style={{ marginBottom: 32 }}>
        <div
          className="section-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: isDark ? "#f1f5f9" : "#1e293b",
              }}
            >
              📈 {t("daily_performance")}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: isDark ? "#94a3b8" : "#64748b",
                marginTop: 4,
              }}
            >
              {t("daily_performance_desc")}
            </p>
          </div>
          <div
            className="date-range-selector"
            style={{ display: "flex", gap: 12 }}
          >
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                background: isDark ? "#1e293b" : "#ffffff",
                color: isDark ? "#f1f5f9" : "#1e293b",
              }}
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                background: isDark ? "#1e293b" : "#ffffff",
                color: isDark ? "#f1f5f9" : "#1e293b",
              }}
            />
          </div>
        </div>

        <DailyPerformanceChart
          startDate={dateRange.start}
          endDate={dateRange.end}
          height={500}
        />
      </div>
      {/* <ComposedChart data={salesData}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={chartColors.primary}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={chartColors.primary}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "#334155" : "#e2e8f0"}
          />
          <XAxis dataKey="month" stroke={isDark ? "#94a3b8" : "#64748b"} />
          <YAxis
            yAxisId="left"
            stroke={chartColors.primary}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={chartColors.secondary}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            name={t("revenue")}
            stroke={chartColors.primary}
            fill="url(#revenueGradient)"
            strokeWidth={2}
          />
          <Bar
            yAxisId="right"
            dataKey="invoices"
            name={t("invoices")}
            fill={chartColors.secondary}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="average"
            name={t("average_basket")}
            stroke={chartColors.warning}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </ComposedChart> */}
      {/* </ChartCard> */}

      {/* Graphiques secondaires - 2 colonnes */}
      <div className="two-columns">
        {/* Top produits */}
        <ChartCard title={t("top_products")} height={350}>
          <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => formatNumber(v)}
              stroke={isDark ? "#94a3b8" : "#64748b"}
            />
            <YAxis
              dataKey="product_name"
              type="category"
              width={100}
              tick={{ fontSize: 11 }}
              stroke={isDark ? "#94a3b8" : "#64748b"}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="quantity_sold"
              name={t("quantity_sold")}
              fill={chartColors.primary}
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ChartCard>

        {/* Statuts des paiements */}
        <ChartCard title={t("invoice_statuses")} height={350}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              labelLine={{
                stroke: isDark ? "#334155" : "#e2e8f0",
                strokeWidth: 1,
              }}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(2)}%`
              }
              outerRadius={100}
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    [
                      chartColors.success,
                      chartColors.warning,
                      chartColors.danger,
                      chartColors.info,
                      chartColors.purple,
                    ][index % 5]
                  }
                  stroke={isDark ? "#1e293b" : "#ffffff"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
          </PieChart>
        </ChartCard>
      </div>

      {/* Évolution quotidienne - dernière semaine */}
      <div className="two-columns">
        <ChartCard title={t("daily_sales")} height={350}>
          {dailyData && dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dailyData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="dailyGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={chartColors.info}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={chartColors.info}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#334155" : "#e2e8f0"}
                />
                <XAxis
                  dataKey="date"
                  stroke={isDark ? "#94a3b8" : "#64748b"}
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => {
                    if (v === 0) return "0";
                    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                    return formatCurrency(v);
                  }}
                  stroke={isDark ? "#94a3b8" : "#64748b"}
                  domain={[0, "auto"]}
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                  width={80}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(value),
                    t("daily_revenue"),
                  ]}
                  contentStyle={{
                    backgroundColor: isDark ? "#1e293b" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                  labelStyle={{ color: isDark ? "#f1f5f9" : "#1e293b" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={t("daily_revenue")}
                  stroke={chartColors.info}
                  fill="url(#dailyGradient)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data-message">
              <span className="no-data-icon">📈</span>
              <p>{t("no_sales_data")}</p>
            </div>
          )}
        </ChartCard>
        {/* Méthodes de paiement */}
        <ChartCard title={t("payment_methods")} height={350}>
          {paymentData &&
          paymentData.length > 0 &&
          paymentData.some((item) => item.value > 0) ? (
            <PieChart>
              <Pie
                data={paymentData}
                cx="50%"
                cy="50%"
                labelLine={{
                  stroke: isDark ? "#334155" : "#e2e8f0",
                  strokeWidth: 1,
                }}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                dataKey="value"
                nameKey="name"
              >
                {paymentData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      [
                        chartColors.primary,
                        chartColors.success,
                        chartColors.warning,
                        chartColors.info,
                        chartColors.purple,
                      ][index % 5]
                    }
                    stroke={isDark ? "#1e293b" : "#ffffff"}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${formatCurrency(value)}`, name]}
                contentStyle={{
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend
                wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }}
                formatter={(value) => (
                  <span style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          ) : (
            <div className="no-data-message">
              <span className="no-data-icon">💳</span>
              <p>{t("no_payment_methods_data")}</p>
            </div>
          )}
        </ChartCard>
        {/* Méthodes de paiement */}
        {/* <ChartCard title={t("payment_methods")} height={350}>
          <PieChart>
            <Pie
              data={paymentData}
              cx="50%"
              cy="50%"
              labelLine={{
                stroke: isDark ? "#334155" : "#e2e8f0",
                strokeWidth: 1,
              }}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={100}
              dataKey="value"
            >
              {paymentData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    [
                      chartColors.primary,
                      chartColors.success,
                      chartColors.warning,
                      chartColors.info,
                      chartColors.purple,
                    ][index % 5]
                  }
                  stroke={isDark ? "#1e293b" : "#ffffff"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
          </PieChart>
        </ChartCard> */}
      </div>

      <style jsx="true">{`
        .dashboard-container {
          padding: 24px 32px;
          min-height: 100vh;
        }

        /* Header */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .dashboard-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--text-primary);
        }

        .dashboard-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .dashboard-actions {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .date-filters {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-group label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .filter-group input {
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 13px;
          background: var(--bg-card);
          color: var(--text-primary);
          transition: all 0.3s ease;
        }

        .filter-group input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .btn-refresh {
          padding: 8px 20px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-refresh:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        /* KPI Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .kpi-card {
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s;
          border: 1px solid;
          cursor: pointer;
        }

        .kpi-card.light {
          background: var(--bg-card);
          border-color: var(--border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .kpi-card.dark {
          background: var(--bg-card);
          border-color: var(--border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .kpi-icon {
          width: 55px;
          height: 55px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
        }

        .kpi-info {
          flex: 1;
        }

        .kpi-title {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          color: var(--text-secondary);
        }

        .kpi-value {
          font-size: 24px;
          font-weight: 800;
          display: block;
          margin-top: 4px;
          color: var(--text-primary);
        }

        .kpi-change {
          font-size: 11px;
          margin-top: 6px;
          display: inline-block;
        }

        .kpi-change.positive {
          color: var(--success);
        }

        .kpi-change.negative {
          color: var(--danger);
        }

        /* Chart Card */
        .chart-card {
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 24px;
          transition: all 0.3s;
          border: 1px solid;
        }

        .chart-card.light {
          background: var(--bg-card);
          border-color: var(--border);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
        }

        .chart-card.dark {
          background: var(--bg-card);
          border-color: var(--border);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
        }

        .chart-card:hover {
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
        }

        .chart-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--border);
          color: var(--text-primary);
        }

        .chart-container {
          width: 100%;
        }

        /* Two columns layout */
        .two-columns {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        /* Custom Tooltip */
        .custom-tooltip {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid;
          font-size: 12px;
        }

        .custom-tooltip.light {
          background: var(--bg-card);
          border-color: var(--border);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .custom-tooltip.dark {
          background: var(--bg-card);
          border-color: var(--border);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .tooltip-label {
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--text-primary);
        }

        .tooltip-value {
          margin: 4px 0;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .dashboard-container {
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
          .dashboard-header {
            flex-direction: column;
            align-items: stretch;
          }
          .dashboard-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .date-filters {
            flex-direction: column;
            align-items: stretch;
          }
          .filter-group input {
            width: 100%;
          }
          .btn-refresh {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
