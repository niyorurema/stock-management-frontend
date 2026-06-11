// frontend/src/pages/SalesDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import {
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
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/common/Loader";
import Swal from "sweetalert2";
import { authFetch, authFetchJson, publicAssetUrl } from "../utils/authFetch";
import { getApiErrorMessage } from "../services/apiService";

// Couleurs professionnelles
const COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  indigo: "#6366f1",
  teal: "#14b8a6",
  orange: "#f97316",
  cyan: "#06b6d4",
  emerald: "#059669",
};

// Helpers
const formatNumber = (num) => new Intl.NumberFormat("fr-BI").format(num || 0);
const formatCurrency = (num) =>
  new Intl.NumberFormat("fr-BI", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0) + " FBu";

// Mapping des statuts
const getStatusLabel = (status, t) => {
  const labels = {
    collected: t("collected"),
    banked: t("banked"),
    pending: t("pending"),
  };
  return labels[status] || status;
};

const getStatusIcon = (status) => {
  const icons = {
    collected: "📥",
    banked: "🏦",
    pending: "⏳",
  };
  return icons[status] || "❓";
};

const getStatusColor = (status) => {
  const colors = {
    collected: COLORS.success,
    banked: COLORS.info,
    pending: COLORS.warning,
  };
  return colors[status] || COLORS.danger;
};

const SalesDashboard = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [salesData, setSalesData] = useState(null);
  const [stats, setStats] = useState({
    total_sales: 0,
    total_collected: 0,
    total_banked: 0,
    total_cash_in_hand: 0,
    pending_collection: 0,
    completion_rate: 0,
  });
  const [warehouses, setWarehouses] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);
  const [reportAttachment, setReportAttachment] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // États des modaux
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [bankSlip, setBankSlip] = useState(null);
  const [bankReference, setBankReference] = useState("");
  const [bankAmount, setBankAmount] = useState(0);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionAmount, setCollectionAmount] = useState(0);

  // Chargement des données
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result } = await authFetchJson(
        `/api/sales-dashboard?date=${selectedDate}`,
      );

      if (result.success) {
        setSalesData(result.data);
        setStats(result.data.stats);
        setWarehouses(result.data.warehouses || []);
        setDailyReport(result.data.daily_report);
      } else {
        toast.error(result?.message || t("error_loading_data"));
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(getApiErrorMessage(error, t("error_loading_data")));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, t]);

  // Marquer comme collecté
  const handleMarkAsCollected = async (warehouse) => {
    setSelectedWarehouse(warehouse);
    setCollectionAmount(Number(warehouse.daily_sales) || 0);
    setCollectionModalOpen(true);
  };

  const confirmCollection = async () => {
    setActionLoading("collect");

    try {
      const { data } = await authFetchJson("/api/sales-dashboard/collect", {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: selectedWarehouse.id,
          amount: collectionAmount,
          collection_date: selectedDate,
          collected_by: user?.id,
        }),
      });

      if (data.success) {
        toast.success(
          t("collection_recorded", {
            amount: formatCurrency(collectionAmount),
            warehouse: selectedWarehouse.name,
          }),
        );
        setCollectionModalOpen(false);
        loadDashboard();
      } else {
        toast.error(data?.message || t("error_collection"));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("error_collection")));
    } finally {
      setActionLoading(null);
    }
  };

  // Marquer comme déposé en banque
  const handleMarkAsBanked = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setBankAmount(
      Number(warehouse.collected_amount) || Number(warehouse.daily_sales) || 0,
    );
    setBankReference("");
    setBankSlip(null);
    setBankModalOpen(true);
  };

  const confirmBankDeposit = async () => {
    if (!bankReference) {
      toast.error(t("bank_reference_required"));
      return;
    }

    setActionLoading("bank");
    const formData = new FormData();
    formData.append("warehouse_id", selectedWarehouse.id);
    formData.append("amount", bankAmount);
    formData.append("date", selectedDate);
    formData.append("bank_reference", bankReference);
    if (bankSlip) {
      formData.append("bank_slip", bankSlip);
    }

    try {
      const { data } = await authFetchJson(
        "/api/sales-dashboard/bank-deposit",
        {
          method: "POST",
          body: formData,
        },
      );

      if (data.success) {
        toast.success(
          t("bank_deposit_recorded", {
            amount: formatCurrency(bankAmount),
            warehouse: selectedWarehouse.name,
          }),
        );
        setBankModalOpen(false);
        loadDashboard();
      } else {
        toast.error(data?.message || t("error_bank_deposit"));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("error_bank_deposit")));
    } finally {
      setActionLoading(null);
    }
  };

  // Générer rapport quotidien
  const handleGenerateReport = async () => {
    setActionLoading("report");
    const formData = new FormData();
    formData.append("date", selectedDate);
    if (reportAttachment) {
      formData.append("attachment", reportAttachment);
    }

    try {
      const { data } = await authFetchJson(
        "/api/sales-dashboard/generate-report",
        {
          method: "POST",
          body: formData,
        },
      );

      if (data.success) {
        toast.success(t("report_generated"));
        setReportModalOpen(false);
        loadDashboard();
      } else {
        toast.error(data?.message || t("error_report"));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("error_report")));
    } finally {
      setActionLoading(null);
    }
  };

  // Exporter les données
  const handleExport = async () => {
    setActionLoading("export");
    try {
      const response = await authFetch(
        `/api/sales-dashboard/export?date=${selectedDate}`,
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport_ventes_${selectedDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(t("export_success"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("export_error")));
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Données pour les graphiques
  const chartData = useMemo(() => {
    return warehouses.map((w) => ({
      name: w.name.length > 15 ? w.name.substring(0, 12) + "..." : w.name,
      fullName: w.name,
      ventes: Number(w.daily_sales) || 0,
      collecte: Number(w.collected_amount) || 0,
      banque: Number(w.banked_amount) || 0,
      manager: w.manager_name,
      status: w.collected_status,
    }));
  }, [warehouses]);

  const pieData = [
    {
      name: t("collected"),
      value: Number(stats.total_collected) || 0,
      color: COLORS.success,
      icon: "📥",
    },
    {
      name: t("banked"),
      value: Number(stats.total_banked) || 0,
      color: COLORS.info,
      icon: "🏦",
    },
    {
      name: t("pending"),
      value: Number(stats.pending_collection) || 0,
      color: COLORS.warning,
      icon: "⏳",
    },
  ].filter((item) => item.value > 0);

  const statusDistribution = useMemo(() => {
    const collected = warehouses.filter(
      (w) => w.collected_status === "collected",
    ).length;
    const banked = warehouses.filter(
      (w) => w.collected_status === "banked",
    ).length;
    const pending = warehouses.filter(
      (w) => !w.collected_status || w.collected_status === "pending",
    ).length;
    return [
      { name: t("collected"), value: collected, color: COLORS.success },
      { name: t("banked"), value: banked, color: COLORS.info },
      { name: t("pending"), value: pending, color: COLORS.warning },
    ];
  }, [warehouses, t]);

  if (loading)
    return (
      <Loader fullScreen text={t("loading_dashboard")} transparent={true} />
    );

  return (
    <div className={`sales-dashboard ${isDark ? "dark" : "light"}`}>
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
          <h1>💰 {t("sales_dashboard")}</h1>
          <p>{t("sales_dashboard_desc")}</p>
        </div>
        <div className="header-actions">
          <div className="date-picker">
            <Tippy
              content={t("select_date")}
              placement="bottom"
              animation="scale"
            >
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
              />
            </Tippy>
            <Tippy
              content={t("refresh_data")}
              placement="bottom"
              animation="scale"
            >
              <button
                className="btn-icon refresh"
                onClick={loadDashboard}
                disabled={actionLoading === "refresh"}
              >
                {actionLoading === "refresh" ? (
                  <span className="btn-spinner"></span>
                ) : (
                  "🔄"
                )}
              </button>
            </Tippy>
            <Tippy
              content={t("export_data")}
              placement="bottom"
              animation="scale"
            >
              <button
                className="btn-icon export"
                onClick={handleExport}
                disabled={actionLoading === "export"}
              >
                {actionLoading === "export" ? (
                  <span className="btn-spinner"></span>
                ) : (
                  "📥"
                )}
              </button>
            </Tippy>
          </div>
          <Tippy
            content={t("generate_daily_report")}
            placement="bottom"
            animation="scale"
          >
            <button
              className="btn-report"
              onClick={() => setReportModalOpen(true)}
              disabled={actionLoading === "report"}
            >
              {actionLoading === "report" ? (
                <span className="btn-spinner"></span>
              ) : (
                "📄"
              )}{" "}
              {t("generate_report")}
            </button>
          </Tippy>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <Tippy
          content={t("total_sales_tooltip")}
          placement="top"
          animation="scale"
        >
          <div className="kpi-card" style={{ borderLeftColor: COLORS.primary }}>
            <div className="kpi-icon">💰</div>
            <div className="kpi-info">
              <span className="kpi-label">{t("total_sales")}</span>
              <span className="kpi-value">
                {formatCurrency(Number(stats.total_sales) || 0)}
              </span>
              <span className="kpi-subtitle">
                {formatNumber(warehouses.length)} {t("warehouses")}
              </span>
            </div>
          </div>
        </Tippy>

        <Tippy
          content={t("collected_tooltip")}
          placement="top"
          animation="scale"
        >
          <div className="kpi-card" style={{ borderLeftColor: COLORS.success }}>
            <div className="kpi-icon">📥</div>
            <div className="kpi-info">
              <span className="kpi-label">{t("collected_by_collector")}</span>
              <span className="kpi-value">
                {formatCurrency(Number(stats.total_collected) || 0)}
              </span>
              <span className="kpi-subtitle">
                {Number(stats.completion_rate) || 0}% {t("of_total")}
              </span>
            </div>
          </div>
        </Tippy>

        <Tippy content={t("banked_tooltip")} placement="top" animation="scale">
          <div className="kpi-card" style={{ borderLeftColor: COLORS.info }}>
            <div className="kpi-icon">🏦</div>
            <div className="kpi-info">
              <span className="kpi-label">{t("banked_amount")}</span>
              <span className="kpi-value">
                {formatCurrency(Number(stats.total_banked) || 0)}
              </span>
              <span className="kpi-subtitle">
                {(
                  ((Number(stats.total_banked) || 0) /
                    (Number(stats.total_sales) || 1)) *
                  100
                ).toFixed(1)}
                % {t("of_total")}
              </span>
            </div>
          </div>
        </Tippy>

        <Tippy
          content={t("cash_in_hand_tooltip")}
          placement="top"
          animation="scale"
        >
          <div className="kpi-card" style={{ borderLeftColor: COLORS.warning }}>
            <div className="kpi-icon">💵</div>
            <div className="kpi-info">
              <span className="kpi-label">{t("cash_in_hand")}</span>
              <span className="kpi-value">
                {formatCurrency(Number(stats.total_cash_in_hand) || 0)}
              </span>
              <span className="kpi-subtitle">{t("to_be_deposited")}</span>
            </div>
          </div>
        </Tippy>
      </div>

      {/* Graphique des ventes par entrepôt */}
      <div className="chart-card">
        <div className="chart-header">
          <h3>📊 {t("sales_by_warehouse")}</h3>
          <Tippy
            content={t("sales_chart_tooltip")}
            placement="top"
            animation="scale"
          >
            <span className="chart-info">ℹ️</span>
          </Tippy>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
              stroke={isDark ? "#94a3b8" : "#64748b"}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === t("sales"))
                  return [formatCurrency(value), t("sales")];
                if (name === t("collected"))
                  return [formatCurrency(value), t("collected")];
                return [formatCurrency(value), t("banked")];
              }}
              contentStyle={{
                backgroundColor: isDark ? "#1e293b" : "#ffffff",
                borderRadius: "12px",
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                color: isDark ? "#f1f5f9" : "#1e293b",
              }}
            />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            <Bar
              dataKey="ventes"
              name={t("sales")}
              fill={COLORS.primary}
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="collecte"
              name={t("collected")}
              fill={COLORS.success}
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="banque"
              name={t("banked")}
              fill={COLORS.info}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau des entrepôts */}
      <div className="warehouse-table-container">
        <div className="table-header">
          <h3>🏪 {t("warehouse_performance")}</h3>
          <span className="table-info">
            {warehouses.length} {t("warehouses_active")}
          </span>
        </div>
        <div className="table-responsive">
          <table className="warehouse-table">
            <thead>
              <tr>
                <th>{t("warehouse")}</th>
                <th>{t("manager")}</th>
                <th>{t("daily_sales")}</th>
                <th>{t("collection_status")}</th>
                <th>{t("collector")}</th>
                <th>{t("collected")}</th>
                <th>{t("banked")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse, idx) => (
                <tr
                  key={idx}
                  className={`status-${warehouse.collected_status || "pending"}`}
                >
                  <td className="warehouse-name">
                    <span className="warehouse-icon">🏪</span>
                    {warehouse.name}
                  </td>
                  <td>
                    <div className="manager-info">
                      <span className="manager-icon">👤</span>
                      {warehouse.manager_name || "-"}
                    </div>
                  </td>
                  <td className="sales-amount">
                    <span className="amount-icon">💰</span>
                    {formatCurrency(Number(warehouse.daily_sales) || 0)}
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${warehouse.collected_status || "pending"}`}
                    >
                      {getStatusIcon(warehouse.collected_status)}{" "}
                      {getStatusLabel(warehouse.collected_status, t)}
                    </span>
                  </td>
                  <td>
                    {warehouse.collector_name ? (
                      <div className="collector-info">
                        <span className="collector-icon">👤</span>
                        {warehouse.collector_name}
                      </div>
                    ) : (
                      <span className="no-collector">-</span>
                    )}
                  </td>
                  <td
                    className={
                      Number(warehouse.collected_amount) > 0
                        ? "collected-amount"
                        : ""
                    }
                  >
                    {Number(warehouse.collected_amount) > 0
                      ? formatCurrency(Number(warehouse.collected_amount))
                      : "-"}
                  </td>
                  <td
                    className={
                      Number(warehouse.banked_amount) > 0 ? "banked-amount" : ""
                    }
                  >
                    {Number(warehouse.banked_amount) > 0 ? (
                      <div>
                        {formatCurrency(Number(warehouse.banked_amount))}
                        {warehouse.bank_reference && (
                          <Tippy
                            content={`${t("bank_reference")}: ${warehouse.bank_reference}`}
                            placement="top"
                          >
                            <small className="bank-ref">📋</small>
                          </Tippy>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    <div className="action-buttons">
                      {warehouse.collected_status !== "collected" &&
                        warehouse.daily_sales > 0 && (
                          <Tippy
                            content={t("mark_as_collected_tooltip")}
                            placement="top"
                            animation="scale"
                          >
                            <button
                              className="btn-collect"
                              onClick={() => handleMarkAsCollected(warehouse)}
                              disabled={actionLoading === "collect"}
                            >
                              {actionLoading === "collect" ? (
                                <span className="btn-spinner-small"></span>
                              ) : (
                                "📥"
                              )}{" "}
                              {t("collect")}
                            </button>
                          </Tippy>
                        )}
                      {warehouse.collected_status === "collected" &&
                        warehouse.banked_amount === 0 &&
                        warehouse.collected_amount > 0 && (
                          <Tippy
                            content={t("mark_as_banked_tooltip")}
                            placement="top"
                            animation="scale"
                          >
                            <button
                              className="btn-bank"
                              onClick={() => handleMarkAsBanked(warehouse)}
                              disabled={actionLoading === "bank"}
                            >
                              {actionLoading === "bank" ? (
                                <span className="btn-spinner-small"></span>
                              ) : (
                                "🏦"
                              )}{" "}
                              {t("bank")}
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
      </div>

      {/* Footer avec totaux et graphiques */}
      <div className="footer-summary">
        <div className="summary-card">
          <div className="summary-header">
            <h3>🏢 {t("company_total")}</h3>
            <Tippy
              content={t("company_total_tooltip")}
              placement="top"
              animation="scale"
            >
              <span className="info-icon">ℹ️</span>
            </Tippy>
          </div>
          <div className="summary-content">
            <div className="summary-item">
              <span>{t("total_sales")}</span>
              <strong>{formatCurrency(Number(stats.total_sales) || 0)}</strong>
            </div>
            <div className="summary-item">
              <span>{t("total_collected")}</span>
              <strong className="text-success">
                {formatCurrency(Number(stats.total_collected) || 0)}
              </strong>
            </div>
            <div className="summary-item">
              <span>{t("total_banked")}</span>
              <strong className="text-info">
                {formatCurrency(Number(stats.total_banked) || 0)}
              </strong>
            </div>
            <div className="summary-item">
              <span>{t("cash_in_hand")}</span>
              <strong className="text-warning">
                {formatCurrency(Number(stats.total_cash_in_hand) || 0)}
              </strong>
            </div>
            <div className="summary-item">
              <span>{t("pending_collection")}</span>
              <strong className="text-danger">
                {formatCurrency(Number(stats.pending_collection) || 0)}
              </strong>
            </div>
            <div className="summary-divider"></div>
            <div className="summary-item">
              <span>{t("completion_rate")}</span>
              <strong>{Number(stats.completion_rate) || 0}%</strong>
            </div>
            <div className="progress-bar-container">
              <Tippy
                content={`${Number(stats.completion_rate) || 0}% ${t("completed")}`}
                placement="top"
              >
                <div
                  className="progress-bar"
                  style={{ width: `${Number(stats.completion_rate) || 0}%` }}
                ></div>
              </Tippy>
            </div>
          </div>
          {dailyReport?.attachment_path && (
            <div className="report-attachment">
              <span>📎 {t("bank_proof")}:</span>
              <a
                href={publicAssetUrl(dailyReport.attachment_path)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("view_proof")}
              </a>
            </div>
          )}
          {dailyReport?.approved_at && (
            <div className="report-meta">
              <span>
                ✅ {t("report_approved")}:{" "}
                {new Date(dailyReport.approved_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="stats-cards">
          <div className="pie-card">
            <h3>📊 {t("collection_distribution")}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={{
                    stroke: isDark ? "#94a3b8" : "#94a3b8",
                    strokeWidth: 1,
                  }}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(1)}%`
                  }
                  outerRadius={80}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={isDark ? "#1e293b" : "white"}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1e293b" : "#ffffff",
                    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                    color: isDark ? "#f1f5f9" : "#1e293b",
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend
                  wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="status-card">
            <h3>🏪 {t("warehouse_status")}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={{
                    stroke: isDark ? "#94a3b8" : "#94a3b8",
                    strokeWidth: 1,
                  }}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={isDark ? "#1e293b" : "white"}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1e293b" : "#ffffff",
                    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                    color: isDark ? "#f1f5f9" : "#1e293b",
                  }}
                />
                <Legend
                  wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* MODAL COLLECTE */}
      {collectionModalOpen && selectedWarehouse && (
        <div
          className="modal-overlay"
          onClick={() => setCollectionModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">📥</span>
              <h3>
                {t("confirm_collection")} - {selectedWarehouse.name}
              </h3>
              <button
                className="modal-close"
                onClick={() => setCollectionModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="info-box">
                <div className="info-row">
                  <span>{t("warehouse")}:</span>
                  <strong>{selectedWarehouse.name}</strong>
                </div>
                <div className="info-row">
                  <span>{t("manager")}:</span>
                  <strong>{selectedWarehouse.manager_name || "-"}</strong>
                </div>
                <div className="info-row">
                  <span>{t("daily_sales")}:</span>
                  <strong className="text-primary">
                    {formatCurrency(Number(selectedWarehouse.daily_sales) || 0)}
                  </strong>
                </div>
              </div>
              <div className="form-group">
                <label>{t("collection_amount")} *</label>
                <input
                  type="number"
                  value={collectionAmount}
                  onChange={(e) =>
                    setCollectionAmount(Number(e.target.value) || 0)
                  }
                  className="amount-input"
                  max={Number(selectedWarehouse.daily_sales) || 0}
                />
                <small>
                  {t("max_amount")}:{" "}
                  {formatCurrency(Number(selectedWarehouse.daily_sales) || 0)}
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setCollectionModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={confirmCollection}
                disabled={actionLoading === "collect"}
              >
                {actionLoading === "collect" ? (
                  <span className="btn-spinner"></span>
                ) : (
                  "✅"
                )}{" "}
                {t("confirm_collection_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DÉPÔT BANCAIRE */}
      {bankModalOpen && selectedWarehouse && (
        <div className="modal-overlay" onClick={() => setBankModalOpen(false)}>
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">🏦</span>
              <h3>
                {t("bank_deposit")} - {selectedWarehouse.name}
              </h3>
              <button
                className="modal-close"
                onClick={() => setBankModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="info-box">
                <div className="info-row">
                  <span>{t("warehouse")}:</span>
                  <strong>{selectedWarehouse.name}</strong>
                </div>
                <div className="info-row">
                  <span>{t("amount_to_deposit")}:</span>
                  <strong className="text-primary">
                    {formatCurrency(Number(bankAmount) || 0)}
                  </strong>
                </div>
              </div>
              <div className="form-group">
                <label>{t("bank_reference")} *</label>
                <input
                  type="text"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder={t("enter_bank_reference")}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t("bank_slip")}</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setBankSlip(e.target.files[0])}
                />
                <small>{t("upload_bank_slip_hint")}</small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setBankModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={confirmBankDeposit}
                disabled={actionLoading === "bank"}
              >
                {actionLoading === "bank" ? (
                  <span className="btn-spinner"></span>
                ) : (
                  "🏦"
                )}{" "}
                {t("confirm_deposit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GÉNÉRATION RAPPORT */}
      {reportModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setReportModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">📄</span>
              <h3>{t("generate_daily_report")}</h3>
              <button
                className="modal-close"
                onClick={() => setReportModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="info-box">
                <div className="info-row">
                  <span>{t("report_date")}:</span>
                  <strong>{new Date(selectedDate).toLocaleDateString()}</strong>
                </div>
                <div className="info-row">
                  <span>{t("total_sales")}:</span>
                  <strong>
                    {formatCurrency(Number(stats.total_sales) || 0)}
                  </strong>
                </div>
                <div className="info-row">
                  <span>{t("total_collected")}:</span>
                  <strong>
                    {formatCurrency(Number(stats.total_collected) || 0)}
                  </strong>
                </div>
                <div className="info-row">
                  <span>{t("total_banked")}:</span>
                  <strong>
                    {formatCurrency(Number(stats.total_banked) || 0)}
                  </strong>
                </div>
              </div>
              <div className="form-group">
                <label>{t("bank_proof")}</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReportAttachment(e.target.files[0])}
                />
                <small>{t("upload_proof_hint")}</small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setReportModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={handleGenerateReport}
                disabled={actionLoading === "report"}
              >
                {actionLoading === "report" ? (
                  <span className="btn-spinner"></span>
                ) : (
                  "📄"
                )}{" "}
                {t("generate")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sales-dashboard {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .sales-dashboard.light {
          background: var(--bg-main);
        }
        
        .sales-dashboard.dark {
          background: var(--bg-main);
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .dashboard-header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--text-primary);
        }
        
        .dashboard-header p {
          color: var(--text-secondary);
          font-size: 14px;
        }
        
        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .date-picker {
          display: flex;
          gap: 8px;
          align-items: center;
          background: var(--bg-card);
          padding: 4px 8px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        
        .date-input {
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          background: transparent;
          color: var(--text-primary);
        }
        
        .date-input:focus {
          outline: none;
        }
        
        .btn-icon {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
          background: transparent;
          color: var(--text-primary);
        }
        
        .btn-icon:hover:not(:disabled) {
          background: var(--bg-main);
          transform: scale(1.05);
        }
        
        .btn-icon:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-report {
          padding: 10px 20px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .btn-report:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        
        .btn-report:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        
        .kpi-card {
          background: var(--bg-card);
          border-radius: 20px;
          padding: 22px;
          display: flex;
          align-items: center;
          gap: 18px;
          border-left: 4px solid;
          border: 1px solid var(--border);
          border-left-width: 4px;
          transition: all 0.3s;
          cursor: pointer;
        }
        
        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        
        .kpi-icon {
          font-size: 44px;
        }
        
        .kpi-info {
          flex: 1;
        }
        
        .kpi-label {
          font-size: 12px;
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
          margin-top: 4px;
        }
        
        .kpi-subtitle {
          font-size: 11px;
          color: var(--text-muted);
          display: block;
          margin-top: 4px;
        }
        
        .chart-card {
          background: var(--bg-card);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }
        
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .chart-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .chart-info {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--bg-main);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: help;
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .warehouse-table-container {
          background: var(--bg-card);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--border);
        }
        
        .table-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .table-info {
          font-size: 12px;
          color: var(--text-secondary);
          padding: 4px 12px;
          background: var(--bg-main);
          border-radius: 20px;
        }
        
        .table-responsive {
          overflow-x: auto;
        }
        
        .warehouse-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .warehouse-table th, .warehouse-table td {
          padding: 14px 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .warehouse-table th {
          background: var(--bg-header);
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .warehouse-name {
          font-weight: 600;
          color: #667eea;
        }
        
        .warehouse-icon, .manager-icon, .collector-icon, .amount-icon {
          margin-right: 8px;
          opacity: 0.7;
        }
        
        .manager-info, .collector-info {
          display: flex;
          align-items: center;
        }
        
        .sales-amount {
          font-weight: 700;
          color: #10b981;
        }
        
        .collected-amount {
          color: #10b981;
          font-weight: 600;
        }
        
        .banked-amount {
          color: #3b82f6;
          font-weight: 600;
        }
        
        .bank-ref {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          color: var(--text-secondary);
          cursor: help;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .status-collected {
          background: rgba(16,185,129,0.1);
          color: #065f46;
        }
        
        .status-banked {
          background: rgba(59,130,246,0.1);
          color: #1e40af;
        }
        
        .status-pending {
          background: rgba(245,158,11,0.1);
          color: #92400e;
        }
        
        .action-buttons {
          display: flex;
          gap: 8px;
        }
        
        .btn-collect, .btn-bank {
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        .btn-collect {
          background: rgba(16,185,129,0.1);
          color: #065f46;
        }
        
        .btn-collect:hover:not(:disabled) {
          background: rgba(16,185,129,0.2);
          transform: translateY(-1px);
        }
        
        .btn-bank {
          background: rgba(59,130,246,0.1);
          color: #1e40af;
        }
        
        .btn-bank:hover:not(:disabled) {
          background: rgba(59,130,246,0.2);
          transform: translateY(-1px);
        }
        
        .btn-collect:disabled, .btn-bank:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .footer-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        .summary-card, .pie-card, .status-card {
          background: var(--bg-card);
          border-radius: 24px;
          padding: 24px;
          border: 1px solid var(--border);
        }
        
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--border);
        }
        
        .summary-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .info-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--bg-main);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: help;
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .stats-cards {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .summary-content {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        
        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          color: var(--text-primary);
        }
        
        .summary-divider {
          height: 1px;
          background: var(--border);
          margin: 8px 0;
        }
        
        .progress-bar-container {
          height: 8px;
          background: var(--border);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 8px;
        }
        
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          border-radius: 4px;
          transition: width 0.3s;
        }
        
        .text-success { color: #10b981; }
        .text-info { color: #3b82f6; }
        .text-warning { color: #f59e0b; }
        .text-danger { color: #ef4444; }
        .text-primary { color: #667eea; }
        
        .report-attachment, .report-meta {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .report-attachment a {
          color: #667eea;
          text-decoration: none;
          margin-left: 8px;
        }
        
        .report-attachment a:hover {
          text-decoration: underline;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-container {
          background: var(--bg-card);
          border-radius: 24px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
          animation: modalIn 0.3s ease;
          border: 1px solid var(--border);
        }
        
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .modal-header {
          padding: 20px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 24px 24px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-icon {
          font-size: 24px;
          margin-right: 12px;
        }
        
        .modal-header h3 {
          flex: 1;
          margin: 0;
        }
        
        .modal-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 12px;
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
        }
        
        .info-box {
          background: var(--bg-main);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 20px;
          border: 1px solid var(--border);
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed var(--border);
          color: var(--text-primary);
        }
        
        .info-row:last-child {
          border-bottom: none;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .form-group input, .amount-input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 14px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .form-group input:focus, .amount-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .form-group small {
          font-size: 11px;
          color: var(--text-secondary);
          display: block;
          margin-top: 6px;
        }
        
        .btn-primary {
          padding: 12px 28px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
          padding: 12px 28px;
          background: var(--bg-main);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-card);
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
        
        .btn-spinner-small {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 1024px) {
          .footer-summary {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .sales-dashboard {
            padding: 16px;
          }
          .kpi-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-header {
            flex-direction: column;
            align-items: stretch;
          }
          .header-actions {
            flex-direction: column;
          }
          .date-picker {
            width: 100%;
            justify-content: space-between;
          }
          .date-input {
            flex: 1;
          }
          .btn-report {
            width: 100%;
            justify-content: center;
          }
          .modal-container {
            width: 95%;
          }
        }
      `}</style>
    </div>
  );
};

export default SalesDashboard;
