// frontend/src/pages/Warehouses.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import Swal from "sweetalert2";
import { useLanguage } from "../contexts/LanguageContext";
import { useAction } from "../contexts/ActionContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";
import { warehouseService, getApiErrorMessage } from "../services/apiService";

const Warehouses = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const location = useLocation();
  const isDark = theme === "dark";

  // ========== 1. TOUS LES useState ==========
  // États principaux
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState("all");

  // États des filtres
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [activeFilters, setActiveFilters] = useState({});
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);

  // États des modaux
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // États pour le formulaire
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    manager_name: "",
    phone: "",
    email: "",
    description: "",
    is_active: true,
  });

  // Loaders et refs
  const [submitLoading, setSubmitLoading] = useState(false);
  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);

  // Statistiques
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalStockValue: 0,
  });

  // ========== 2. FONCTIONS DE CALCUL ==========
  const calculateStats = useCallback((warehousesList) => {
    const activeCount = warehousesList.filter(
      (w) => w.is_active === "1",
    ).length;
    const totalStockValue = warehousesList.reduce((sum, w) => {
      const value = Number(w.stock_value);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    setStats({
      total: warehousesList.length,
      active: activeCount,
      inactive: warehousesList.length - activeCount,
      totalStockValue: totalStockValue,
    });
  }, []);

  // ========== 3. FONCTIONS UTILITAIRES ==========
  const showConfirmDialog = async (
    title,
    text,
    confirmButtonText,
    confirmButtonColor = "#10b981",
  ) => {
    const result = await Swal.fire({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor,
      cancelButtonColor: "#64748b",
      confirmButtonText,
      cancelButtonText: t("cancel"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
    });
    return result.isConfirmed;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      manager_name: "",
      phone: "",
      email: "",
      description: "",
      is_active: true,
    });
    setEditingWarehouse(null);
  };

  // ========== 4. CHARGEMENT DES DONNÉES ==========
  const loadWarehouses = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isMounted.current) return;

    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterActive !== "all")
        params.is_active = filterActive === "active" ? 1 : 0;

      const response = await warehouseService.getAll(params);

      if (
        !controller.signal.aborted &&
        isMounted.current &&
        response.data?.success
      ) {
        const warehousesList = response.data.data || [];
        setWarehouses(warehousesList);
        setTotalItems(warehousesList.length);
        calculateStats(warehousesList);
        setFilteredWarehouses([]);
        setActiveFilters({});
      } else if (
        !controller.signal.aborted &&
        isMounted.current &&
        !response.data?.success
      ) {
        toast.error(response.data?.message || t("error_loading_warehouses"));
      }
    } catch (error) {
      if (
        !controller.signal.aborted &&
        isMounted.current &&
        error.name !== "AbortError"
      ) {
        console.error("Erreur:", error);
        toast.error(getApiErrorMessage(error, t("error_loading_warehouses")));
      }
    } finally {
      if (!controller.signal.aborted && isMounted.current) {
        setLoading(false);
      }
    }
  }, [searchTerm, filterActive, calculateStats, t]);

  // ========== 5. CRUD ENTREPÔTS ==========
  const openModal = (warehouse = null) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setFormData({
        name: warehouse.name || "",
        location: warehouse.location || "",
        manager_name: warehouse.manager_name || "",
        phone: warehouse.phone || "",
        email: warehouse.email || "",
        description: warehouse.description || "",
        is_active: warehouse.is_active === 1,
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingWarehouse(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error(t("name_required"));
      return;
    }

    const confirmed = await showConfirmDialog(
      editingWarehouse ? t("confirm_update") : t("confirm_create"),
      editingWarehouse ? t("update_confirmation") : t("create_confirmation"),
      editingWarehouse ? t("save") : t("create"),
    );

    if (!confirmed) return;

    setSubmitLoading(true);
    try {
      const payload = {
        name: formData.name,
        location: formData.location || null,
        manager_name: formData.manager_name || null,
        phone: formData.phone || null,
        email: formData.email || null,
        description: formData.description || null,
        is_active: formData.is_active ? 1 : 0,
      };

      let response;
      if (editingWarehouse) {
        response = await warehouseService.update(editingWarehouse.id, payload);
        if (isMounted.current) toast.success(t("warehouse_updated"));
      } else {
        response = await warehouseService.create(payload);
        if (isMounted.current) toast.success(t("warehouse_created"));
      }

      if (response.data?.success && isMounted.current) {
        loadWarehouses();
        closeModal();
        resetForm();
      } else if (isMounted.current) {
        toast.error(response.data?.message || t("error_saving_warehouse"));
      }
    } catch (error) {
      if (isMounted.current) {
        console.error("Erreur:", error);
        toast.error(t("error_saving_warehouse"));
      }
    } finally {
      if (isMounted.current) setSubmitLoading(false);
    }
  };

  const handleDelete = async (warehouse) => {
    const confirmed = await showConfirmDialog(
      t("confirm_delete"),
      `${t("confirm_delete_desc")} "${warehouse.name}" ?`,
      t("delete"),
      "#dc2626",
    );
    if (!confirmed) return;

    try {
      const response = await warehouseService.delete(warehouse.id);
      if (response.data?.success && isMounted.current) {
        toast.success(t("warehouse_deleted"));
        loadWarehouses();
        if (selectedWarehouses.includes(warehouse.id)) {
          setSelectedWarehouses((prev) =>
            prev.filter((id) => id !== warehouse.id),
          );
        }
      } else if (isMounted.current) {
        toast.error(response.data?.message || t("error_deleting_warehouse"));
      }
    } catch (error) {
      if (isMounted.current) toast.error(t("error_deleting_warehouse"));
    }
  };

  const handleToggleStatus = async (warehouse) => {
    try {
      const response = await warehouseService.toggleStatus(warehouse.id);
      if (response.data?.success && isMounted.current) {
        toast.success(response.data.message);
        loadWarehouses();
      }
    } catch (error) {
      if (isMounted.current) toast.error(t("error_toggling_status"));
    }
  };

  const viewWarehouseDetail = async (warehouse) => {
    try {
      const response = await warehouseService.getById(warehouse.id);
      if (response.data?.success && isMounted.current) {
        setSelectedWarehouse(response.data.data);
        setDetailModalOpen(true);
      }
    } catch (error) {
      if (isMounted.current) {
        console.error("Erreur:", error);
        toast.error(t("error_loading_details"));
      }
    }
  };

  // ========== 6. ACTIONS GROUPÉES ==========
  const handleSelectAll = () => {
    if (selectedWarehouses.length === warehouses.length) {
      setSelectedWarehouses([]);
    } else {
      setSelectedWarehouses(warehouses.map((w) => w.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedWarehouses((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = async () => {
    if (selectedWarehouses.length === 0) {
      toast.error(t("select_warehouses"));
      return;
    }

    const confirmed = await showConfirmDialog(
      t("confirm_bulk_delete"),
      t("confirm_bulk_delete_desc").replace(
        "{count}",
        selectedWarehouses.length,
      ),
      t("delete"),
      "#dc2626",
    );
    if (!confirmed) return;

    let deleted = 0;
    for (const id of selectedWarehouses) {
      try {
        await warehouseService.delete(id);
        deleted++;
      } catch (error) {
        console.error(`Erreur suppression ${id}:`, error);
      }
    }

    if (isMounted.current) {
      toast.success(t("bulk_delete_success").replace("{count}", deleted));
      setSelectedWarehouses([]);
      loadWarehouses();
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedWarehouses.length === 0) {
      toast.error(t("select_warehouses"));
      return;
    }

    const confirmed = await showConfirmDialog(
      t("confirm_bulk_status"),
      t("confirm_bulk_status_desc").replace(
        "{count}",
        selectedWarehouses.length,
      ),
      t("apply"),
    );
    if (!confirmed) return;

    let updated = 0;
    for (const id of selectedWarehouses) {
      try {
        await warehouseService.update(id, { is_active: status });
        updated++;
      } catch (error) {
        console.error(`Erreur mise à jour ${id}:`, error);
      }
    }

    if (isMounted.current) {
      toast.success(t("bulk_status_success").replace("{count}", updated));
      setSelectedWarehouses([]);
      loadWarehouses();
    }
  };

  // ========== 7. EXPORT ET IMPRESSION ==========
  const exportWarehousesToCSV = async () => {
    toast.loading(t("export_preparing"), { id: "export" });
    try {
      const response = await warehouseService.getAll({ limit: 9999 });
      const allWarehouses = response.data?.data || [];

      if (allWarehouses.length === 0) {
        toast.error(t("export_no_data"), { id: "export" });
        return;
      }

      const headers = [
        "Code",
        "Nom",
        "Emplacement",
        "Responsable",
        "Téléphone",
        "Email",
        "Statut",
        "Produits",
        "Valeur Stock",
      ];
      const rows = allWarehouses.map((w) => [
        w.code,
        w.name,
        w.location || "-",
        w.manager_name || "-",
        w.phone || "-",
        w.email || "-",
        w.is_active ? "Actif" : "Inactif",
        w.product_count || 0,
        formatCurrency(w.stock_value || 0),
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute(
        "download",
        `warehouses_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        t("export_success").replace("{count}", allWarehouses.length),
        { id: "export" },
      );
    } catch (error) {
      console.error("Erreur export:", error);
      toast.error(t("export_error"), { id: "export" });
    }
  };

  const printWarehouses = () => {
    const printWindow = window.open("", "_blank");
    const headers = [
      "Code",
      "Nom",
      "Emplacement",
      "Responsable",
      "Téléphone",
      "Email",
      "Statut",
    ];
    const rows = warehouses
      .map(
        (w) => `
      <tr>
        <td>${w.code}</td>
        <td>${w.name}</td>
        <td>${w.location || "-"}</td>
        <td>${w.manager_name || "-"}</td>
        <td>${w.phone || "-"}</td>
        <td>${w.email || "-"}</td>
        <td>${w.is_active ? "✅ Actif" : "❌ Inactif"}</td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Liste des entrepôts</title><meta charset="UTF-8"><style>body{font-family:Arial;margin:20px}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#667eea;color:white}</style></head><body><h1>Liste des entrepôts</h1><p>Date: ${new Date().toLocaleString()}</p><p>Total entrepôts: ${warehouses.length}</p><table><thead><td>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`,
    );
    printWindow.document.close();
  };

  // ========== 8. FONCTIONS DE FILTRAGE ==========
  const applyFilters = () => {
    let filtered = [...warehouses];
    const applied = {};

    if (filterStatus !== "all") {
      filtered = filtered.filter((w) =>
        filterStatus === "active" ? w.is_active === "1" : w.is_active === 0,
      );
      applied.status = filterStatus === "active" ? "Actifs" : "Inactifs";
    }

    if (filterLocation.trim()) {
      filtered = filtered.filter(
        (w) =>
          w.location &&
          w.location.toLowerCase().includes(filterLocation.toLowerCase()),
      );
      applied.location = filterLocation;
    }

    if (filterManager.trim()) {
      filtered = filtered.filter(
        (w) =>
          w.manager_name &&
          w.manager_name.toLowerCase().includes(filterManager.toLowerCase()),
      );
      applied.manager = filterManager;
    }

    setFilteredWarehouses(filtered);
    setActiveFilters(applied);
    calculateStats(filtered);
    setFilterModalOpen(false);

    if (Object.keys(applied).length === 0) {
      toast.info(t("no_filters_applied"));
    } else {
      toast.success(t("filters_applied"));
    }
  };

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterLocation("");
    setFilterManager("");
    setActiveFilters({});
    setFilteredWarehouses([]);
    calculateStats(warehouses);
    setFilterModalOpen(false);
    toast.success(t("filters_reset"));
  };

  const removeFilter = (filterKey) => {
    const newActiveFilters = { ...activeFilters };
    delete newActiveFilters[filterKey];

    if (filterKey === "status") setFilterStatus("all");
    if (filterKey === "location") setFilterLocation("");
    if (filterKey === "manager") setFilterManager("");

    setActiveFilters(newActiveFilters);

    let filtered = [...warehouses];

    if (filterStatus !== "all" && filterKey !== "status") {
      filtered = filtered.filter((w) =>
        filterStatus === "active" ? w.is_active === "1" : w.is_active === 0,
      );
    }
    if (filterLocation && filterKey !== "location") {
      filtered = filtered.filter(
        (w) =>
          w.location &&
          w.location.toLowerCase().includes(filterLocation.toLowerCase()),
      );
    }
    if (filterManager && filterKey !== "manager") {
      filtered = filtered.filter(
        (w) =>
          w.manager_name &&
          w.manager_name.toLowerCase().includes(filterManager.toLowerCase()),
      );
    }

    setFilteredWarehouses(filtered);
    calculateStats(filtered);
  };

  // Détermine la liste à afficher
  const displayWarehouses =
    filteredWarehouses.length > 0 || Object.keys(activeFilters).length > 0
      ? filteredWarehouses
      : warehouses;

  const totalPages = Math.ceil(displayWarehouses.length / itemsPerPage);
  const paginatedWarehouses = displayWarehouses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // ========== 9. useEffects ==========
  // Enregistrement des actions
  useEffect(() => {
    const handleAdd = () => openModal();
    const handleRefresh = () => {
      resetFilters();
      loadWarehouses();
    };
    const handleExport = () => exportWarehousesToCSV();
    const handlePrint = () => printWarehouses();
    const handleFilter = () => setFilterModalOpen(true);

    registerAction("add", handleAdd);
    registerAction("refresh", handleRefresh);
    registerAction("export", handleExport);
    registerAction("print", handlePrint);
    registerAction("filter", handleFilter);

    return () => {
      unregisterAction("add");
      unregisterAction("refresh");
      unregisterAction("export");
      unregisterAction("print");
      unregisterAction("filter");
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Chargement initial et changement de route
  useEffect(() => {
    if (isMounted.current) {
      loadWarehouses();
    }
  }, [loadWarehouses, location.key]);

  // Met à jour les statistiques quand les filtres changent
  useEffect(() => {
    const listToShow =
      filteredWarehouses.length > 0 || Object.keys(activeFilters).length > 0
        ? filteredWarehouses
        : warehouses;
    calculateStats(listToShow);
  }, [warehouses, filteredWarehouses, activeFilters, calculateStats]);

  // Montage / Démontage
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ========== 10. RENDU CONDITIONNEL ==========
  if (loading) {
    return <Loader text={t("loading_warehouses")} />;
  }

  // ========== 11. RENDU PRINCIPAL ==========
  return (
    <div className={`warehouses-page ${isDark ? "dark" : "light"}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#1e293b",
          },
        }}
      />

      {/* Header avec statistiques */}
      <div className="page-header">
        <div>
          <h2>🏭 {t("warehouses")}</h2>
          <p>{t("warehouses_desc")}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">🏭 Total: {stats.total}</span>
          <span className="stat-active">✅ Actifs: {stats.active}</span>
          <span className="stat-inactive">❌ Inactifs: {stats.inactive}</span>
          <span className="stat-value">
            💰 Valeur stock: {formatCurrency(stats.totalStockValue)}
          </span>
        </div>
      </div>

      {/* AFFICHAGE DES FILTRES ACTIFS */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>

          <span className="filter-label">{t("active_filters")}:</span>
          {activeFilters.status && (
            <span className="filter-tag">
              {t("status")}: {activeFilters.status}
              <span
                className="remove-tag"
                onClick={() => removeFilter("status")}
              >
                ✕
              </span>
            </span>
          )}
          {activeFilters.location && (
            <span className="filter-tag">
              {t("location")}: {activeFilters.location}
              <span
                className="remove-tag"
                onClick={() => removeFilter("location")}
              >
                ✕
              </span>
            </span>
          )}
          {activeFilters.manager && (
            <span className="filter-tag">
              {t("manager")}: {activeFilters.manager}
              <span
                className="remove-tag"
                onClick={() => removeFilter("manager")}
              >
                ✕
              </span>
            </span>
          )}
          <button className="clear-filters-btn" onClick={resetFilters}>
            ✕ {t("clear_filters")}
          </button>
        </div>
      )}

      {/* Actions groupées */}
      {selectedWarehouses.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">
            {selectedWarehouses.length} {t("selected")}
          </span>
          <button className="bulk-delete-btn" onClick={handleBulkDelete}>
            🗑️ {t("delete_selected")}
          </button>
          <button
            className="bulk-active-btn"
            onClick={() => handleBulkStatusUpdate(1)}
          >
            ✅ Activer
          </button>
          <button
            className="bulk-inactive-btn"
            onClick={() => handleBulkStatusUpdate(0)}
          >
            ❌ Désactiver
          </button>
          <button
            className="bulk-clear-btn"
            onClick={() => setSelectedWarehouses([])}
          >
            ✕
          </button>
        </div>
      )}

      {/* Barre de recherche et filtres */}
      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={t("search_warehouses")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filterActive === "all" ? "active" : ""}`}
            onClick={() => setFilterActive("all")}
          >
            {t("all")}
          </button>
          <button
            className={`filter-tab ${filterActive === "active" ? "active" : ""}`}
            onClick={() => setFilterActive("active")}
          >
            ✅ {t("active")}
          </button>
          <button
            className={`filter-tab ${filterActive === "inactive" ? "active" : ""}`}
            onClick={() => setFilterActive("inactive")}
          >
            ❌ {t("inactive")}
          </button>
        </div>
        <div className="items-per-page">
          <span>{t("show")}:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Tableau des entrepôts */}
      <div className="table-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedWarehouses.length ===
                        paginatedWarehouses.length &&
                      paginatedWarehouses.length > 0
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th>{t("code")}</th>
                <th>{t("name")}</th>
                <th>{t("location")}</th>
                <th>{t("manager")}</th>
                <th>{t("phone")}</th>
                <th>{t("products_count")}</th>
                <th>{t("stock_value")}</th>
                <th>{t("status")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWarehouses.map((warehouse) => (
                <tr
                  key={warehouse.id}
                  className={warehouse.is_active !== "1" ? "inactive-row" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedWarehouses.includes(warehouse.id)}
                      onChange={() => handleSelectOne(warehouse.id)}
                    />
                  </td>
                  <td>
                    <span className="warehouse-code">{warehouse.code}</span>
                  </td>
                  <td>
                    <div className="warehouse-name">
                      <strong>{warehouse.name}</strong>
                      {warehouse.description && (
                        <small>{warehouse.description}</small>
                      )}
                    </div>
                  </td>
                  <td>{warehouse.location || "-"}</td>
                  <td>{warehouse.manager_name || "-"}</td>
                  <td>{warehouse.phone || "-"}</td>
                  <td>
                    <span className="product-count">
                      {warehouse.product_count || 0}
                    </span>
                  </td>
                  <td>
                    <strong>
                      {formatCurrency(warehouse.stock_value || 0)}
                    </strong>
                  </td>
                  <td>
                    <button
                      className={`status-toggle ${warehouse.is_active === "1" ? "active" : "inactive"}`}
                      onClick={() => handleToggleStatus(warehouse)}
                    >
                      {warehouse.is_active === "1" ? "✅ Actif" : "❌ Inactif"}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Tippy content={t("view_details")} placement="top">
                        <button
                          className="btn-icon view"
                          onClick={() => viewWarehouseDetail(warehouse)}
                        >
                          👁️
                        </button>
                      </Tippy>
                      <Tippy content={t("edit")} placement="top">
                        <button
                          className="btn-icon edit"
                          onClick={() => openModal(warehouse)}
                        >
                          ✏️
                        </button>
                      </Tippy>
                      <Tippy content={t("delete")} placement="top">
                        <button
                          className="btn-icon delete"
                          onClick={() => handleDelete(warehouse)}
                        >
                          🗑️
                        </button>
                      </Tippy>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedWarehouses.length === 0 && (
                <tr className="empty-row">
                  <td colSpan="10">
                    <div className="empty-state">
                      <span className="empty-icon">🏭</span>
                      <p>{t("no_warehouses")}</p>
                      <button
                        className="btn-primary"
                        onClick={() => openModal()}
                      >
                        ➕ {t("add_first_warehouse")}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              {t("showing")} {(currentPage - 1) * itemsPerPage + 1} à{" "}
              {Math.min(currentPage * itemsPerPage, displayWarehouses.length)}{" "}
              sur {displayWarehouses.length} entrepôts
            </div>
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ‹
              </button>
              <span className="page-info">
                {t("page")} {currentPage} {t("of")} {Math.max(1, totalPages)}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CRÉATION/MODIFICATION ENTREPÔT */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">🏭</span>
              <h3>
                {editingWarehouse ? t("edit_warehouse") : t("new_warehouse")}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required">{t("name")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Entrepôt Principal"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>{t("location")}</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="Bujumbura, Kirundo, etc."
                    />
                  </div>

                  <div className="form-group">
                    <label>{t("manager_name")}</label>
                    <input
                      type="text"
                      value={formData.manager_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          manager_name: e.target.value,
                        })
                      }
                      placeholder="Nom du responsable"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t("phone")}</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+257 XX XX XX XX"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t("email")}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="contact@entrepot.com"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>{t("description")}</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows="3"
                      placeholder="Description de l'entrepôt..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_active: e.target.checked,
                          })
                        }
                      />
                      &nbsp;{t("warehouse_active")}
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={submitLoading}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <span className="btn-spinner"></span>
                  ) : editingWarehouse ? (
                    t("save")
                  ) : (
                    t("create")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FILTRE */}
      {filterModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setFilterModalOpen(false)}
        >
          <div
            className={`modal-container-small ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">🔍</span>
              <h3>{t("filter_warehouses")}</h3>
              <button
                className="modal-close"
                onClick={() => setFilterModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="filter-section">
                <h4>📊 {t("status")}</h4>
                <div className="filter-options">
                  <button
                    className={`filter-chip ${filterStatus === "all" ? "active" : ""}`}
                    onClick={() => setFilterStatus("all")}
                  >
                    {t("all")}
                  </button>
                  <button
                    className={`filter-chip ${filterStatus === "active" ? "active" : ""}`}
                    onClick={() => setFilterStatus("active")}
                  >
                    ✅ {t("active")}
                  </button>
                  <button
                    className={`filter-chip ${filterStatus === "inactive" ? "active" : ""}`}
                    onClick={() => setFilterStatus("inactive")}
                  >
                    ❌ {t("inactive")}
                  </button>
                </div>
              </div>

              <div className="filter-section">
                <h4>📍 {t("location")}</h4>
                <div className="filter-input-group">
                  <span className="input-icon">📍</span>
                  <input
                    type="text"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder={t("search_by_location")}
                  />
                </div>
              </div>

              <div className="filter-section">
                <h4>👤 {t("manager_name")}</h4>
                <div className="filter-input-group">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    value={filterManager}
                    onChange={(e) => setFilterManager(e.target.value)}
                    placeholder={t("search_by_manager")}
                  />
                </div>
              </div>

              <div className="filter-stats-info">
                📊 {displayWarehouses.length} / {warehouses.length} entrepôts
                affichés
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetFilters}>
                🔄 {t("reset_filters")}
              </button>
              <button className="btn-primary" onClick={applyFilters}>
                ✅ {t("apply_filters")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DÉTAIL ENTREPÔT */}
      {detailModalOpen && selectedWarehouse && (
        <div
          className="modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">🏭</span>
              <h3>
                {t("warehouse_details")} - {selectedWarehouse.name}
              </h3>
              <button
                className="modal-close"
                onClick={() => setDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>{t("code")}:&nbsp;&nbsp;</strong>{" "}
                  {selectedWarehouse.code}
                </div>
                <div className="detail-item">
                  <strong>{t("name")}:</strong>&nbsp;&nbsp;{" "}
                  {selectedWarehouse.name}
                </div>
                <div className="detail-item">
                  <strong>{t("location")}:</strong>&nbsp;&nbsp;{" "}
                  {selectedWarehouse.location || "-"}
                </div>
                <div className="detail-item">
                  <strong>{t("manager")}:</strong>&nbsp;&nbsp;{" "}
                  {selectedWarehouse.manager_name || "-"}
                </div>
                <div className="detail-item">
                  <strong>{t("phone")}:</strong> &nbsp;&nbsp;
                  {selectedWarehouse.phone || "-"}
                </div>
                <div className="detail-item">
                  <strong>{t("email")}:</strong> &nbsp;&nbsp;
                  {selectedWarehouse.email || "-"}
                </div>
                <div className="detail-item">
                  <strong>{t("products_count")}:</strong>&nbsp;&nbsp;{" "}
                  {selectedWarehouse.product_count || 0}
                </div>
                <div className="detail-item">
                  <strong>{t("stock_value")}:</strong>&nbsp;&nbsp;{" "}
                  {formatCurrency(selectedWarehouse.stock_value || 0)}
                </div>
                <div className="detail-item">
                  <strong>{t("status")}:</strong> &nbsp;&nbsp;
                  {selectedWarehouse.is_active ? "✅ Actif" : "❌ Inactif"}
                </div>
                <div className="detail-item full-width">
                  <strong>{t("description")}:</strong>&nbsp;&nbsp;{" "}
                  {selectedWarehouse.description || "-"}
                </div>
              </div>

              {selectedWarehouse.products &&
                selectedWarehouse.products.length > 0 && (
                  <div className="detail-section">
                    <h4>{t("products_in_warehouse")}</h4>
                    <div className="table-responsive">
                      <table className="mini-table">
                        <thead>
                          <tr>
                            <th>{t("code")}</th>
                            <th>{t("name")}</th>
                            <th>{t("current_stock")}</th>
                            <th>{t("unit")}</th>
                            <th>{t("selling_price")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWarehouse.products.map((product, idx) => (
                            <tr key={idx}>
                              <td>{product.code}</td>
                              <td>{product.name}</td>
                              <td
                                className={
                                  product.current_stock <=
                                  product.min_stock_alert
                                    ? "stock-critical"
                                    : ""
                                }
                              >
                                {product.current_stock}
                              </td>
                              <td>{product.unit}</td>
                              <td>{formatCurrency(product.selling_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {selectedWarehouse.recent_movements &&
                selectedWarehouse.recent_movements.length > 0 && (
                  <div className="detail-section">
                    <h4>{t("recent_movements")}</h4>
                    <div className="table-responsive">
                      <table className="mini-table">
                        <thead>
                          <tr>
                            <th>{t("date")}</th>
                            <th>{t("product")}</th>
                            <th>{t("type")}</th>
                            <th>{t("quantity")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWarehouse.recent_movements.map(
                            (movement, idx) => (
                              <tr key={idx}>
                                <td>
                                  {new Date(
                                    movement.movement_date,
                                  ).toLocaleDateString()}
                                </td>
                                <td>{movement.product_name}</td>
                                <td>{movement.movement_type}</td>
                                <td
                                  className={
                                    movement.movement_type === "EN"
                                      ? "positive"
                                      : "negative"
                                  }
                                >
                                  {movement.movement_type === "EN" ? "+" : "-"}
                                  {movement.quantity}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                {t("close")}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setDetailModalOpen(false);
                  openModal(selectedWarehouse);
                }}
              >
                ✏️ {t("edit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles CSS */}
      <style>{`
        .warehouses-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .warehouses-page.light {
          background: var(--bg-main, #f8fafc);
        }
        
        .warehouses-page.dark {
          background: var(--bg-main, #0f172a);
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .page-header h2 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--text-primary, #1e293b);
        }
        
        .page-header p {
          color: var(--text-secondary, #64748b);
          font-size: 14px;
        }
        
        .stats-badge {
          display: flex;
          gap: 12px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 8px 20px;
          border-radius: 20px;
          color: white;
          font-size: 13px;
          flex-wrap: wrap;
        }
        
        .stats-badge span {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
        }
        
        .bulk-actions-bar {
          background: rgba(102,126,234,0.1);
          padding: 12px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          border-left: 4px solid #667eea;
        }
        
        .bulk-count {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .bulk-delete-btn {
          padding: 6px 16px;
          background: rgba(239,68,68,0.1);
          color: #dc2626;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .bulk-active-btn {
          padding: 6px 16px;
          background: rgba(16,185,129,0.1);
          color: #10b981;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .bulk-inactive-btn {
          padding: 6px 16px;
          background: rgba(100,116,139,0.1);
          color: #64748b;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .bulk-clear-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 16px;
        }
        
        .filters-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .search-box {
          display: flex;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px 16px;
          min-width: 280px;
        }
        
        .search-icon {
          font-size: 18px;
          margin-right: 8px;
          color: var(--text-secondary);
        }
        
        .search-box input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          background: transparent;
          color: var(--text-primary);
        }
        
        .filter-tabs {
          display: flex;
          gap: 8px;
          background: var(--bg-card);
          padding: 4px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        
        .filter-tab {
          padding: 8px 20px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-secondary);
        }
        
        .filter-tab.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }
        
        .items-per-page {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        
        .items-per-page select {
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-card);
          color: var(--text-primary);
          cursor: pointer;
        }
        
        .table-container {
          background: var(--bg-card);
          border-radius: 20px;
          padding: 20px;
          border: 1px solid var(--border);
        }
        
        .table-responsive {
          overflow-x: auto;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .data-table th {
          padding: 14px 16px;
          text-align: left;
          font-weight: 600;
          background: var(--bg-header);
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .data-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--text-primary);
        }
        
        .inactive-row {
          opacity: 0.7;
          background: var(--bg-main);
        }
        
        .warehouse-code {
          font-family: monospace;
          font-weight: 600;
          color: #667eea;
        }
        
        .warehouse-name strong {
          display: block;
          color: var(--text-primary);
        }
        
        .warehouse-name small {
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .status-toggle {
          padding: 4px 12px;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-toggle.active {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }
        
        .status-toggle.inactive {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        
        .product-count {
          display: inline-block;
          padding: 2px 8px;
          background: rgba(102,126,234,0.1);
          border-radius: 20px;
          font-size: 12px;
          color: #667eea;
        }
        
        .stock-critical {
          color: #dc2626;
          font-weight: 600;
        }
        
        .positive {
          color: #10b981;
          font-weight: 600;
        }
        
        .negative {
          color: #dc2626;
          font-weight: 600;
        }
        
        .action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        
        .btn-icon {
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          background: transparent;
        }
        
        .btn-icon.view {
          background: rgba(102,126,234,0.1);
          color: #667eea;
        }
        
        .btn-icon.edit {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }
        
        .btn-icon.delete {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        
        .btn-icon:hover {
          transform: scale(1.05);
        }
        
        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .pagination-info {
          font-size: 13px;
          color: var(--text-secondary);
        }
        
        .pagination {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .pagination button {
          padding: 8px 12px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          border-radius: 8px;
          cursor: pointer;
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .pagination button:hover:not(:disabled) {
          background: var(--bg-main);
          border-color: #667eea;
        }
        
        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .page-info {
          padding: 8px 16px;
          background: var(--bg-header);
          border-radius: 8px;
          color: var(--text-primary);
        }
        
        .empty-state {
          text-align: center;
          padding: 60px;
        }
        
        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }
        
        .btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
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
          padding: 10px 20px;
          background: var(--bg-card);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-main);
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
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Loading */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 16px;
        }
        
        .loading-container.light {
          background: var(--bg-main, #f8fafc);
        }
        
        .loading-container.dark {
          background: var(--bg-main, #0f172a);
        }
        
        .loading-container p {
          color: var(--text-secondary);
        }
        
        .loader-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .modal-container {
          background: var(--bg-card);
          border-radius: 20px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          overflow: auto;
        }
        
        .modal-container-large {
          background: var(--bg-card);
          border-radius: 20px;
          width: 95%;
          max-width: 1200px;
          max-height: 90vh;
          overflow: auto;
        }
        
        .modal-container-small {
          max-width: 500px;
          width: 90%;
        }
        
        .modal-header {
          padding: 20px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 20px 20px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }
        
        .modal-icon {
          font-size: 24px;
          margin-right: 12px;
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
        
        .modal-body {
          padding: 24px;
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          position: sticky;
          bottom: 0;
          background: var(--bg-card);
        }
        
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        .form-group.full-width {
          grid-column: span 2;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: normal !important;
        }
        
        .checkbox-label input {
          width: auto;
        }
        
        .required::after {
          content: " *";
          color: #dc2626;
        }
        
        .form-hint {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
          display: block;
        }
        
        /* Modal de filtre */
        .filter-section {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid var(--border);
        }
        
        .filter-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        
        .filter-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .filter-options {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .filter-chip {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-main);
          border: 1px solid var(--border);
          color: var(--text-secondary);
        }
        
        .filter-chip:hover {
          border-color: #667eea;
          color: #667eea;
        }
        
        .filter-chip.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-color: transparent;
          color: white;
        }
        
        .filter-input-group {
          position: relative;
          margin-top: 8px;
        }
        
        .filter-input-group input {
          width: 100%;
          padding: 10px 12px;
          padding-left: 36px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-main);
          color: var(--text-primary);
          font-size: 14px;
        }
        
        .filter-input-group .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          color: var(--text-secondary);
        }
        
        .active-filters-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: rgba(102,126,234,0.1);
          border-radius: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          font-size: 13px;
          border-left: 4px solid #667eea;
        }
        
        .filter-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 20px;
          font-size: 12px;
        }
        
        .filter-tag .remove-tag {
          cursor: pointer;
          font-size: 12px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        
        .filter-tag .remove-tag:hover {
          opacity: 1;
        }
        
        .clear-filters-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        
        .clear-filters-btn:hover {
          background: rgba(220,38,38,0.1);
        }
        
        .filter-stats-info {
          font-size: 12px;
          color: var(--text-secondary);
          padding: 8px 12px;
          background: var(--bg-main);
          border-radius: 8px;
          margin-top: 10px;
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .detail-item.full-width {
          grid-column: span 2;
        }
        
        .detail-item {
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .detail-section {
          margin-top: 24px;
        }
        
        .detail-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        
        .mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .mini-table th,
        .mini-table td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .mini-table th {
          background: var(--bg-header);
          font-weight: 600;
        }
        
        @media (max-width: 768px) {
          .warehouses-page {
            padding: 16px;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .form-group.full-width {
            grid-column: span 1;
          }
          .detail-grid {
            grid-template-columns: 1fr;
          }
          .filters-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .search-box {
            width: 100%;
          }
          .filter-tabs {
            justify-content: center;
          }
          .stats-badge {
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }
          .bulk-actions-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .pagination-bar {
            flex-direction: column;
            align-items: center;
          }
          .modal-container-large {
            width: 95%;
          }
          .modal-container-small {
            width: 95%;
          }
        }

        /* MODAL FILTRE - Correction du fond */
.modal-container-small {
  max-width: 500px;
  width: 90%;
  background: var(--bg-card) !important;
  border-radius: 20px;
  overflow: hidden;
}

/* Assurez-vous que le modal-overlay a un fond sombre */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

/* Corps du modal - fond solide */
.modal-container-small .modal-body {
  background: var(--bg-card);
  padding: 24px;
}

/* Version claire */
.light .modal-container-small {
  background: #ffffff !important;
}

.light .modal-container-small .modal-body {
  background: #ffffff;
}

/* Version sombre */
.dark .modal-container-small {
  background: #1e293b !important;
}

.dark .modal-container-small .modal-body {
  background: #1e293b;
}
      `}</style>
    </div>
  );
};

// Helpers
const formatNumber = (num) => new Intl.NumberFormat("fr-BI").format(num || 0);
const formatCurrency = (num) =>
  new Intl.NumberFormat("fr-BI", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0) + " FBu";

export default Warehouses;
