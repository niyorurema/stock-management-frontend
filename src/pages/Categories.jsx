// frontend/src/pages/Categories.jsx
import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import { productService, getApiErrorMessage } from "../services/apiService";
import { confirm } from "../services/notificationService";
import { useLanguage } from "../contexts/LanguageContext";
import { useAction } from "../contexts/ActionContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";

const Categories = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const isDark = theme === "dark";

  // ========== ÉTATS ==========
  const [categories, setCategories] = useState([]);
  const [fullCategoriesTree, setFullCategoriesTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({ name: "", parent_id: "" });
  const [appliedFilters, setAppliedFilters] = useState({
    name: "",
    parent_id: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    parent_id: "",
    description: "",
  });
  
  // New states for sorting, pagination, and tree view
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("table"); // "table" or "tree"
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [categoryProductCounts, setCategoryProductCounts] = useState({});
  const [categoryProductsList, setCategoryProductsList] = useState({});
  const [detailProductsPage, setDetailProductsPage] = useState({});

  // ========== CHARGEMENT DES CATÉGORIES ==========
  const loadFullCategories = async () => {
    try {
      const response = await productService.getCategories();
      setFullCategoriesTree(response.data?.tree || []);
      // Load product counts for each category
      loadProductCounts();
    } catch (error) {
      console.error("Erreur chargement arbre complet:", error);
    }
  };

  const loadProductCounts = async () => {
    try {
      const response = await productService.getAll({ per_page: 1000 });
      const products = response.data?.data || [];
      const counts = {};
      const productsList = {};
      
      products.forEach(product => {
        if (product.category_id) {
          counts[product.category_id] = (counts[product.category_id] || 0) + 1;
          if (!productsList[product.category_id]) {
            productsList[product.category_id] = [];
          }
          productsList[product.category_id].push(product);
        }
      });
      
      setCategoryProductCounts(counts);
      setCategoryProductsList(productsList);
    } catch (error) {
      console.error("Erreur chargement comptage produits:", error);
    }
  };

  const loadCategories = async (params = {}) => {
    setLoading(true);
    try {
      const cleanParams = {};
      if (params.name && params.name.trim() !== "")
        cleanParams.name = params.name.trim();
      if (
        params.parent_id &&
        params.parent_id !== "" &&
        params.parent_id !== "null"
      ) {
        cleanParams.parent_id = parseInt(params.parent_id);
      }

      const response = await productService.getCategories(cleanParams);
      setCategories(response.data?.data || []);
      setAppliedFilters(cleanParams);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("error_loading_categories")));
    } finally {
      setLoading(false);
    }
  };

  // ========== FONCTIONS DE FILTRAGE ==========
  const applyFilters = () => {
    const params = {};
    if (filters.name && filters.name.trim() !== "")
      params.name = filters.name.trim();
    if (
      filters.parent_id &&
      filters.parent_id !== "" &&
      filters.parent_id !== "null"
    ) {
      params.parent_id = parseInt(filters.parent_id);
    }
    loadCategories(params);
    setFilterModalOpen(false);
    toast.success(t("filters_applied"));
  };

  const resetFilters = () => {
    setFilters({ name: "", parent_id: "" });
    setAppliedFilters({ name: "", parent_id: "" });
    loadCategories();
    setFilterModalOpen(false);
    toast.success(t("filters_reset"));
  };

  const refreshCategories = () => {
    setFilters({ name: "", parent_id: "" });
    setAppliedFilters({ name: "", parent_id: "" });
    loadCategories();
    toast.success(t("refresh_success"));
  };

  const hasActiveFilters = () => {
    return !!(appliedFilters.name || appliedFilters.parent_id);
  };

  // ========== SORTING FUNCTIONS ==========
  const getSortedCategories = (cats) => {
    let sorted = [...cats];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "parent":
          aVal = (a.parent_name || "").toLowerCase();
          bVal = (b.parent_name || "").toLowerCase();
          break;
        case "subcategories":
          aVal = getSubcategories(a.id, fullCategoriesTree).length;
          bVal = getSubcategories(b.id, fullCategoriesTree).length;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    return sorted;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // ========== PAGINATION ==========
  const getSortedAndPaginatedCategories = (cats) => {
    const sorted = getSortedCategories(cats);
    const itemsPerPage = 10;
    const totalPages = Math.ceil(sorted.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      items: sorted.slice(startIndex, endIndex),
      total: sorted.length,
      totalPages,
      currentPage
    };
  };

  // ========== TREE VIEW FUNCTIONS ==========
  const toggleExpandNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderTreeNode = (category, level = 0) => {
    const subcats = getSubcategories(category.id, fullCategoriesTree);
    const hasChildren = subcats.length > 0;
    const isExpanded = expandedNodes.has(category.id);
    const productCount = categoryProductCounts[category.id] || 0;

    return (
      <div key={category.id} className="tree-node" style={{ marginLeft: `${level * 20}px` }}>
        <div className="tree-node-content">
          {hasChildren && (
            <button
              className="tree-expand-btn"
              onClick={() => toggleExpandNode(category.id)}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          {!hasChildren && <span className="tree-placeholder">•</span>}
          <span className="tree-node-name">📁 {category.name}</span>
          {category.description && (
            <span className="tree-node-desc">— {category.description}</span>
          )}
          <span className="tree-node-badge">
            📦 {productCount} {productCount === 1 ? t("product") : t("products")}
          </span>
          <div className="tree-node-actions">
            <Tippy content={t("view_details")} placement="top" animation="scale">
              <button
                className="btn-icon view"
                onClick={() => openDetailModal(category)}
              >
                👁️
              </button>
            </Tippy>
            <Tippy content={t("edit")} placement="top" animation="scale">
              <button
                className="btn-icon edit"
                onClick={() => openModal(category)}
              >
                ✏️
              </button>
            </Tippy>
            <Tippy content={t("delete")} placement="top" animation="scale">
              <button
                className="btn-icon delete"
                onClick={() => handleDelete(category)}
              >
                🗑️
              </button>
            </Tippy>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="tree-children">
            {subcats.map(subcat => renderTreeNode(subcat, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getParentName = (parentId) => {
    const findParent = (items) => {
      for (let item of items) {
        if (item.id === parentId) return item.name;
        if (item.children) {
          const found = findParent(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findParent(fullCategoriesTree) || parentId;
  };

  // ========== RENDU DE L'ARBOIRE ==========
  const renderCategoryOptions = (items, level = 0, excludeId = null) => {
    let options = [];
    for (let item of items) {
      if (item.id === excludeId) continue;
      const prefix = "—".repeat(level) + (level > 0 ? " " : "");
      options.push(
        <option key={item.id} value={item.id}>
          {prefix}
          {item.name}
        </option>,
      );
      if (item.children && item.children.length > 0) {
        options.push(
          ...renderCategoryOptions(item.children, level + 1, excludeId),
        );
      }
    }
    return options;
  };

  // ========== DÉTAILS CATÉGORIE ==========
  const openDetailModal = (category) => {
    setSelectedCategory(category);
    setDetailModalOpen(true);
    // Reset pagination for this category
    setDetailProductsPage(prev => ({
      ...prev,
      [category.id]: 1
    }));
  };

  const getFullPath = (categoryId, items, path = []) => {
    for (let item of items) {
      if (item.id === categoryId) {
        return [...path, item.name];
      }
      if (item.children) {
        const found = getFullPath(categoryId, item.children, [
          ...path,
          item.name,
        ]);
        if (found) return found;
      }
    }
    return null;
  };

  const getSubcategories = (categoryId, items) => {
    let subs = [];
    for (let item of items) {
      if (item.parent_id === categoryId) {
        subs.push(item);
        if (item.children) {
          subs.push(...getSubcategories(item.id, item.children));
        }
      } else if (item.children) {
        subs.push(...getSubcategories(categoryId, item.children));
      }
    }
    return subs;
  };

  const getPaginatedCategoryProducts = (categoryId, pageNum = 1) => {
    const products = categoryProductsList[categoryId] || [];
    const itemsPerPage = 5;
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const startIndex = (pageNum - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return {
      items: products.slice(startIndex, endIndex),
      total: products.length,
      totalPages,
      currentPage: pageNum
    };
  };

  // ========== CRUD ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning(t("fields_required"));
      return;
    }
    const confirmed = await confirm.save(
      editingCategory ? t("save_changes") : t("create_category"),
    );
    if (!confirmed) return;
    try {
      if (editingCategory) {
        await productService.updateCategory(editingCategory.id, formData);
        toast.success(t("category_updated"));
      } else {
        await productService.createCategory(formData);
        toast.success(t("category_created"));
      }
      await loadFullCategories();
      await loadCategories(appliedFilters);
      closeModal();
    } catch (error) {
      toast.error(
        editingCategory
          ? t("error_updating_category")
          : t("error_creating_category"),
      );
    }
  };

  const handleDelete = async (category) => {
    const hasChildren = categories.some((c) => c.parent_id === category.id);
    if (hasChildren) {
      toast.warning(t("cannot_delete_category_has_children"));
      return;
    }
    const confirmed = await confirm.delete(
      `${t("confirm_delete_category")} "${category.name}"`,
    );
    if (!confirmed) return;
    try {
      await productService.deleteCategory(category.id);
      toast.success(t("category_deleted"));
      await loadFullCategories();
      await loadCategories(appliedFilters);
    } catch (error) {
      const message =
        error.response?.data?.message || "error_deleting_category";
      if (message.includes("contains products")) {
        toast.warning(t("cannot_delete_category_has_products"));
      } else {
        toast.error(t("error_deleting_category"));
      }
    }
  };

  const openModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        parent_id: category.parent_id || "",
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", parent_id: "", description: "" });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const handleModalClick = (e) => e.stopPropagation();

  // ========== EXPORT CSV ==========
  const exportCategoriesToCSV = async () => {
    toast(t("export_preparing"));
    try {
      const response = await productService.getCategories();
      const allCategories = response.data?.data || [];
      if (allCategories.length === 0) {
        toast.error(t("export_no_data"));
        return;
      }
      const headers = [
        t("export_header_name"),
        t("export_header_parent"),
        t("export_header_description"),
      ];
      const rows = allCategories.map((c) => [
        c.name || "",
        c.parent_name || "-",
        c.description || "-",
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
        `${t("export_filename_categories")}_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        t("export_success_categories").replace("{count}", allCategories.length),
      );
    } catch (error) {
      toast.error(t("export_error"));
    }
  };

  // ========== IMPRESSION ==========
  const printCategories = async () => {
    toast(t("print_preparing"));
    try {
      const response = await productService.getCategories();
      const allCategories = response.data?.data || [];
      if (allCategories.length === 0) {
        toast.error(t("print_no_data"));
        return;
      }
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>${t("print_title_categories")}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: ${isDark ? "#12121a" : "#f8fafc"}; }
              h1 { color: #667eea; text-align: center; }
              .date { text-align: center; color: #666; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h1>${t("print_header_categories")}</h1>
            <div class="date">${t("print_generated_on")} ${new Date().toLocaleString()}</div>
            <table>
              <thead><tr><th>${t("print_header_name")}</th><th>${t("print_header_parent")}</th><th>${t("print_header_description")}</th></tr></thead>
              <tbody>${allCategories.map((c) => `<tr><td>${c.name || ""}</td><td>${c.parent_name || "-"}</td><td>${c.description || "-"}</td>`).join("")}</tbody>
            </table>
            <div class="footer">${t("print_footer")}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      toast.error(t("print_error"));
    }
  };

  // ========== ENREGISTREMENT DES ACTIONS ==========
  useEffect(() => {
    registerAction("add", () => openModal());
    registerAction("export", () => exportCategoriesToCSV());
    registerAction("print", () => printCategories());
    registerAction("filter", () => setFilterModalOpen(true));
    registerAction("refresh", () => refreshCategories());
    return () => {
      unregisterAction("add");
      unregisterAction("export");
      unregisterAction("print");
      unregisterAction("filter");
      unregisterAction("refresh");
    };
  }, []);

  // ========== CHARGEMENT INITIAL ==========
  useEffect(() => {
    loadFullCategories();
    loadCategories();
  }, []);

  const tableColumns = [
    { key: "name", label: t("category_name") },
    { key: "parent", label: t("parent_category") },
    { key: "description", label: t("description") },
    { key: "actions", label: t("actions") },
  ];

  if (loading) return <Loader />;

  return (
    <div className={`categories-container ${isDark ? "dark" : "light"}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#1e293b",
          },
        }}
      />

      <div className="page-header">
        <div>
          <h2>{t("categories")}</h2>
          <p>{t("categories_desc")}</p>
        </div>
        <div className="header-right">
          <div className="view-mode-toggle">
            <Tippy content={t("table_view") || "Table View"} placement="bottom" animation="scale">
              <button
                className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title={t("table_view") || "Table View"}
              >
                ▦
              </button>
            </Tippy>
            <Tippy content={t("tree_view") || "Tree View"} placement="bottom" animation="scale">
              <button
                className={`view-btn ${viewMode === "tree" ? "active" : ""}`}
                onClick={() => setViewMode("tree")}
                title={t("tree_view") || "Tree View"}
              >
                ▭
              </button>
            </Tippy>
          </div>
          <div className="stats-badge">
            <span className="stat-total">
              📁 {t("total_categories")}: {categories.length}
              {hasActiveFilters() && (
                <span className="filter-badge"> 🔍 {t("active_filters")}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* INDICATEUR VISUEL DES FILTRES ACTIFS */}
      {hasActiveFilters() && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">{t("active_filters_label")}:</span>
          {appliedFilters.name && (
            <span className="filter-tag">
              {t("filter_name")}: {appliedFilters.name}
            </span>
          )}
          {appliedFilters.parent_id && (
            <span className="filter-tag">
              {t("filter_parent")}: {getParentName(appliedFilters.parent_id)}
            </span>
          )}
          <button className="clear-filters-btn" onClick={resetFilters}>
            ✕ {t("clear_filters")}
          </button>
        </div>
      )}

      <div className="page-content">
        {categories.length === 0 && !hasActiveFilters() ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_categories")}</p>
            <Tippy
              content={t("add_first_category")}
              placement="bottom"
              animation="scale"
            >
              <button className="btn-primary" onClick={() => openModal()}>
                ➕ {t("add_first_category")}
              </button>
            </Tippy>
          </div>
        ) : categories.length === 0 && hasActiveFilters() ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_categories_match_filters")}</p>
            <button className="btn-secondary" onClick={resetFilters}>
              {t("reset_filters")}
            </button>
          </div>
        ) : (
          <>
            {viewMode === "table" ? (
              // TABLE VIEW
              <div className={`table-view`}>
                <div className="sort-controls">
                  <div className="sort-buttons">
                    <button
                      className={`sort-btn ${sortField === "name" ? "active" : ""}`}
                      onClick={() => handleSort("name")}
                    >
                      {t("category_name")} {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                    <button
                      className={`sort-btn ${sortField === "parent" ? "active" : ""}`}
                      onClick={() => handleSort("parent")}
                    >
                      {t("parent_category")} {sortField === "parent" && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                    <button
                      className={`sort-btn ${sortField === "subcategories" ? "active" : ""}`}
                      onClick={() => handleSort("subcategories")}
                    >
                      {t("subcategories_count")} {sortField === "subcategories" && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                  </div>
                </div>

              <div className={`table-responsive ${isDark ? "dark" : "light"}`}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-name">
                          <span className="col-header-icon">📁</span>
                          {t("category_name")}
                        </th>
                        <th className="col-parent">
                          <span className="col-header-icon">🔗</span>
                          {t("parent_category")}
                        </th>
                        <th className="col-products">
                          <span className="col-header-icon">📦</span>
                          {t("products") || "Products"}
                        </th>
                        <th className="col-description">
                          <span className="col-header-icon">📝</span>
                          {t("description")}
                        </th>
                        <th className="col-actions">
                          <span className="col-header-icon">⚙️</span>
                          {t("actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedAndPaginatedCategories(categories).items.map((category) => (
                        <tr key={category.id} className="table-row">
                          <td className="col-name">
                            <span className="category-badge">📁</span>
                            <span className="category-name">{category.name}</span>
                          </td>
                          <td className="col-parent">
                            {category.parent_name ? (
                              <span className="parent-badge">🔗 {category.parent_name}</span>
                            ) : (
                              <span className="parent-root">— {t("root") || "Root"}</span>
                            )}
                          </td>
                          <td className="col-products">
                            <span className="product-count-badge">
                              📦 {categoryProductCounts[category.id] || 0}
                            </span>
                          </td>
                          <td className="col-description">
                            <span className="description-text">
                              {category.description || <span className="no-description">—</span>}
                            </span>
                          </td>
                          <td className="col-actions">
                            <div className="action-buttons">
                              <Tippy
                                content={t("view_details")}
                                placement="top"
                                animation="scale"
                              >
                                <button
                                  className="btn-icon view"
                                  onClick={() => openDetailModal(category)}
                                >
                                  👁️
                                </button>
                              </Tippy>
                              <Tippy
                                content={t("edit")}
                                placement="top"
                                animation="scale"
                              >
                                <button
                                  className="btn-icon edit"
                                  onClick={() => openModal(category)}
                                >
                                  ✏️
                                </button>
                              </Tippy>
                              <Tippy
                                content={t("delete")}
                                placement="top"
                                animation="scale"
                              >
                                <button
                                  className="btn-icon delete"
                                  onClick={() => handleDelete(category)}
                                >
                                  🗑️
                                </button>
                              </Tippy>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {getSortedAndPaginatedCategories(categories).totalPages > 1 && (
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      ← {t("previous") || "Previous"}
                    </button>
                    <div className="pagination-info">
                      {t("page") || "Page"} {currentPage} / {getSortedAndPaginatedCategories(categories).totalPages}
                    </div>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === getSortedAndPaginatedCategories(categories).totalPages}
                    >
                      {t("next") || "Next"} →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // TREE VIEW
              <div className={`tree-view ${isDark ? "dark" : "light"}`}>
                <div className="tree-controls">
                  <button
                    className="tree-expand-all"
                    onClick={() => {
                      const allIds = new Set();
                      fullCategoriesTree.forEach(cat => {
                        const addToSet = (item) => {
                          allIds.add(item.id);
                          if (item.children) item.children.forEach(addToSet);
                        };
                        addToSet(cat);
                      });
                      setExpandedNodes(allIds);
                    }}
                  >
                    ✕ {t("expand_all") || "Expand All"}
                  </button>
                  <button
                    className="tree-collapse-all"
                    onClick={() => setExpandedNodes(new Set())}
                  >
                    ✓ {t("collapse_all") || "Collapse All"}
                  </button>
                </div>
                <div className="tree-container">
                  {fullCategoriesTree.map(cat => renderTreeNode(cat))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL CATÉGORIE (CRUD) */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container-small ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <h3>
                {editingCategory ? t("edit_category") : t("new_category")}
              </h3>
              <Tippy content={t("close")} placement="left" animation="scale">
                <button className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </Tippy>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t("category_name")} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t("parent_category")}</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) =>
                      setFormData({ ...formData, parent_id: e.target.value })
                    }
                  >
                    <option value="">{t("no_parent")}</option>
                    {renderCategoryOptions(
                      fullCategoriesTree,
                      0,
                      editingCategory?.id,
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("description")}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows="3"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                >
                  {t("cancel")}
                </button>
                <button type="submit" className="btn-primary">
                  {editingCategory ? t("save") : t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS CATÉGORIE */}
      {detailModalOpen && selectedCategory && (
        <div
          className="modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className={`modal-container-detail ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🔍 {t("category_details")}</h3>
              <Tippy content={t("close")} placement="left" animation="scale">
                <button
                  className="modal-close"
                  onClick={() => setDetailModalOpen(false)}
                >
                  ✕
                </button>
              </Tippy>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">{t("category_name")}:</span>
                  <span className="detail-value">{selectedCategory.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("parent_category")}:</span>
                  <span className="detail-value">
                    {selectedCategory.parent_name || t("no_parent")}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("description")}:</span>
                  <span className="detail-value">
                    {selectedCategory.description || "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("full_path")}:</span>
                  <span className="detail-value">
                    {getFullPath(selectedCategory.id, fullCategoriesTree)?.join(
                      " > ",
                    ) || selectedCategory.name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">
                    {t("subcategories_count")}:
                  </span>
                  <span className="detail-value">
                    {
                      getSubcategories(selectedCategory.id, fullCategoriesTree)
                        .length
                    }
                  </span>
                </div>
              </div>
              {getSubcategories(selectedCategory.id, fullCategoriesTree)
                .length > 0 && (
                <div className="subcategories-section">
                  <h4>{t("subcategories_list")}</h4>
                  <ul className="subcategories-list">
                    {getSubcategories(
                      selectedCategory.id,
                      fullCategoriesTree,
                    ).map((sub) => (
                      <li key={sub.id}>📁 {sub.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(categoryProductsList[selectedCategory.id] || []).length > 0 && (
                <div className="products-section">
                  <h4>📦 {t("products_list") || "Products List"}</h4>
                  <div className="products-list-detail">
                    {getPaginatedCategoryProducts(
                      selectedCategory.id,
                      detailProductsPage[selectedCategory.id] || 1
                    ).items.map((product) => (
                      <div key={product.id} className="product-item">
                        <div className="product-info">
                          <span className="product-item-name">📦 {product.name}</span>
                          <span className="product-item-code">
                            {product.code && `(${product.code})`}
                          </span>
                        </div>
                        <div className="product-stats">
                          <span className="product-stock">
                            {t("current_stock")}: <strong>{product.stock || 0}</strong>
                          </span>
                          <span className="product-price">
                            💰 {product.selling_price || "0"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {getPaginatedCategoryProducts(
                    selectedCategory.id,
                    detailProductsPage[selectedCategory.id] || 1
                  ).totalPages > 1 && (
                    <div className="detail-pagination">
                      <button
                        className="detail-pagination-btn"
                        onClick={() => {
                          const page = (detailProductsPage[selectedCategory.id] || 1) - 1;
                          setDetailProductsPage(prev => ({
                            ...prev,
                            [selectedCategory.id]: page
                          }));
                        }}
                        disabled={(detailProductsPage[selectedCategory.id] || 1) === 1}
                      >
                        ← {t("previous")}
                      </button>
                      <span className="detail-pagination-info">
                        {detailProductsPage[selectedCategory.id] || 1} / {getPaginatedCategoryProducts(selectedCategory.id, detailProductsPage[selectedCategory.id] || 1).totalPages}
                      </span>
                      <button
                        className="detail-pagination-btn"
                        onClick={() => {
                          const page = (detailProductsPage[selectedCategory.id] || 1) + 1;
                          setDetailProductsPage(prev => ({
                            ...prev,
                            [selectedCategory.id]: page
                          }));
                        }}
                        disabled={(detailProductsPage[selectedCategory.id] || 1) === getPaginatedCategoryProducts(selectedCategory.id, detailProductsPage[selectedCategory.id] || 1).totalPages}
                      >
                        {t("next")} →
                      </button>
                    </div>
                  )}
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
            </div>
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
              <h3>🔍 {t("filter_categories")}</h3>
              <button
                className="modal-close"
                onClick={() => setFilterModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("filter_name")}</label>
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) =>
                    setFilters({ ...filters, name: e.target.value })
                  }
                  placeholder={t("filter_name_placeholder")}
                />
              </div>
              <div className="form-group">
                <label>{t("filter_parent")}</label>
                <select
                  value={filters.parent_id || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, parent_id: e.target.value })
                  }
                >
                  <option value="">{t("all_categories")}</option>
                  {renderCategoryOptions(fullCategoriesTree)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetFilters}>
                {t("reset_filters")}
              </button>
              <button className="btn-primary" onClick={applyFilters}>
                {t("apply_filters")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .categories-container {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .categories-container.light {
          background: var(--bg-main);
        }
        
        .categories-container.dark {
          background: var(--bg-main);
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
          color: var(--text-primary);
        }
        
        .page-header p {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .view-mode-toggle {
          display: flex;
          gap: 6px;
          background: var(--bg-card);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        .view-btn {
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
          color: var(--text-secondary);
        }

        .view-btn:hover {
          background: var(--bg-main);
        }

        .view-btn.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-weight: 600;
        }
        
        .stats-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 8px 16px;
          border-radius: 20px;
          color: white;
          font-size: 14px;
          font-weight: 500;
        }
        
        .filter-badge {
          background: rgba(255,255,255,0.3);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          margin-left: 8px;
        }
        
        /* Active Filters Indicator */
        .active-filters-info {
          background: rgba(102,126,234,0.1);
          padding: 10px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 13px;
          border-left: 4px solid #667eea;
        }
        
        .active-filters-info .filter-icon {
          font-size: 14px;
        }
        
        .active-filters-info .filter-label {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .active-filters-info .filter-tag {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        .clear-filters-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 12px;
          margin-left: auto;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        
        .clear-filters-btn:hover {
          background: rgba(220,38,38,0.1);
        }
        
        /* Buttons */
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
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.4);
        }
        
        .btn-secondary {
          padding: 10px 20px;
          background: var(--bg-card);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover {
          background: var(--bg-main);
        }
        
        /* Icon Buttons */
        .btn-icon {
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin: 0 4px;
          transition: all 0.2s;
          font-size: 14px;
        }
        
        .btn-icon.view {
          background: rgba(102,126,234,0.1);
          color: #667eea;
        }
        
        .btn-icon.edit {
          background: rgba(59,130,246,0.1);
          color: #3b82f6;
        }
        
        .btn-icon.delete {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }
        
        .btn-icon:hover {
          transform: scale(1.05);
        }
        
        .action-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-start;
        }
        
        /* Table */
        .table-responsive {
          overflow-x: auto;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        
        .data-table th {
          padding: 16px 14px;
          text-align: left;
          font-weight: 600;
          background: var(--bg-header);
          border-bottom: 2px solid var(--border);
          color: var(--text-primary);
          position: relative;
        }

        .col-header-icon {
          margin-right: 6px;
          font-size: 15px;
        }
        
        .data-table td {
          padding: 14px 14px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--text-primary);
        }
        
        .data-table tbody tr:hover {
          background: rgba(102,126,234,0.05);
        }

        .col-name {
          min-width: 180px;
          font-weight: 600;
        }

        .col-parent {
          min-width: 140px;
        }

        .col-products {
          min-width: 100px;
          text-align: center;
        }

        .col-description {
          min-width: 200px;
        }

        .col-actions {
          min-width: 120px;
          text-align: right;
        }

        .category-badge {
          margin-right: 8px;
          font-size: 14px;
        }
        
        .category-name {
          font-weight: 500;
          color: var(--text-primary);
        }

        .parent-badge {
          background: rgba(102,126,234,0.1);
          color: #667eea;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        .parent-root {
          color: var(--text-secondary);
          font-size: 13px;
        }

        .product-count-badge {
          background: rgba(59,130,246,0.1);
          color: #3b82f6;
          padding: 6px 10px;
          border-radius: 6px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .description-text {
          color: var(--text-secondary);
          font-size: 13px;
          max-width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .no-description {
          color: var(--text-secondary);
          opacity: 0.6;
        }

        .table-row:hover .description-text {
          color: var(--text-primary);
        }
        
        .category-name-cell {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .actions-cell {
          white-space: nowrap;
        }
        
        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .empty-state p {
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        
        /* Form */
        .form-group {
          margin-bottom: 16px;
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
          font-size: 14px;
          background: var(--bg-main);
          color: var(--text-primary);
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
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
        }
        
        .modal-container-small {
          border-radius: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
        }
        
        .modal-container-small.light {
          background: var(--bg-card);
        }
        
        .modal-container-small.dark {
          background: var(--bg-card);
        }
        
        .modal-container-detail {
          border-radius: 20px;
          width: 90%;
          max-width: 550px;
          max-height: 90vh;
          overflow: auto;
        }
        
        .modal-container-detail.light {
          background: var(--bg-card);
        }
        
        .modal-container-detail.dark {
          background: var(--bg-card);
        }
        
        .modal-header {
          padding: 20px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 20px 20px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
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
        
        /* Detail Modal */
        .detail-section {
          margin-bottom: 20px;
        }
        
        .detail-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
        
        .detail-label {
          width: 140px;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .detail-value {
          flex: 1;
          color: var(--text-secondary);
        }
        
        .subcategories-section {
          margin-top: 16px;
        }
        
        .subcategories-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 10px;
        }
        
        .subcategories-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .subcategories-list li {
          padding: 6px 0;
          color: #667eea;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }

        .products-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid var(--border);
        }

        .products-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .products-list-detail {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
          max-height: 300px;
          overflow-y: auto;
        }

        .product-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: rgba(102,126,234,0.05);
          border: 1px solid rgba(102,126,234,0.1);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .product-item:hover {
          background: rgba(102,126,234,0.1);
          border-color: rgba(102,126,234,0.3);
        }

        .product-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .product-item-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 13px;
        }

        .product-item-code {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .product-stats {
          display: flex;
          gap: 12px;
          flex-shrink: 0;
          font-size: 12px;
        }

        .product-stock {
          color: var(--text-secondary);
        }

        .product-stock strong {
          color: #3b82f6;
          font-weight: 600;
        }

        .product-price {
          color: var(--text-secondary);
        }

        .detail-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .detail-pagination-btn {
          padding: 6px 12px;
          background: rgba(102,126,234,0.1);
          border: 1px solid #667eea;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          color: #667eea;
          transition: all 0.2s;
        }

        .detail-pagination-btn:hover:not(:disabled) {
          background: #667eea;
          color: white;
        }

        .detail-pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .detail-pagination-info {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .categories-container {
            padding: 16px;
          }
          
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-right {
            flex-direction: column;
          }
          
          .stats-badge {
            text-align: center;
          }
          
          .action-buttons {
            flex-wrap: wrap;
          }
          
          .desc-col {
            min-width: 150px;
          }

          .sort-buttons {
            flex-wrap: wrap;
          }
        }

        /* Sort Controls */
        .sort-controls {
          margin-bottom: 16px;
        }

        .sort-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sort-btn {
          padding: 8px 14px;
          background: var(--bg-main);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .sort-btn:hover {
          background: var(--bg-card);
          border-color: #667eea;
        }

        .sort-btn.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-color: transparent;
        }

        /* Pagination */
        .pagination-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .pagination-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          font-size: 13px;
        }

        .pagination-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.4);
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination-info {
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
        }

        /* Tree View Styles */
        .tree-view {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 20px;
        }

        .tree-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .tree-expand-all,
        .tree-collapse-all {
          padding: 8px 14px;
          background: var(--bg-main);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .tree-expand-all:hover,
        .tree-collapse-all:hover {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-color: transparent;
        }

        .tree-container {
          max-height: 600px;
          overflow-y: auto;
          padding-right: 8px;
        }

        .tree-node {
          margin-bottom: 4px;
        }

        .tree-node-content {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          border-radius: 8px;
          transition: all 0.2s;
          flex-wrap: wrap;
        }

        .tree-node-content:hover {
          background: rgba(102,126,234,0.08);
        }

        .tree-expand-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0 4px;
          width: 20px;
          text-align: center;
          color: #667eea;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .tree-expand-btn:hover {
          color: #764ba2;
          transform: scale(1.2);
        }

        .tree-placeholder {
          width: 20px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 10px;
        }

        .tree-node-name {
          font-weight: 600;
          color: var(--text-primary);
          flex-shrink: 0;
          font-size: 14px;
        }

        .tree-node-desc {
          font-size: 12px;
          color: var(--text-secondary);
          flex-shrink: 0;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tree-node-badge {
          background: rgba(59,130,246,0.1);
          color: #3b82f6;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .tree-node-actions {
          display: flex;
          gap: 6px;
          margin-left: auto;
          flex-shrink: 0;
        }

        .tree-children {
          background: rgba(102,126,234,0.05);
          border-left: 3px solid #667eea;
          margin-left: 10px;
          margin-top: 4px;
          padding-left: 10px;
          border-radius: 0 8px 8px 0;
        }
      `}</style>
    </div>
  );
};

export default Categories;
