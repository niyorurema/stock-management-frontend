// frontend/src/components/charts/DailyPerformanceByWarehouseChart.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from "recharts";
import { reportService } from "../../services/apiService";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import Loader from "../common/Loader";
import Select from "react-select";
import { getSelectStyles } from "../../utils/selectTheme";

const DailyPerformanceByWarehouseChart = ({
  startDate,
  endDate,
  height = 500,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [chartType, setChartType] = useState("line");
  const [activeSeries, setActiveSeries] = useState({
    sales: true,
    feesCollected: true,
    feesBanked: true,
    invoices: true,
  });

  // Couleurs professionnelles
  const colors = {
    sales: "#10b981",
    feesCollected: "#f59e0b",
    feesBanked: "#3b82f6",
    invoices: "#8b5cf6",
    salesArea: "rgba(16, 185, 129, 0.1)",
    feesCollectedArea: "rgba(245, 158, 11, 0.1)",
    feesBankedArea: "rgba(59, 130, 246, 0.1)",
  };

  // Options pour le select des entrepôts
  const warehouseOptions = useMemo(() => {
    return warehouses.map((w) => ({
      value: w.id,
      label: `${w.name} (${w.code})`,
    }));
  }, [warehouses]);

  // Formatage des nombres
  const formatCurrency = (value) => {
    /*if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M FBu`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k FBu`;*/
    //return new Intl.NumberFormat("fr-BI").format(value || 0) + " FBu";
    return (
      new Intl.NumberFormat("fr-BI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(value || 0) + " BIF"
    );
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat("fr-BI").format(value || 0);
  };

  // Formatage des ticks de l'axe Y avec intervalles fixes (0, 500k, 1000k, 1500k...)
  const formatYAxisTick = (value) => {
    if (value === 0) return "0";
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return `${value}`;
  };

  // Calculer l'intervalle maximum et générer des ticks personnalisés
  const getYAxisTicks = () => {
    // Calculer la valeur maximale parmi toutes les séries de montants
    const maxSales = Math.max(...data.map((d) => d.total_sales || 0), 0);
    const maxFees = Math.max(...data.map((d) => d.fees_collected || 0), 0);
    const maxBanked = Math.max(...data.map((d) => d.fees_banked || 0), 0);
    const maxValue = maxSales;
    //Math.max(maxSales, maxFees, maxBanked);

    // Déterminer l'intervalle (500k)
    const interval = 500000; // 500,000 FBu
    const maxTick = maxValue;
    //Math.ceil(maxValue / interval) * interval;

    // Générer les ticks: 0, 500k, 1000k, 1500k, ...
    const ticks = [];
    for (let i = 0; i <= maxValue / interval; i++) {
      ticks.push(i * interval);
    }

    return ticks;
  };

  // Calculer les ticks pour l'axe droit (nombre de factures)
  const getYAxisRightTicks = () => {
    const maxInvoices = Math.max(...data.map((d) => d.invoice_count || 0), 1);
    const interval = Math.ceil(maxInvoices); // 5 ticks maximum
    const ticks = [];
    for (let i = 0; i <= maxInvoices; i += interval) {
      ticks.push(i);
    }
    // S'assurer que le max est inclus
    if (ticks[ticks.length - 1] < maxInvoices) {
      ticks.push(maxInvoices);
    }
    return ticks;
  };

  // Chargement des données
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
      };
      if (selectedWarehouse) {
        params.warehouse_id = selectedWarehouse.value;
      }

      const response = await reportService.getDailyPerformance(params);
      if (response.data?.success) {
        setData(response.data.data.daily || []);
        setSummary(response.data.data.summary || {});
        setWarehouses(response.data.data.warehouses || []);
      }
    } catch (error) {
      console.error("Erreur chargement performances:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedWarehouse]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSeries = (series) => {
    setActiveSeries((prev) => ({ ...prev, [series]: !prev[series] }));
  };

  const formatCompactCurrency = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return `${value}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const sortedPayload = [...payload].sort((a, b) => {
        const order = {
          sales: 0,
          feesCollected: 1,
          feesBanked: 2,
          invoices: 3,
        };
        return (order[a.dataKey] || 99) - (order[b.dataKey] || 99);
      });

      return (
        <div
          style={{
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            borderRadius: "12px",
            padding: "12px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "240px",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              fontWeight: "bold",
              color: isDark ? "#f1f5f9" : "#1e293b",
              borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              paddingBottom: "6px",
            }}
          >
            📅 {label}
          </p>
          {sortedPayload.map((item, index) => (
            <p key={index} style={{ margin: "4px 0", color: item.color }}>
              <span style={{ fontWeight: "bold" }}>{item.name}:</span>{" "}
              {item.dataKey === "invoice_count"
                ? formatNumber(item.value)
                : formatCurrency(item.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div
        className="chart-loading"
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader size="medium" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="no-data-chart"
        style={{
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 48, opacity: 0.5 }}>📊</span>
        <p style={{ marginTop: 16, color: isDark ? "#94a3b8" : "#64748b" }}>
          {t("no_data_available")}
        </p>
      </div>
    );
  }

  const yAxisTicks = getYAxisTicks();
  const yAxisRightTicks = getYAxisRightTicks();

  return (
    <div className="daily-performance-warehouse-chart">
      {/* Filtres */}
      <div
        className="chart-filters"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
          padding: 16,
          background: isDark ? "#1e293b" : "#ffffff",
          borderRadius: 16,
          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {warehouses.length > 0 && (
            <div style={{ minWidth: 250 }}>
              <Select
                options={warehouseOptions}
                value={selectedWarehouse}
                onChange={setSelectedWarehouse}
                placeholder={t("all_warehouses")}
                isClearable
                styles={getSelectStyles(isDark)}
                classNamePrefix="warehouse-select"
              />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setChartType("line")}
            style={{
              padding: "6px 14px",
              background: chartType === "line" ? colors.sales : "transparent",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              borderRadius: 8,
              cursor: "pointer",
              color:
                chartType === "line" ? "white" : isDark ? "#f1f5f9" : "#1e293b",
            }}
          >
            📈 {t("line_chart")}
          </button>
          <button
            onClick={() => setChartType("bar")}
            style={{
              padding: "6px 14px",
              background: chartType === "bar" ? colors.sales : "transparent",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              borderRadius: 8,
              cursor: "pointer",
              color:
                chartType === "bar" ? "white" : isDark ? "#f1f5f9" : "#1e293b",
            }}
          >
            📊 {t("bar_chart")}
          </button>
          <button
            onClick={() => setChartType("composed")}
            style={{
              padding: "6px 14px",
              background:
                chartType === "composed" ? colors.sales : "transparent",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              borderRadius: 8,
              cursor: "pointer",
              color:
                chartType === "composed"
                  ? "white"
                  : isDark
                    ? "#f1f5f9"
                    : "#1e293b",
            }}
          >
            🎯 {t("composed_chart")}
          </button>
        </div>
      </div>

      {/* Résumé des statistiques */}
      <div
        className="chart-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 24,
          padding: 16,
          background: isDark ? "#1e293b" : "#ffffff",
          borderRadius: 16,
          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        }}
      >
        <div className="summary-card">
          <div
            className="summary-label"
            style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}
          >
            💰 {t("total_sales")}
          </div>
          <div
            className="summary-value"
            style={{ fontSize: 20, fontWeight: "bold", color: colors.sales }}
          >
            {formatCurrency(summary.total_sales)}
          </div>
        </div>
        <div className="summary-card">
          <div
            className="summary-label"
            style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}
          >
            📋 {t("total_invoices")}
          </div>
          <div
            className="summary-value"
            style={{ fontSize: 20, fontWeight: "bold", color: colors.invoices }}
          >
            {formatNumber(summary.total_invoices)}
          </div>
        </div>
        <div className="summary-card">
          <div
            className="summary-label"
            style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}
          >
            📊 {t("fees_collected")}
          </div>
          <div
            className="summary-value"
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: colors.feesCollected,
            }}
          >
            {formatCurrency(summary.total_fees_collected)}
          </div>
        </div>
        <div className="summary-card">
          <div
            className="summary-label"
            style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}
          >
            🏦 {t("fees_banked")}
          </div>
          <div
            className="summary-value"
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: colors.feesBanked,
            }}
          >
            {formatCurrency(summary.total_fees_banked)}
          </div>
        </div>
        <div className="summary-card">
          <div
            className="summary-label"
            style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}
          >
            📈 {t("collection_rate")}
          </div>
          <div
            className="summary-value"
            style={{ fontSize: 20, fontWeight: "bold" }}
          >
            {summary.collection_rate?.toFixed(1)}%
          </div>
        </div>
        <div className="summary-card">
          <div
            className="summary-label"
            style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}
          >
            🏦 {t("banking_rate")}
          </div>
          <div
            className="summary-value"
            style={{ fontSize: 20, fontWeight: "bold" }}
          >
            {summary.banking_rate?.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Sélecteurs de séries */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          marginBottom: 20,
          flexWrap: "wrap",
          padding: "8px 16px",
          background: isDark ? "#1e293b" : "#ffffff",
          borderRadius: 12,
          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={activeSeries.sales}
            onChange={() => toggleSeries("sales")}
          />
          <span style={{ color: colors.sales, fontWeight: 500 }}>
            💰 {t("sales")}
          </span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={activeSeries.feesCollected}
            onChange={() => toggleSeries("feesCollected")}
          />
          <span style={{ color: colors.feesCollected, fontWeight: 500 }}>
            📊 {t("fees_collected")}
          </span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={activeSeries.feesBanked}
            onChange={() => toggleSeries("feesBanked")}
          />
          <span style={{ color: colors.feesBanked, fontWeight: 500 }}>
            🏦 {t("fees_banked")}
          </span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={activeSeries.invoices}
            onChange={() => toggleSeries("invoices")}
          />
          <span style={{ color: colors.invoices, fontWeight: 500 }}>
            📋 {t("invoice_count")}
          </span>
        </label>
      </div>

      {/* Graphique principal avec intervalles fixes sur l'axe Y */}
      {/* <ResponsiveContainer width="100%" height={height - 280}>
        {chartType === "bar" ? (
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="formatted_date"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
              interval={Math.floor(data.length / 10)}
            />
            <YAxis
              yAxisId="left"
              domain={[0, "auto"]}
              ticks={yAxisTicks}
              tickFormatter={formatYAxisTick}
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
              label={{
                value: t("amount"),
                angle: -90,
                position: "insideLeft",
                offset: -30,
                style: {
                  fill: isDark ? "#94a3b8" : "#64748b",
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, "auto"]}
              ticks={yAxisRightTicks}
              tickFormatter={(v) => formatNumber(v)}
              stroke={colors.invoices}
              tick={{ fill: colors.invoices }}
              label={{
                value: t("invoice_count"),
                angle: 90,
                position: "insideRight",
                offset: -30,
                style: { fill: colors.invoices, fontSize: 12, fontWeight: 500 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            {activeSeries.sales && (
              <Bar
                yAxisId="left"
                dataKey="total_sales"
                name={t("sales")}
                fill={colors.sales}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.feesCollected && (
              <Bar
                yAxisId="left"
                dataKey="fees_collected"
                name={t("fees_collected")}
                fill={colors.feesCollected}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.feesBanked && (
              <Bar
                yAxisId="left"
                dataKey="fees_banked"
                name={t("fees_banked")}
                fill={colors.feesBanked}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.invoices && (
              <Bar
                yAxisId="right"
                dataKey="invoice_count"
                name={t("invoice_count")}
                fill={colors.invoices}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="formatted_date"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
              interval={Math.floor(data.length / 10)}
            />
            <YAxis
              yAxisId="left"
              domain={[0, "auto"]}
              ticks={yAxisTicks}
              tickFormatter={formatYAxisTick}
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
              label={{
                value: t("amount"),
                angle: -90,
                position: "insideLeft",
                offset: -30,
                style: {
                  fill: isDark ? "#94a3b8" : "#64748b",
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, "auto"]}
              ticks={yAxisRightTicks}
              tickFormatter={(v) => formatNumber(v)}
              stroke={colors.invoices}
              tick={{ fill: colors.invoices }}
              label={{
                value: t("invoice_count"),
                angle: 90,
                position: "insideRight",
                offset: -30,
                style: { fill: colors.invoices, fontSize: 12, fontWeight: 500 },
              }}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            {activeSeries.sales && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total_sales"
                name={t("sales")}
                stroke={colors.sales}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            {activeSeries.feesCollected && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fees_collected"
                name={t("fees_collected")}
                stroke={colors.feesCollected}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            {activeSeries.feesBanked && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fees_banked"
                name={t("fees_banked")}
                stroke={colors.feesBanked}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            {activeSeries.invoices && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="invoice_count"
                name={t("invoice_count")}
                stroke={colors.invoices}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        ) : (
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="formatted_date"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
              interval={Math.floor(data.length / 10)}
            />
            <YAxis
              yAxisId="left"
              domain={[0, "auto"]}
              ticks={yAxisTicks}
              tickFormatter={formatYAxisTick}
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
              label={{
                value: t("amount"),
                angle: -90,
                position: "insideLeft",
                offset: -30,
                style: {
                  fill: isDark ? "#94a3b8" : "#64748b",
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, "auto"]}
              ticks={yAxisRightTicks}
              tickFormatter={(v) => formatNumber(v)}
              stroke={colors.invoices}
              tick={{ fill: colors.invoices }}
              label={{
                value: t("invoice_count"),
                angle: 90,
                position: "insideRight",
                offset: -30,
                style: { fill: colors.invoices, fontSize: 12, fontWeight: 500 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            {activeSeries.sales && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_sales"
                name={t("sales")}
                stroke={colors.sales}
                fill={colors.salesArea}
              />
            )}
            {activeSeries.feesCollected && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fees_collected"
                name={t("fees_collected")}
                stroke={colors.feesCollected}
                strokeWidth={2}
              />
            )}
            {activeSeries.feesBanked && (
              <Bar
                yAxisId="left"
                dataKey="fees_banked"
                name={t("fees_banked")}
                fill={colors.feesBanked}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.invoices && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="invoice_count"
                name={t("invoice_count")}
                stroke={colors.invoices}
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        )}
      </ResponsiveContainer> */}

      {/* Graphique principal */}
      <ResponsiveContainer width="100%" height={height - 180}>
        {chartType === "bar" ? (
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="formatted_date"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatCompactCurrency}
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatNumber(v)}
              stroke={colors.invoices}
              tick={{ fill: colors.invoices }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            {activeSeries.sales && (
              <Bar
                yAxisId="left"
                dataKey="total_sales"
                name={t("sales")}
                fill={colors.sales}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.feesCollected && (
              <Bar
                yAxisId="left"
                dataKey="fees_collected"
                name={t("fees_collected")}
                fill={colors.feesCollected}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.feesBanked && (
              <Bar
                yAxisId="left"
                dataKey="fees_banked"
                name={t("fees_banked")}
                fill={colors.feesBanked}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.invoices && (
              <Bar
                yAxisId="right"
                dataKey="invoice_count"
                name={t("invoice_count")}
                fill={colors.invoices}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="formatted_date"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatCompactCurrency}
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatNumber(v)}
              stroke={colors.invoices}
              tick={{ fill: colors.invoices }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            {activeSeries.sales && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total_sales"
                name={t("sales")}
                stroke={colors.sales}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            )}
            {activeSeries.feesCollected && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fees_collected"
                name={t("fees_collected")}
                stroke={colors.feesCollected}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            )}
            {activeSeries.feesBanked && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fees_banked"
                name={t("fees_banked")}
                stroke={colors.feesBanked}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            )}
            {activeSeries.invoices && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="invoice_count"
                name={t("invoice_count")}
                stroke={colors.invoices}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            )}
          </LineChart>
        ) : (
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="formatted_date"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatCompactCurrency}
              stroke={isDark ? "#94a3b8" : "#64748b"}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatNumber(v)}
              stroke={colors.invoices}
              tick={{ fill: colors.invoices }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            {activeSeries.sales && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_sales"
                name={t("sales")}
                stroke={colors.sales}
                fill={colors.salesArea}
              />
            )}
            {activeSeries.feesCollected && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fees_collected"
                name={t("fees_collected")}
                stroke={colors.feesCollected}
                strokeWidth={2}
              />
            )}
            {activeSeries.feesBanked && (
              <Bar
                yAxisId="left"
                dataKey="fees_banked"
                name={t("fees_banked")}
                fill={colors.feesBanked}
                radius={[4, 4, 0, 0]}
              />
            )}
            {activeSeries.invoices && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="invoice_count"
                name={t("invoice_count")}
                stroke={colors.invoices}
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Légende des intervalles */}
      {/* <div
        style={{
          marginTop: 16,
          textAlign: "center",
          fontSize: 11,
          color: isDark ? "#94a3b8" : "#64748b",
          padding: "8px",
          background: isDark ? "#1e293b" : "#ffffff",
          borderRadius: 8,
          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        }}
      >
        <span>
          📊 {t("y_axis_interval")}: 500k FBu (500,000 Francs Burundais)
        </span>
      </div> */}

      <style>{`
        .daily-performance-warehouse-chart {
          width: 100%;
          background: transparent;
        }
        
        .chart-loading, .no-data-chart {
          background: ${isDark ? "#1e293b" : "#ffffff"};
          border-radius: 16px;
          border: 1px solid ${isDark ? "#334155" : "#e2e8f0"};
        }
        
        .summary-card {
          text-align: center;
          padding: 8px;
          transition: transform 0.2s;
        }
        
        .summary-card:hover {
          transform: translateY(-2px);
        }

        .recharts-cartesian-axis-tick-value {
          fill: ${isDark ? "#94a3b8" : "#64748b"} !important;
        }
        
        .recharts-label {
          fill: ${isDark ? "#94a3b8" : "#64748b"} !important;
        }
      `}</style>
    </div>
  );
};

export default DailyPerformanceByWarehouseChart;
