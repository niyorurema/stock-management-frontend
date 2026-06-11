// frontend/src/components/common/ProductDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import { productService, stockService } from "../services/apiService";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";
import { authFetchJson } from "../utils/authFetch";

const ProductDetail = ({ productId: productIdProp, onClose: onCloseProp }) => {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const productId = productIdProp ?? routeId;
  const onClose = onCloseProp ?? (() => navigate("/products"));
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState({
    AED_to_USD: 3.6725,
    USD_to_BIF: 2830,
  });

  // Fonction utilitaire pour sécuriser les conversions de nombres
  const safeNumber = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  };

  // Formatage des nombres
  const formatNumber = (num) => {
    return new Intl.NumberFormat("fr-BI", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeNumber(num));
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat("fr-BI", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safeNumber(num));
  };

  useEffect(() => {
    if (productId) {
      loadProduct();
      loadMovements();
      loadExchangeRates();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      const response = await productService.getById(productId);
      setProduct(response.data?.data);
    } catch (error) {
      toast.error(t("error_loading_product"));
      onClose();
    }
  };

  const loadMovements = async () => {
    try {
      const response = await stockService.getMovements({
        product_id: productId,
        limit: 50,
      });
      setMovements(response.data?.data || []);
    } catch (error) {
      console.error("Erreur chargement mouvements:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExchangeRates = async () => {
    try {
      const { data: result } = await authFetchJson(
        "/api/exchange-rates/latest",
      );
      if (result.success) {
        setExchangeRates({
          AED_to_USD: safeNumber(result.data.AED_to_USD, 3.6725),
          USD_to_BIF: safeNumber(result.data.USD_to_BIF, 2830),
        });
      }
    } catch (error) {
      console.error("Erreur chargement taux de change:", error);
    }
  };

  const getStockStatus = (quantity, minAlert) => {
    const qty = safeNumber(quantity);
    const alert = safeNumber(minAlert);
    if (qty <= 0)
      return { label: t("out_of_stock"), color: "#dc2626", icon: "❌" };
    if (qty <= alert)
      return { label: t("low_stock"), color: "#f59e0b", icon: "⚠️" };
    return { label: t("in_stock"), color: "#10b981", icon: "✅" };
  };

  const movementTypes = {
    EN: { label: t("entry_normal"), icon: "📥", color: "#10b981" },
    ER: { label: t("entry_return"), icon: "🔄", color: "#10b981" },
    EI: { label: t("entry_inventory"), icon: "📋", color: "#10b981" },
    EAJ: { label: t("entry_adjustment"), icon: "⚙️", color: "#10b981" },
    ET: { label: t("entry_transfer"), icon: "🚚", color: "#10b981" },
    SN: { label: t("exit_normal"), icon: "📤", color: "#ef4444" },
    SP: { label: t("exit_loss"), icon: "⚠️", color: "#f59e0b" },
    SV: { label: t("exit_theft"), icon: "🚨", color: "#ef4444" },
    SD: { label: t("exit_obsolete"), icon: "⏰", color: "#f59e0b" },
    SC: { label: t("exit_damage"), icon: "💔", color: "#ef4444" },
    SAJ: { label: t("exit_adjustment"), icon: "⚙️", color: "#f59e0b" },
    ST: { label: t("exit_transfer"), icon: "🚚", color: "#f59e0b" },
  };

  if (loading) return <Loader />;
  if (!product) return null;

  console.log(product);

  // Valeurs sécurisées pour les calculs
  const purchasePriceAed = safeNumber(
    product.purchase_price_aed || product.purchase_price,
  );
  const purchasePriceUsd =
    safeNumber(product.purchase_price_usd) ||
    purchasePriceAed * exchangeRates.AED_to_USD;
  const purchasePriceBif =
    safeNumber(product.purchase_price_bif) ||
    purchasePriceUsd * exchangeRates.USD_to_BIF;
  const sellingPrice = safeNumber(product.selling_price);
  const stockQuantity = safeNumber(product.stock_quantity);
  const minStockAlert = safeNumber(product.min_stock_alert);
  const taxRate = safeNumber(product.tax_rate);
  const ctTaxRate = safeNumber(product.ct_tax_rate);
  const tlTaxRate = safeNumber(product.tl_tax_rate);
  const tsceTaxRate = safeNumber(product.tsce_tax);
  const ottTaxRate = safeNumber(product.ott_tax);
  const totalTaxRate =
    taxRate + ctTaxRate + tlTaxRate + tsceTaxRate + ottTaxRate;
  const expectedMargin = sellingPrice - purchasePriceBif;
  const marginPercent =
    sellingPrice > 0 ? (expectedMargin / sellingPrice) * 100 : 0;
  const stockValue = stockQuantity * purchasePriceBif;
  const totalPurchases = safeNumber(product.total_purchases);
  const totalSales = safeNumber(product.total_sales);
  const totalProfit = totalSales - totalPurchases;
  const turnoverRate = stockQuantity > 0 ? totalSales / stockQuantity : 0;

  const stockStatus = getStockStatus(stockQuantity, minStockAlert);

  const movementColumns = [
    { key: "date", label: t("date") },
    { key: "type", label: t("movement_type") },
    { key: "quantity", label: t("quantity") },
    { key: "warehouse", label: t("warehouse") },
    { key: "user", label: t("user") },
    { key: "description", label: t("description") },
  ];

  return (
    <div
      className={`product-detail-modal-overlay ${isDark ? "dark" : "light"}`}
      onClick={onClose}
    >
      <div
        className={`product-detail-modal ${isDark ? "dark" : "light"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="product-detail-modal-header">
          <h2>📦 {product.name}</h2>
          <Tippy content={t("close")} placement="left" animation="scale">
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          </Tippy>
        </div>

        <div className="product-detail-modal-body">
          <div className="product-badges">
            <div className="product-code-badge">
              🔖 {t("code")}: <strong>{product.code}</strong>
            </div>
            <div
              className="stock-status-badge"
              style={{
                backgroundColor: stockStatus.color + "20",
                color: stockStatus.color,
              }}
            >
              {stockStatus.icon} {stockStatus.label}
            </div>
            <div
              className={`status-badge ${product.is_active ? "active" : "inactive"}`}
            >
              {product.is_active ? "✅ " + t("active") : "❌ " + t("inactive")}
            </div>
          </div>

          <div className="detail-grid">
            {/* Informations générales */}
            <div className="detail-card">
              <h3>📋 {t("general_info")}</h3>
              <div className="detail-row">
                <span className="label">{t("name")}:</span>
                <span className="value">{product.name}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("code")}:</span>
                <span className="value code">{product.code}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("category")}:</span>
                <span className="value">{product.category_name || "-"}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("unit")}:</span>
                <span className="value">{product.unit || "PIECE"}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("description")}:</span>
                <span className="value description">
                  {product.description || "-"}
                </span>
              </div>
            </div>

            {/* Prix en différentes devises */}
            <div className="detail-card">
              <h3>💰 {t("pricing")}</h3>
              <div className="detail-row">
                <span className="label">{t("purchase_price_aed")}:</span>
                <span className="value price-aed">
                  {formatNumber(purchasePriceAed)} AED
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("purchase_price_usd")}:</span>
                <span className="value price-usd">
                  {formatNumber(purchasePriceUsd)} USD
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("purchase_price_bif")}:</span>
                <span className="value price-bif">
                  {formatNumber(purchasePriceBif)} FBu
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("selling_price")}:</span>
                <span className="value highlight">
                  {formatNumber(sellingPrice)} FBu
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("expected_margin")}:</span>
                <span
                  className={
                    expectedMargin >= 0
                      ? "value profit-positive"
                      : "value profit-negative"
                  }
                >
                  {formatNumber(expectedMargin)} FBu
                  {sellingPrice > 0 && (
                    <span className="margin-percent">
                      ({marginPercent.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Taxes */}
            <div className="detail-card">
              <h3>📊 {t("taxes")}</h3>
              <div className="detail-row">
                <span className="label">{t("tax_rate")} (TVA):</span>
                <span className="value">{taxRate.toFixed(2)}%</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("ct_tax")}:</span>
                <span className="value">{ctTaxRate.toFixed(2)}%</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("tl_tax")} (PFL):</span>
                <span className="value">{tlTaxRate.toFixed(2)}%</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("tsce_tax")}:</span>
                <span className="value">{tsceTaxRate.toFixed(2)}%</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("ott_tax")}:</span>
                <span className="value">{ottTaxRate.toFixed(2)}%</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("total_tax_rate")}:</span>
                <span className="value highlight">
                  {totalTaxRate.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Stock */}
            <div className="detail-card">
              <h3>📦 {t("stock_info")}</h3>
              <div className="detail-row">
                <span className="label">{t("available_stock")}:</span>
                <span className="value stock-quantity">
                  {Math.round(stockQuantity)} {product.unit || "PIECE"}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("reserved_stock")}:</span>
                <span className="value">
                  {formatNumber(safeNumber(product.reserved_quantity))}{" "}
                  {product.unit || "PIECE"}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("total_stock")}:</span>
                <span className="value">
                  {formatNumber(
                    safeNumber(product.total_stock || product.current_stock),
                  )}{" "}
                  {product.unit || "PIECE"}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("min_stock_alert")}:</span>
                <span className="value">
                  {minStockAlert} {product.unit || "PIECE"}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("stock_status")}:</span>
                <span className="value" style={{ color: stockStatus.color }}>
                  {stockStatus.icon} {stockStatus.label}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("stock_value")}:</span>
                <span className="value">{formatNumber(stockValue)} FBu</span>
              </div>
            </div>

            {/* Dates et métadonnées */}
            <div className="detail-card">
              <h3>⏰ {t("dates_metadata")}</h3>
              <div className="detail-row">
                <span className="label">{t("created_at")}:</span>
                <span className="value">
                  {new Date(product.created_at).toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("updated_at")}:</span>
                <span className="value">
                  {new Date(product.updated_at).toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("created_by")}:</span>
                <span className="value">{product.created_by || "-"}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("status")}:</span>
                <span className="value">
                  {product.is_active == 1
                    ? "✅ " + t("active")
                    : "❌ " + t("inactive")}
                </span>
              </div>
            </div>

            {/* Résumé des valeurs */}
            <div className="detail-card">
              <h3>📈 {t("summary")}</h3>
              <div className="detail-row">
                <span className="label">{t("total_purchases")}:</span>
                <span className="value">
                  {formatNumber(totalPurchases)} FBu
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("total_sales")}:</span>
                <span className="value">{formatNumber(totalSales)} FBu</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("total_profit")}:</span>
                <span className="value profit-positive">
                  {formatNumber(totalProfit)} FBu
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("turnover_rate")}:</span>
                <span className="value">{turnoverRate.toFixed(2)}x</span>
              </div>
            </div>
          </div>

          {/* Section des mouvements de stock */}
          <div className="movements-section">
            <h3>🔄 {t("stock_movements")}</h3>
            {movements.length === 0 ? (
              <div className="empty-movements">{t("no_movements")}</div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      {movementColumns.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement, idx) => {
                      const movementType = movement.movement_type;
                      const movementInfo = movementTypes[movementType] || {
                        label: movementType,
                        icon: "📦",
                        color: "#64748b",
                      };
                      const isExit = movementType?.startsWith("S");
                      return (
                        <tr key={idx}>
                          <td>
                            {new Date(movement.movement_date).toLocaleString()}
                          </td>
                          <td>
                            <span style={{ color: movementInfo.color }}>
                              {movementInfo.icon} {movementInfo.label}
                            </span>
                          </td>
                          <td className={isExit ? "negative" : "positive"}>
                            {isExit ? "-" : "+"}
                            {movement.quantity} {movement.unit || "PIECE"}
                          </td>
                          <td>{movement.warehouse_name || "-"}</td>
                          <td>{movement.user_name || "-"}</td>
                          <td>{movement.description || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="product-detail-modal-footer">
          <Tippy content={t("close")} placement="top" animation="scale">
            <button className="btn-secondary" onClick={onClose}>
              ✕ {t("close")}
            </button>
          </Tippy>
        </div>

        <style>{`
          .product-detail-modal-overlay {
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
            overflow-y: auto;
            padding: 20px;
          }
          
          .product-detail-modal {
            border-radius: 24px;
            width: 90%;
            max-width: 1200px;
            max-height: 90vh;
            overflow: auto;
            animation: modalIn 0.3s ease;
          }
          
          .product-detail-modal.light {
            background: var(--bg-card);
            border: 1px solid var(--border);
          }
          
          .product-detail-modal.dark {
            background: var(--bg-card);
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
          
          .product-detail-modal-header {
            padding: 20px 24px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 24px 24px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          
          .product-detail-modal-header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }
          
          .modal-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s;
          }
          
          .modal-close:hover {
            background: rgba(255,255,255,0.3);
            transform: rotate(90deg);
          }
          
          .product-detail-modal-body {
            padding: 24px;
          }
          
          .product-detail-modal-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            position: sticky;
            bottom: 0;
            background: var(--bg-card);
            border-radius: 0 0 24px 24px;
          }
          
          .product-badges {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          
          .product-code-badge {
            display: inline-block;
            background: var(--bg-main);
            padding: 6px 14px;
            border-radius: 20px;
            font-family: monospace;
            font-size: 12px;
            color: var(--text-primary);
            border: 1px solid var(--border);
          }
          
          .stock-status-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .status-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .status-badge.active {
            background: rgba(16,185,129,0.1);
            color: #10b981;
          }
          
          .status-badge.inactive {
            background: rgba(239,68,68,0.1);
            color: #dc2626;
          }
          
          .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
          }
          
          .detail-card {
            background: var(--bg-main);
            border-radius: 16px;
            padding: 18px;
            border: 1px solid var(--border);
          }
          
          .detail-card h3 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 14px;
            padding-bottom: 8px;
            border-bottom: 2px solid #667eea;
            display: inline-block;
            color: var(--text-primary);
          }
          
          .detail-row {
            display: flex;
            padding: 8px 0;
            font-size: 13px;
            border-bottom: 1px solid var(--border);
          }
          
          .detail-row:last-child {
            border-bottom: none;
          }
          
          .detail-row .label {
            width: 130px;
            font-weight: 500;
            color: var(--text-secondary);
          }
          
          .detail-row .value {
            flex: 1;
            color: var(--text-primary);
          }
          
          .detail-row .value.highlight {
            font-weight: 700;
            color: #667eea;
            font-size: 16px;
          }
          
          .detail-row .value.code {
            font-family: monospace;
            background: var(--bg-card);
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-block;
          }
          
          .detail-row .value.description {
            white-space: pre-wrap;
            word-break: break-word;
          }
          
          .detail-row .value.stock-quantity {
            font-weight: 700;
            font-size: 16px;
            color: #10b981;
          }
          
          .detail-row .value.price-aed {
            color: #f59e0b;
            font-weight: 600;
          }
          
          .detail-row .value.price-usd {
            color: #10b981;
            font-weight: 600;
          }
          
          .detail-row .value.price-bif {
            color: #3b82f6;
            font-weight: 600;
          }
          
          .profit-positive {
            color: #10b981;
            font-weight: 600;
          }
          
          .profit-negative {
            color: #ef4444;
            font-weight: 600;
          }
          
          .margin-percent {
            font-size: 11px;
            margin-left: 6px;
            color: var(--text-secondary);
          }
          
          .movements-section {
            background: var(--bg-main);
            border-radius: 16px;
            padding: 18px;
            border: 1px solid var(--border);
          }
          
          .movements-section h3 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 14px;
            padding-bottom: 8px;
            border-bottom: 2px solid #667eea;
            display: inline-block;
            color: var(--text-primary);
          }
          
          .empty-movements {
            text-align: center;
            padding: 40px;
            color: var(--text-secondary);
          }
          
          .table-responsive {
            overflow-x: auto;
          }
          
          .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          
          .data-table th {
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            background: var(--bg-header);
            border-bottom: 1px solid var(--border);
            color: var(--text-primary);
            position: sticky;
            top: 0;
          }
          
          .data-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            color: var(--text-primary);
          }
          
          .data-table tbody tr:hover {
            background: var(--bg-main);
          }
          
          .positive {
            color: #10b981;
            font-weight: 500;
          }
          
          .negative {
            color: #ef4444;
            font-weight: 500;
          }
          
          .btn-secondary {
            padding: 10px 24px;
            background: var(--bg-main);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 10px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
          }
          
          .btn-secondary:hover {
            background: var(--bg-card);
            transform: translateY(-1px);
          }
          
          /* Responsive */
          @media (max-width: 768px) {
            .product-detail-modal {
              width: 95%;
            }
            
            .detail-grid {
              grid-template-columns: 1fr;
            }
            
            .detail-row {
              flex-direction: column;
            }
            
            .detail-row .label {
              width: 100%;
              margin-bottom: 4px;
            }
            
            .product-badges {
              flex-direction: column;
              align-items: flex-start;
            }
            
            .product-detail-modal-header h2 {
              font-size: 18px;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ProductDetail;
