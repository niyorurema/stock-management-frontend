// frontend/src/pages/Products.jsx
import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import { productService, stockService } from "../services/apiService";
import { confirm } from "../services/notificationService";
import { useAction } from "../contexts/ActionContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";
import { usePermission } from "../hooks/usePermission";
import Can from "../components/common/Can";
import ProductDetail from "./ProductDetail";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { authFetchJson } from "../utils/authFetch";

const Products = forwardRef((props, ref) => {
  const { registerAction, unregisterAction } = useAction();
  const { can } = usePermission();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesTree, setCategoriesTree] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [priceUpdateModalOpen, setPriceUpdateModalOpen] = useState(false);
  const [exchangeRateModalOpen, setExchangeRateModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState({
    productId: null,
    field: null,
    value: "",
  });
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [filters, setFilters] = useState({
    code: "",
    name: "",
    category_id: "",
    min_stock: "",
    max_stock: "",
    status: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(7);

  // Code auto-généré
  const [generatedCode, setGeneratedCode] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category_id: "",
    unit: "PIECE",
    purchase_price_aed: 0,
    purchase_price_usd: 0,
    purchase_price_bif: 0,
    stock: 0,
    selling_price: 0,
    tax_rate: 0, // TVA par défaut à 0
    ct_tax_rate: 0,
    tl_tax_rate: 0,
    tsce_tax: 0,
    ott_tax: 0,
    min_stock_alert: 0,
    is_active: true,
  });

  // États pour la mise à jour massive des prix
  const [priceUpdateData, setPriceUpdateData] = useState({
    type: "percentage",
    operation: "increase",
    field: "selling_price",
    value: 0,
    apply_to: "selected",
  });

  // États pour les taux de change
  const [exchangeRates, setExchangeRates] = useState({
    AED_to_USD: 3.6725,
    USD_to_BIF: 2830,
  });
  const [tempExchangeRates, setTempExchangeRates] = useState({
    AED_to_USD: 3.6725,
    USD_to_BIF: 2830,
  });

  // Exposer openModal au parent
  useImperativeHandle(ref, () => ({ openModal: () => setModalOpen(true) }));

  // Générer un code produit automatique
  // frontend/src/pages/Products.jsx

  const generateProductCode = async () => {
    try {
      // Appel au backend pour générer un code unique avec verrouillage
      const { data: result } = await authFetchJson(
        "/api/products/generate-code",
      );

      if (result.success && result.code) {
        const newCode = result.code;
        setGeneratedCode(newCode);
        setFormData((prev) => ({ ...prev, code: newCode }));

        // Afficher un message si c'est un fallback - utiliser toast() au lieu de toast.warning
        if (result.fallback) {
          toast(t("code_generated_fallback"), { duration: 3000, icon: "⚠️" });
        }

        return newCode;
      } else {
        throw new Error(result.message || t("code_generation_error"));
      }
    } catch (error) {
      console.error("Erreur génération code:", error);

      // Fallback local (en dernier recours)
      const fallbackCode = `A${Date.now().toString().slice(-8)}`;
      setGeneratedCode(fallbackCode);
      setFormData((prev) => ({ ...prev, code: fallbackCode }));

      // Utiliser toast() au lieu de toast.warning
      toast(t("code_generated_locally"), { duration: 3000, icon: "⚠️" });
      return fallbackCode;
    }
  };

  // Charger les taux de change
  const loadExchangeRates = async () => {
    try {
      const { data: result } = await authFetchJson(
        "/api/exchange-rates/latest",
      );
      if (result.success) {
        const rates = {
          AED_to_USD: result.data.AED_to_USD || 3.6725,
          USD_to_BIF: result.data.USD_to_BIF || 2830,
        };
        setExchangeRates(rates);
        setTempExchangeRates(rates);
      }
    } catch (error) {
      console.error("Erreur chargement taux de change:", error);
    }
  };

  // Sauvegarder les taux de change
  const saveExchangeRates = async () => {
    try {
      const { data: result } = await authFetchJson("/api/exchange-rates", {
        method: "POST",
        body: JSON.stringify({
          rates: tempExchangeRates,
          effective_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (result.success) {
        setExchangeRates(tempExchangeRates);
        toast.success(t("exchange_rates_updated"));
        setExchangeRateModalOpen(false);
        await recalcAllPrices();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Erreur sauvegarde taux:", error);
      toast.error(t("error_saving_exchange_rates"));
    }
  };

  // Recalculer tous les prix en fonction des nouveaux taux
  const recalcAllPrices = async () => {
    setLoading(true);
    try {
      const response = await productService.getAll({ limit: 9999 });
      const allProducts = response.data?.data || [];

      for (const product of allProducts) {
        const priceAed = product.purchase_price_aed || 0;
        const priceUsd = priceAed / tempExchangeRates.AED_to_USD;
        const priceBif = priceUsd * tempExchangeRates.USD_to_BIF;

        await productService.update(product.id, {
          purchase_price_usd: Math.round(priceUsd * 100) / 100,
          purchase_price_bif: Math.round(priceBif),
        });
      }

      loadProducts(currentPage);
      toast.success(t("prices_recalculated"));
    } catch (error) {
      console.error("Erreur recalcul:", error);
      toast.error(t("error_recalculating_prices"));
    } finally {
      setLoading(false);
    }
  };

  // Convertir les prix entre devises (AED → USD → BIF)
  const convertPrices = useCallback(
    (priceAed) => {
      const priceUsd = priceAed / exchangeRates.AED_to_USD;
      const priceBif = priceUsd * exchangeRates.USD_to_BIF;
      return {
        priceUsd: Math.round(priceUsd * 100) / 100,
        priceBif: Math.round(priceBif),
      };
    },
    [exchangeRates],
  );

  // Mettre à jour les prix dérivés quand le prix AED change
  const handlePriceAedChange = (value) => {
    const priceAed = parseFloat(value) || 0;
    const { priceUsd, priceBif } = convertPrices(priceAed);
    setFormData((prev) => ({
      ...prev,
      purchase_price_aed: priceAed,
      purchase_price_usd: priceUsd,
      purchase_price_bif: priceBif,
    }));
  };

  // ========== FONCTIONS DE CATÉGORIES ==========
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

  const getCategoryPath = (categoryId) => {
    const findPath = (id, items, path = []) => {
      for (let item of items) {
        if (item.id == id) {
          return [...path, item.name];
        }
        if (item.children) {
          const found = findPath(id, item.children, [...path, item.name]);
          if (found) return found;
        }
      }
      return null;
    };
    const path = findPath(categoryId, categoriesTree);
    return path ? path.join(" > ") : "-";
  };

  // ========== FONCTIONS DE STOCK ==========
  const getStockStatus = (quantity, minAlert) => {
    if (quantity <= 0)
      return { label: t("out_of_stock"), color: "#dc2626", icon: "❌" };
    if (quantity <= minAlert)
      return { label: t("low_stock"), color: "#f59e0b", icon: "⚠️" };
    return { label: t("in_stock"), color: "#10b981", icon: "✅" };
  };

  // ========== ÉDITION DIRECTE DANS LE TABLEAU ==========
  const handleCellEdit = (productId, field, value) => {
    setEditingCell({ productId, field, value: value?.toString() || "" });
  };

  const saveCellEdit = async () => {
    const { productId, field, value } = editingCell;
    if (!productId || !field) return;

    try {
      let updateData = {};

      // Si on modifie le prix AED, recalculer USD et BIF
      if (field === "purchase_price_aed") {
        const numValue = parseFloat(value) || 0;
        const { priceUsd, priceBif } = convertPrices(numValue);
        updateData = {
          purchase_price_aed: numValue,
          purchase_price_usd: priceUsd,
          purchase_price_bif: priceBif,
        };
      } else if (field === "selling_price") {
        const numValue = parseFloat(value) || 0;
        updateData = { selling_price: numValue };
      } else if (field === "code") {
        updateData = { code: value.toUpperCase() };
      } else if (field === "name") {
        updateData = { name: value };
      } else {
        const numValue = parseFloat(value) || 0;
        updateData = { [field]: numValue };
      }

      const response = await productService.update(productId, updateData);
      toast.success(response?.message || t("product_updated"));
      loadProducts(currentPage);
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      toast.error(t("error_updating_product"), error);
    } finally {
      setEditingCell({ productId: null, field: null, value: "" });
    }
  };

  // ========== MISE À JOUR MASSIVE DES PRIX ==========
  const openPriceUpdateModal = () => {
    setPriceUpdateData({
      type: "percentage",
      operation: "increase",
      field: "selling_price",
      value: 0,
      apply_to: "selected",
    });
    setPriceUpdateModalOpen(true);
  };

  const applyPriceUpdate = async () => {
    const { type, operation, field, value, apply_to } = priceUpdateData;

    // Correction : utiliser toast() au lieu de toast.warning()
    if (!value || value <= 0) {
      toast(t("enter_valid_value"), { icon: "⚠️", duration: 3000 });
      return;
    }

    let productsToUpdate = [];

    if (apply_to === "selected") {
      if (selectedProducts.length === 0) {
        toast(t("select_products"), { icon: "⚠️", duration: 3000 });
        return;
      }
      productsToUpdate = products.filter((p) =>
        selectedProducts.includes(p.id),
      );
    } else if (apply_to === "all") {
      const response = await productService.getAll({ limit: 9999 });
      productsToUpdate = response.data?.data || [];
    } else if (apply_to === "filtered") {
      productsToUpdate = products;
    }

    if (productsToUpdate.length === 0) {
      toast(t("no_products_to_update"), { icon: "⚠️", duration: 3000 });
      return;
    }

    const confirmed = await Swal.fire({
      title: t("confirm_price_update"),
      html: t("confirm_price_update_desc").replace(
        "{count}",
        productsToUpdate.length,
      ),
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#ef4444",
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
    });

    if (!confirmed.isConfirmed) return;

    setBulkLoading(true);
    let updated = 0;
    let errors = 0;

    for (const product of productsToUpdate) {
      try {
        let newValue = 0;
        const currentValue = parseFloat(product[field]) || 0;
        const multiplier = operation === "increase" ? 1 : -1;

        if (type === "percentage") {
          newValue = currentValue * (1 + (multiplier * value) / 100);
        } else {
          newValue = currentValue + multiplier * value;
        }

        newValue = Math.max(0, newValue);

        let updateData = {};

        if (field === "purchase_price_aed") {
          const { priceUsd, priceBif } = convertPrices(newValue);
          updateData = {
            purchase_price_aed: newValue,
            purchase_price_usd: priceUsd,
            purchase_price_bif: priceBif,
          };
        } else {
          updateData = { [field]: newValue };
        }

        await productService.update(product.id, updateData);
        updated++;
      } catch (error) {
        console.error(`Erreur mise à jour ${product.id}:`, error);
        errors++;
      }
    }

    // Afficher le résultat
    if (errors > 0) {
      toast.success(
        t("price_update_partial")
          .replace("{updated}", updated)
          .replace("{errors}", errors),
        { duration: 5000 },
      );
    } else {
      toast.success(t("price_update_success").replace("{count}", updated));
    }

    setPriceUpdateModalOpen(false);
    loadProducts(currentPage);
    setBulkLoading(false);
  };

  // ========== IMPORT EXCEL AVEC LÉGENDE ==========
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          toast.error(t("file_empty"));
          return;
        }

        const confirmed = await Swal.fire({
          title: t("confirm_import"),
          html: t("confirm_import_desc").replace("{count}", rows.length),
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "#10b981",
          cancelButtonColor: "#ef4444",
          background: isDark ? "#1e293b" : "#ffffff",
          color: isDark ? "#f1f5f9" : "#1e293b",
        });

        if (!confirmed.isConfirmed) return;

        setBulkLoading(true);
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const row of rows) {
          try {
            // Si le code n'est pas fourni, le générer automatiquement
            let code = row.code?.toString().toUpperCase();
            if (!code) {
              const lastProduct = products[0];
              const lastNumber =
                parseInt(lastProduct?.code?.replace("PRD-", "")) || 0;
              const newNumber = String(
                lastNumber + imported + updated + 1,
              ).padStart(4, "0");
              code = `PRD-${newNumber}`;
            }

            const priceAed = parseFloat(row.purchase_price_aed) || 0;
            const { priceUsd, priceBif } = convertPrices(priceAed);

            const productData = {
              code: code,
              name: row.name,
              description: row.description || "",
              category_id: row.category_id || null,
              unit: row.unit || "PIECE",
              purchase_price_aed: priceAed,
              purchase_price_usd: priceUsd,
              purchase_price_bif: priceBif,
              selling_price: parseFloat(row.selling_price) || 0,
              tax_rate: parseFloat(row.tax_rate) || 0,
              ct_tax_rate: parseFloat(row.ct_tax_rate) || 0,
              tl_tax_rate: parseFloat(row.tl_tax_rate) || 0,
              min_stock_alert: parseInt(row.min_stock_alert) || 0,
              is_active:
                row.is_active === "oui" ||
                row.is_active === "true" ||
                row.is_active === 1,
            };

            const existing = await productService.getByCode(productData.code);

            if (existing.data?.data) {
              await productService.update(existing.data.data.id, productData);
              updated++;
            } else {
              await productService.create(productData);
              imported++;
            }
          } catch (error) {
            console.error("Erreur import ligne:", error);
            errors++;
          }
        }

        toast.success(
          t("import_complete")
            .replace("{imported}", imported)
            .replace("{updated}", updated)
            .replace("{errors}", errors),
        );
        loadProducts(currentPage);
      } catch (error) {
        console.error("Erreur lecture fichier:", error);
        toast.error(t("error_reading_file"));
      } finally {
        setBulkLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ========== EXPORT EXCEL ==========
  const exportToExcel = async () => {
    toast.loading(t("export_preparing"), { id: "export" });
    try {
      const response = await productService.getAll({ limit: 9999 });
      const allProducts = response.data?.data || [];

      const exportData = allProducts.map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description || "",
        category: getCategoryPath(p.category_id),
        category_id: p.category_id || "",
        unit: p.unit,
        purchase_price_aed: p.purchase_price_aed,
        purchase_price_usd: p.purchase_price_usd,
        purchase_price_bif: p.purchase_price_bif,
        selling_price: p.selling_price,
        reserved_quantity: p.reserved_quantity || 0,
        stock_quantity: p.stock_quantity || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Produits");
      XLSX.writeFile(
        wb,
        `produits_${new Date().toISOString().slice(0, 19)}.xlsx`,
      );

      toast.success(
        t("export_success_excel").replace("{count}", allProducts.length),
        { id: "export" },
      );
    } catch (error) {
      console.error("Erreur export:", error);
      toast.error(t("export_error"), { id: "export" });
    }
  };

  // ========== EXPORTER TOUTES LES DONNÉES ==========
  const exportAllToCSV = async () => {
    toast(t("export_preparing"));

    try {
      const response = await productService.getAll({ limit: 9999 });
      const allProducts = response.data?.data || [];

      if (allProducts.length === 0) {
        toast.error(t("export_no_data"));
        return;
      }

      const headers = [
        t("export_header_code"),
        t("export_header_name"),
        t("export_header_category"),
        t("export_header_purchase_price_aed"),
        t("export_header_purchase_price_usd"),
        t("export_header_purchase_price_bif"),
        t("export_header_selling_price"),
        t("reserved_stock"),
        t("export_header_stock"),
        t("export_header_status"),
      ];

      const rows = allProducts.map((p) => [
        p.code || "",
        p.name || "",
        getCategoryPath(p.category_id) || "-",
        p.purchase_price_aed?.toLocaleString() || "0",
        p.purchase_price_usd?.toLocaleString() || "0",
        p.purchase_price_bif?.toLocaleString() || "0",
        p.selling_price?.toLocaleString() || "0",
        (p.reserved_quantity || 0).toString(),
        (p.stock_quantity || 0).toString(),
        getStockStatus(p.stock_quantity || 0, p.min_stock_alert).label,
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
        `${t("export_filename")}_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t("export_success").replace("{count}", allProducts.length));
    } catch (error) {
      toast.error(t("export_error"));
    }
  };

  // ========== ACTIONS GROUPÉES ==========
  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map((p) => p.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      toast.warning(t("select_products"));
      return;
    }

    const result = await Swal.fire({
      title: t("confirm_bulk_delete"),
      text: t("confirm_bulk_delete_desc").replace(
        "{count}",
        selectedProducts.length,
      ),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: t("delete"),
      cancelButtonText: t("cancel"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
    });

    if (!result.isConfirmed) return;

    setBulkLoading(true);
    let deleted = 0;
    for (const id of selectedProducts) {
      try {
        await productService.delete(id);
        deleted++;
      } catch (error) {
        console.error(`Erreur suppression ${id}:`, error);
      }
    }

    toast.success(t("bulk_delete_success").replace("{count}", deleted));
    setSelectedProducts([]);
    loadProducts(currentPage);
    setBulkLoading(false);
  };

  const handleBulkActivate = async () => {
    if (selectedProducts.length === 0) {
      toast.warning(t("select_products"));
      return;
    }

    const result = await Swal.fire({
      title: t("confirm_bulk_activate"),
      text: t("confirm_bulk_activate_desc").replace(
        "{count}",
        selectedProducts.length,
      ),
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      confirmButtonText: t("activate"),
      cancelButtonText: t("cancel"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
    });

    if (!result.isConfirmed) return;

    setBulkLoading(true);
    let activated = 0;
    for (const id of selectedProducts) {
      try {
        await productService.update(id, { is_active: true });
        activated++;
      } catch (error) {
        console.error(`Erreur activation ${id}:`, error);
      }
    }

    toast.success(t("bulk_activate_success").replace("{count}", activated));
    setSelectedProducts([]);
    loadProducts(currentPage);
    setBulkLoading(false);
  };

  const handleBulkDeactivate = async () => {
    if (selectedProducts.length === 0) {
      toast.warning(t("select_products"));
      return;
    }

    const result = await Swal.fire({
      title: t("confirm_bulk_deactivate"),
      text: t("confirm_bulk_deactivate_desc").replace(
        "{count}",
        selectedProducts.length,
      ),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      cancelButtonColor: "#64748b",
      confirmButtonText: t("deactivate"),
      cancelButtonText: t("cancel"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
    });

    if (!result.isConfirmed) return;

    setBulkLoading(true);
    let deactivated = 0;
    for (const id of selectedProducts) {
      try {
        await productService.update(id, { is_active: 0 });
        deactivated++;
      } catch (error) {
        console.error(`Erreur désactivation ${id}:`, error);
      }
    }

    toast.success(t("bulk_deactivate_success").replace("{count}", deactivated));
    setSelectedProducts([]);
    loadProducts(currentPage);
    setBulkLoading(false);
  };

  // ========== IMPRIMER TOUTES LES DONNÉES ==========
  const printAllProducts = async () => {
    toast(t("print_preparing"));

    try {
      const response = await productService.getAll({ limit: 9999 });
      const allProducts = response.data?.data || [];

      if (allProducts.length === 0) {
        toast.error(t("print_no_data"));
        return;
      }

      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${t("print_title")}</title>
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
            <h1>${t("print_header")}</h1>
            <div class="date">${t("print_generated_on")} ${new Date().toLocaleString()}</div>
            <table>
              <thead>
                <tr>
                  <th>${t("print_header_code")}</th>
                  <th>${t("print_header_name")}</th>
                  <th>${t("print_header_category")}</th>
                  <th>${t("print_header_purchase_price_aed")}</th>
                  <th>${t("print_header_purchase_price_usd")}</th>
                  <th>${t("print_header_purchase_price_bif")}</th>
                  <th>${t("print_header_selling_price")}</th>
                  <th>${t("reserved_stock")}</th>
                  <th>${t("print_header_stock")}</th>
                  <th>${t("print_header_status")}</th>
                </tr>
              </thead>
              <tbody>
                ${allProducts
                  .map(
                    (p) => `
                  <tr>
                    <td>${p.code || ""}</td>
                    <td>${p.name || ""}</td>
                    <td>${getCategoryPath(p.category_id) || "-"}</td>
                    <td>${(p.purchase_price_aed || 0).toLocaleString()} AED</td>
                    <td>${(p.purchase_price_usd || 0).toLocaleString()} USD</td>
                    <td>${(p.purchase_price_bif || 0).toLocaleString()} FBu</td>
                    <td>${(p.selling_price || 0).toLocaleString()} FBu</td>
                    <td>${(p.reserved_quantity || 0).toString()}</td>
                    <td>${Math.round(p.stock_quantity || 0)} ${p.unit || ""}</td>
                    <td>${getStockStatus(p.stock_quantity || 0, p.min_stock_alert).label}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
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

  // ========== FONCTIONS DE FILTRAGE ==========
  const applyFilters = () => {
    loadProductsWithFilters(1, filters);
    setFilterModalOpen(false);
    toast.success("🔍 " + t("filters_applied"));
  };

  const resetFilters = () => {
    setFilters({
      code: "",
      name: "",
      category_id: "",
      min_stock: "",
      max_stock: "",
      status: "",
    });
    loadProducts();
    setFilterModalOpen(false);
    toast.success("🔄 " + t("filters_reset"));
  };

  // ========== FONCTIONS API ==========
  const loadProducts = async (page = 1) => {
    setLoading(true);
    try {
      const response = await productService.getAll({
        page,
        limit: itemsPerPage,
      });
      setProducts(response.data?.data || []);
      setTotalPages(response.data?.pagination?.total_pages || 1);
      setTotalItems(response.data?.pagination?.total || 0);
      setCurrentPage(response.data?.pagination?.page || 1);
    } catch (error) {
      toast.error("❌ " + t("error_loading_products"));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProductsWithFilters = async (page = 1, filterParams = {}) => {
    setLoading(true);
    try {
      const params = { page, limit: itemsPerPage, ...filterParams };
      const response = await productService.getAll(params);
      setProducts(response.data?.data || []);
      setTotalPages(response.data?.pagination?.total_pages || 1);
      setTotalItems(response.data?.pagination?.total || 0);
      setCurrentPage(response.data?.pagination?.page || 1);
    } catch (error) {
      toast.error("❌ " + t("error_filtering"));
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await productService.getCategories();
      setCategories(response.data?.data || []);
      setCategoriesTree(response.data?.tree || []);
    } catch (error) {
      console.error("Erreur chargement catégories:", error);
    }
  };

  const loadWarehouses = async () => {
    try {
      const response = await stockService.getWarehouses();
      const data = response.data?.data || response.data || [];
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement entrepôts:", error);
      setWarehouses([]);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.warning("⚠️ " + t("category_name_required"));
      return;
    }
    try {
      await productService.createCategory({
        name: newCategoryName,
        parent_id: newCategoryParentId || null,
        description: newCategoryDesc,
      });
      toast.success("✅ " + t("category_added"));
      setNewCategoryName("");
      setNewCategoryParentId("");
      setNewCategoryDesc("");
      setCategoryModalOpen(false);
      loadCategories();
    } catch (error) {
      toast.error("❌ " + t("error_adding_category"));
    }
  };

  // ========== CRUD PRODUITS ==========
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Générer un code si vide
    let code = formData.code;
    if (!code) {
      code = await generateProductCode();
    }

    if (!formData.name || !formData.selling_price) {
      toast.warning("⚠️ " + t("fields_required"));
      return;
    }

    const confirmed = await confirm.save(
      editingProduct ? t("save_changes") : t("create_product"),
    );
    if (!confirmed) return;

    try {
      const productData = {
        ...formData,
        code: code,
        purchase_price_usd: formData.purchase_price_usd,
        purchase_price_bif: formData.purchase_price_bif,
        warehouse_id: formData.stock > 0 ? formData.warehouse_id || "" : "",
      };

      if (editingProduct) {
        await productService.update(editingProduct.id, productData);
        toast.success("✅ " + t("product_updated"));
      } else {
        await productService.create(productData);
        toast.success("✅ " + t("product_created"));
      }
      loadProducts(currentPage);
      closeModal();
    } catch (error) {
      toast.error(
        editingProduct
          ? "❌ " + t("error_updating_product")
          : "❌ " + t("error_creating_product"),
      );
    }
  };

  const handleDelete = async (product) => {
    const confirmed = await confirm.delete(
      `${t("confirm_delete_product")} "${product.name}"`,
    );
    if (!confirmed) return;
    try {
      await productService.delete(product.id);
      toast.success("✅ " + t("product_deleted"));
      loadProducts(currentPage);
    } catch (error) {
      toast.error("❌ " + t("error_deleting_product"));
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code || "",
        name: product.name || "",
        description: product.description || "",
        category_id: product.category_id || "",
        unit: product.unit || "PIECE",
        purchase_price_aed: product.purchase_price_aed || 0,
        purchase_price_usd: product.purchase_price_usd || 0,
        purchase_price_bif: product.purchase_price_bif || 0,
        selling_price: product.selling_price || 0,
        tax_rate: product.tax_rate || 0,
        ct_tax_rate: product.ct_tax_rate || 0,
        tl_tax_rate: product.tl_tax_rate || 0,
        tsce_tax: product.tsce_tax || 0,
        ott_tax: product.ott_tax || 0,
        min_stock_alert: product.min_stock_alert || 0,
        stock: product.current_stock || 0,
        warehouse_id: product.warehouse_id || "",
        is_active: product.is_active !== undefined ? product.is_active : true,
      });
    } else {
      setEditingProduct(null);
      generateProductCode(); // Générer un code automatiquement
      setFormData({
        code: "",
        name: "",
        description: "",
        category_id: "",
        unit: "PIECE",
        purchase_price_aed: 0,
        purchase_price_usd: 0,
        purchase_price_bif: 0,
        selling_price: 0,
        tax_rate: 0,
        ct_tax_rate: 0,
        tl_tax_rate: 0,
        tsce_tax: 0,
        ott_tax: 0,
        min_stock_alert: 0,
        stock: 0,
        warehouse_id: "",
        is_active: true,
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setGeneratedCode("");
  };

  const handleModalClick = (e) => e.stopPropagation();
  const handleViewDetail = (productId) => {
    setSelectedProductId(productId);
    setShowDetailModal(true);
  };

  // ========== ENREGISTREMENT DES ACTIONS DE LA BARRE D'OUTILS ==========
  useEffect(() => {
    if (can("products.create")) {
      registerAction("add", () => setModalOpen(true));
    }
    registerAction("export", () => exportAllToCSV());
    registerAction("print", () => printAllProducts());
    registerAction("filter", () => setFilterModalOpen(true));
    registerAction("refresh", () => {
      loadProducts(currentPage);
      toast.success("🔄 " + t("data_refreshed"));
    });

    return () => {
      unregisterAction("add");
      unregisterAction("export");
      unregisterAction("print");
      unregisterAction("filter");
      unregisterAction("refresh");
    };
  }, [currentPage]);

  // ========== CHARGEMENT INITIAL ==========
  useEffect(() => {
    loadProducts();
    loadCategories();
    loadWarehouses();
    loadExchangeRates();
  }, []);

  // ========== COLONNES DU TABLEAU ==========
  const tableColumns = [
    { key: "code", label: t("product_code"), editable: true },
    { key: "name", label: t("product_name"), editable: true },
    { key: "category", label: t("product_category"), editable: false },
    {
      key: "purchase_price_aed",
      label: t("purchase_price_aed"),
      editable: true,
      type: "number",
    },
    {
      key: "purchase_price_usd",
      label: t("purchase_price_usd"),
      editable: false,
    },
    {
      key: "purchase_price_bif",
      label: t("purchase_price_bif"),
      editable: false,
    },
    {
      key: "selling_price",
      label: t("product_selling_price"),
      editable: true,
      type: "number",
    },
    { key: "stock", label: t("product_stock"), editable: false },
    { key: "stockr", label: t("product_stock_r"), editable: false },
    { key: "status", label: t("product_status"), editable: false },
    { key: "actions", label: t("product_actions"), editable: false },
  ];

  if (loading) return <Loader />;

  return (
    <div className={`products-page ${isDark ? "dark" : "light"}`}>
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
          <h2>📦 {t("products")}</h2>
          <p>{t("products_desc")}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">
            📦 {t("total_products")}: {totalItems}
          </span>
          <span className="stat-active">
            ✅ {t("active")}: {products.filter((p) => p.is_active).length}
          </span>
          <span className="stat-inactive">
            ❌ {t("inactive")}: {products.filter((p) => !p.is_active).length}
          </span>
          <button
            className="btn-exchange-rate"
            onClick={() => setExchangeRateModalOpen(true)}
          >
            💱 {t("exchange_rates")}
          </button>
          <button className="btn-price-update" onClick={openPriceUpdateModal}>
            💰 {t("bulk_price_update")}
          </button>
          <div className="import-wrapper">
            <label className="btn-excel-import">
              📂 {t("import_excel")}
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelImport}
                style={{ display: "none" }}
              />
            </label>
            <button
              className="btn-help"
              onClick={() => setShowImportHelp(!showImportHelp)}
            >
              ❓
            </button>
          </div>
          <button className="btn-excel-export" onClick={exportToExcel}>
            📊 {t("export_excel")}
          </button>
        </div>
      </div>

      {/* Légende pour l'import Excel */}
      {showImportHelp && (
        <div className="import-help">
          <h4>📋 Structure du fichier Excel attendu</h4>
          <table className="help-table">
            <thead>
              <tr>
                <th>Colonne</th>
                <th>Description</th>
                <th>Requis</th>
                <th>Exemple</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>code</td>
                <td>Code produit</td>
                <td>Non (auto-généré)</td>
                <td>PRD-0001</td>
              </tr>
              <tr>
                <td>name</td>
                <td>Nom du produit</td>
                <td className="required">Oui</td>
                <td>Smartphone XYZ</td>
              </tr>
              <tr>
                <td>description</td>
                <td>Description</td>
                <td>Non</td>
                <td>Smartphone 128GB</td>
              </tr>
              <tr>
                <td>category_id</td>
                <td>ID catégorie</td>
                <td>Non</td>
                <td>1</td>
              </tr>
              <tr>
                <td>unit</td>
                <td>Unité</td>
                <td>Non</td>
                <td>PIECE</td>
              </tr>
              <tr>
                <td>purchase_price_aed</td>
                <td>Prix d'achat (AED)</td>
                <td>Non</td>
                <td>100</td>
              </tr>
              <tr>
                <td>selling_price</td>
                <td>Prix de vente (BIF)</td>
                <td className="required">Oui</td>
                <td>35000</td>
              </tr>
              <tr>
                <td>tax_rate</td>
                <td>Taux TVA (%)</td>
                <td>Non</td>
                <td>0</td>
              </tr>
              <tr>
                <td>min_stock_alert</td>
                <td>Alerte stock min</td>
                <td>Non</td>
                <td>5</td>
              </tr>
              <tr>
                <td>is_active</td>
                <td>Actif (oui/non)</td>
                <td>Non</td>
                <td>oui</td>
              </tr>
            </tbody>
          </table>
          <button
            className="btn-close-help"
            onClick={() => setShowImportHelp(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Actions groupées */}
      {selectedProducts.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">
            {selectedProducts.length} {t("selected")}
          </span>
          <button
            className="bulk-activate-btn"
            onClick={handleBulkActivate}
            disabled={bulkLoading}
          >
            ✅ {t("activate")}
          </button>
          <button
            className="bulk-deactivate-btn"
            onClick={handleBulkDeactivate}
            disabled={bulkLoading}
          >
            ❌ {t("deactivate")}
          </button>
          <button
            className="bulk-delete-btn"
            onClick={handleBulkDelete}
            disabled={bulkLoading}
          >
            🗑️ {t("delete_selected")}
          </button>
          <button
            className="bulk-clear-btn"
            onClick={() => setSelectedProducts([])}
          >
            ✕
          </button>
        </div>
      )}

      <div className="page-content">
        {products.length === 0 ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_products")}</p>
            <Can permission="products.create">
              <Tippy
                content={t("add_first_product")}
                placement="bottom"
                animation="scale"
              >
                <button className="btn-primary" onClick={() => openModal()}>
                  ➕ {t("add_first_product")}
                </button>
              </Tippy>
            </Can>
          </div>
        ) : (
          <>
            <div className={`table-responsive ${isDark ? "dark" : "light"}`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={
                          selectedProducts.length === products.length &&
                          products.length > 0
                        }
                        onChange={handleSelectAll}
                      />
                    </th>
                    {tableColumns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const stockStatus = getStockStatus(
                      product.stock_quantity || 0,
                      product.min_stock_alert,
                    );
                    const isEditing = editingCell.productId === product.id;

                    return (
                      <tr
                        key={product.id}
                        className={!product.is_active ? "inactive-row" : ""}
                      >
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => handleSelectOne(product.id)}
                          />
                        </td>
                        <td className="code-cell">
                          {isEditing && editingCell.field === "code" ? (
                            <input
                              type="text"
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={saveCellEdit}
                              onKeyPress={(e) =>
                                e.key === "Enter" && saveCellEdit()
                              }
                              autoFocus
                              className="inline-edit-input"
                            />
                          ) : (
                            <span
                              className="product-code"
                              onDoubleClick={() =>
                                handleCellEdit(product.id, "code", product.code)
                              }
                            >
                              {product.code}
                            </span>
                          )}
                        </td>
                        <td className="name-cell">
                          {isEditing && editingCell.field === "name" ? (
                            <input
                              type="text"
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={saveCellEdit}
                              onKeyPress={(e) =>
                                e.key === "Enter" && saveCellEdit()
                              }
                              autoFocus
                              className="inline-edit-input"
                            />
                          ) : (
                            <div
                              onDoubleClick={() =>
                                handleCellEdit(product.id, "name", product.name)
                              }
                            >
                              <strong>{product.name}</strong>
                              <br />
                              <small className="product-desc">
                                {product.description?.substring(0, 50)}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>{getCategoryPath(product.category_id)}</td>
                        <td className="price-aed">
                          {isEditing &&
                          editingCell.field === "purchase_price_aed" ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={saveCellEdit}
                              onKeyPress={(e) =>
                                e.key === "Enter" && saveCellEdit()
                              }
                              autoFocus
                              className="inline-edit-input price-input"
                            />
                          ) : (
                            <span
                              onDoubleClick={() =>
                                handleCellEdit(
                                  product.id,
                                  "purchase_price_aed",
                                  product.purchase_price_aed,
                                )
                              }
                            >
                              {product.purchase_price_aed?.toLocaleString()} AED
                            </span>
                          )}
                        </td>
                        <td className="price-usd">
                          {product.purchase_price_usd?.toLocaleString()} USD
                        </td>
                        <td className="price-bif">
                          {product.purchase_price_bif?.toLocaleString()} FBu
                        </td>
                        <td className="selling-price">
                          {isEditing &&
                          editingCell.field === "selling_price" ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={saveCellEdit}
                              onKeyPress={(e) =>
                                e.key === "Enter" && saveCellEdit()
                              }
                              autoFocus
                              className="inline-edit-input price-input"
                            />
                          ) : (
                            <span
                              onDoubleClick={() =>
                                handleCellEdit(
                                  product.id,
                                  "selling_price",
                                  product.selling_price,
                                )
                              }
                            >
                              {product.selling_price?.toLocaleString()} FBu
                            </span>
                          )}
                        </td>
                        <td className="stock-cell">
                          {Math.round(product.stock_quantity || 0)}{" "}
                          {product.unit}
                        </td>
                        <td className="reserved-cell">
                          {Math.round(product.reserved_quantity || 0)}{" "}
                          {product.unit}
                        </td>
                        <td
                          className="stock-status"
                          style={{ color: stockStatus.color }}
                        >
                          {stockStatus.icon} {stockStatus.label}
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <Tippy
                              content={t("view_details")}
                              placement="top"
                              animation="scale"
                            >
                              <button
                                className="btn-icon view"
                                onClick={() => handleViewDetail(product.id)}
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
                                onClick={() => openModal(product)}
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
                                onClick={() => handleDelete(product)}
                              >
                                🗑️
                              </button>
                            </Tippy>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <Tippy content={t("first")} placement="top" animation="scale">
                  <button
                    onClick={() => loadProducts(1)}
                    disabled={currentPage === 1}
                  >
                    «
                  </button>
                </Tippy>
                <Tippy
                  content={t("previous")}
                  placement="top"
                  animation="scale"
                >
                  <button
                    onClick={() => loadProducts(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ‹
                  </button>
                </Tippy>
                <span className="page-info">
                  {t("page")} {currentPage} {t("of")} {totalPages}
                </span>
                <Tippy content={t("next")} placement="top" animation="scale">
                  <button
                    onClick={() => loadProducts(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    ›
                  </button>
                </Tippy>
                <Tippy content={t("last")} placement="top" animation="scale">
                  <button
                    onClick={() => loadProducts(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    »
                  </button>
                </Tippy>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL PRODUIT */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <h3>{editingProduct ? t("edit_product") : t("new_product")}</h3>
              <button className="modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t("code")}</label>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        style={{ flex: 1 }}
                        placeholder={t("auto_generated")}
                      />
                      <Tippy content={t("generate_code")} placement="top">
                        <button
                          type="button"
                          className="btn-small"
                          onClick={generateProductCode}
                        >
                          🔄
                        </button>
                      </Tippy>
                    </div>
                    {!formData.code && generatedCode && (
                      <small className="code-hint">
                        Code suggéré: {generatedCode}
                      </small>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="required">{t("name")} </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
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
                      rows="2"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("category")}</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        value={formData.category_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category_id: e.target.value,
                          })
                        }
                        style={{ flex: 1 }}
                      >
                        <option value="">{t("select_category")}</option>
                        {renderCategoryOptions(categoriesTree)}
                      </select>
                      <Tippy
                        content={t("add_category")}
                        placement="top"
                        animation="scale"
                      >
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => setCategoryModalOpen(true)}
                        >
                          +
                        </button>
                      </Tippy>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>{t("unit")}</label>
                    <select
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                    >
                      <option value="PIECE">{t("piece")}</option>
                      <option value="KG">{t("kilogram")}</option>
                      <option value="LITRE">{t("liter")}</option>
                      <option value="METER">{t("meter")}</option>
                    </select>
                  </div>

                  {/* Prix d'achat avec auto-complétion */}
                  <div className="form-group">
                    <label>{t("purchase_price_aed")} (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchase_price_aed}
                      onChange={(e) => handlePriceAedChange(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("purchase_price_usd")} (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchase_price_usd}
                      disabled
                      className="disabled-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("purchase_price_bif")} (FBu)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchase_price_bif}
                      disabled
                      className="disabled-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="required">
                      {t("selling_price")} (FBu){" "}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.selling_price}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          selling_price: parseFloat(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("tax_rate")} (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.tax_rate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tax_rate: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("ct_tax")} (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.ct_tax_rate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ct_tax_rate: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("tl_tax")} (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.tl_tax_rate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tl_tax_rate: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("tsce_tax")} (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.tsce_tax}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tsce_tax: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("ott_tax")} (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.ott_tax}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ott_tax: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("min_stock_alert")}</label>
                    <input
                      type="number"
                      value={formData.min_stock_alert}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          min_stock_alert: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("initial_stock")}</label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stock: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  {!editingProduct && formData.stock > 0 && (
                    <div className="form-group">
                      <label>{t("warehouse") || "Entrepôt"}</label>
                      <select
                        value={formData.warehouse_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            warehouse_id: e.target.value,
                          })
                        }
                      >
                        <option value="">
                          {t("select_warehouse") || "Choisir un entrepôt"}
                        </option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>{t("active")}</label>
                    <select
                      value={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.value === "true",
                        })
                      }
                    >
                      <option value="true">✅ {t("yes")}</option>
                      <option value="false">❌ {t("no")}</option>
                    </select>
                  </div>
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
                  {editingProduct ? t("update_product") : t("create_product")}
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
              <h3>🔍 {t("filter_products")}</h3>
              <button
                className="modal-close"
                onClick={() => setFilterModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("filter_code")}</label>
                <input
                  type="text"
                  value={filters.code}
                  onChange={(e) =>
                    setFilters({ ...filters, code: e.target.value })
                  }
                  placeholder={t("filter_code_placeholder")}
                />
              </div>
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
                <label>{t("filter_category")}</label>
                <select
                  value={filters.category_id}
                  onChange={(e) =>
                    setFilters({ ...filters, category_id: e.target.value })
                  }
                >
                  <option value="">{t("all_categories")}</option>
                  {renderCategoryOptions(categoriesTree)}
                </select>
              </div>
              <div className="form-group">
                <label>{t("filter_min_stock")}</label>
                <input
                  type="number"
                  value={filters.min_stock}
                  onChange={(e) =>
                    setFilters({ ...filters, min_stock: e.target.value })
                  }
                  placeholder={t("filter_min_stock_placeholder")}
                />
              </div>
              <div className="form-group">
                <label>{t("filter_status")}</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">{t("all_status")}</option>
                  <option value="normal">✅ {t("status_normal")}</option>
                  <option value="low">⚠️ {t("status_low")}</option>
                  <option value="out">❌ {t("status_out")}</option>
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

      {/* MODAL CATÉGORIE */}
      {categoryModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setCategoryModalOpen(false)}
        >
          <div
            className={`modal-container-small ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <h3>{t("new_category")}</h3>
              <button
                className="modal-close"
                onClick={() => setCategoryModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="required">{t("category_name")}</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t("parent_category")}</label>
                <select
                  value={newCategoryParentId}
                  onChange={(e) => setNewCategoryParentId(e.target.value)}
                >
                  <option value="">{t("no_parent")}</option>
                  {renderCategoryOptions(categoriesTree)}
                </select>
              </div>
              <div className="form-group">
                <label>{t("description")}</label>
                <textarea
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  rows="2"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setCategoryModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button className="btn-primary" onClick={handleAddCategory}>
                {t("create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAUX DE CHANGE */}
      {exchangeRateModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setExchangeRateModalOpen(false)}
        >
          <div
            className={`modal-container-small ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>💱 {t("manage_exchange_rates")}</h3>
              <button
                className="modal-close"
                onClick={() => setExchangeRateModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>AED → USD</label>
                <input
                  type="number"
                  step="0.0001"
                  value={tempExchangeRates.AED_to_USD}
                  onChange={(e) =>
                    setTempExchangeRates({
                      ...tempExchangeRates,
                      AED_to_USD: parseFloat(e.target.value),
                    })
                  }
                />
                <small>1 AED = ? USD</small>
              </div>
              <div className="form-group">
                <label>USD → BIF</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempExchangeRates.USD_to_BIF}
                  onChange={(e) =>
                    setTempExchangeRates({
                      ...tempExchangeRates,
                      USD_to_BIF: parseFloat(e.target.value),
                    })
                  }
                />
                <small>1 USD = ? BIF</small>
              </div>
              <div className="info-box">
                <p>ℹ️ {t("exchange_rate_info")}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setExchangeRateModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button className="btn-primary" onClick={saveExchangeRates}>
                💾 {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MISE À JOUR MASSIVE DES PRIX */}
      {priceUpdateModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setPriceUpdateModalOpen(false)}
        >
          <div
            className={`modal-container-small ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>💰 {t("bulk_price_update")}</h3>
              <button
                className="modal-close"
                onClick={() => setPriceUpdateModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("apply_to")}</label>
                <select
                  value={priceUpdateData.apply_to}
                  onChange={(e) =>
                    setPriceUpdateData({
                      ...priceUpdateData,
                      apply_to: e.target.value,
                    })
                  }
                >
                  <option value="selected">
                    {t("selected_products")} ({selectedProducts.length})
                  </option>
                  <option value="filtered">
                    {t("filtered_products")} ({products.length})
                  </option>
                  <option value="all">
                    {t("all_products")} ({totalItems})
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>{t("field_to_modify")}</label>
                <select
                  value={priceUpdateData.field}
                  onChange={(e) =>
                    setPriceUpdateData({
                      ...priceUpdateData,
                      field: e.target.value,
                    })
                  }
                >
                  <option value="selling_price">
                    {t("selling_price_bif")}
                  </option>
                  <option value="purchase_price_aed">
                    {t("purchase_price_aed")}
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>{t("modification_type")}</label>
                <select
                  value={priceUpdateData.type}
                  onChange={(e) =>
                    setPriceUpdateData({
                      ...priceUpdateData,
                      type: e.target.value,
                    })
                  }
                >
                  <option value="percentage">{t("percentage")} (%)</option>
                  <option value="fixed">{t("fixed_amount")}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t("operation")}</label>
                <select
                  value={priceUpdateData.operation}
                  onChange={(e) =>
                    setPriceUpdateData({
                      ...priceUpdateData,
                      operation: e.target.value,
                    })
                  }
                >
                  <option value="increase">{t("increase")} (+)</option>
                  <option value="decrease">{t("decrease")} (-)</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t("value")}</label>
                <input
                  type="number"
                  step={priceUpdateData.type === "percentage" ? 0.1 : 1}
                  value={priceUpdateData.value}
                  onChange={(e) =>
                    setPriceUpdateData({
                      ...priceUpdateData,
                      value: parseFloat(e.target.value),
                    })
                  }
                />
                <small>
                  {priceUpdateData.type === "percentage"
                    ? t("percentage_of_current")
                    : t("amount_in_bif")}
                </small>
              </div>

              <div className="info-box warning">
                <p>⚠️ {t("price_update_warning")}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setPriceUpdateModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={applyPriceUpdate}
                disabled={bulkLoading}
              >
                {bulkLoading ? (
                  <span className="btn-spinner"></span>
                ) : (
                  "💰 " + t("apply")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DÉTAIL PRODUIT */}
      {showDetailModal && (
        <ProductDetail
          productId={selectedProductId}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      <style>{`
        .products-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .products-page.light {
          background: var(--bg-main);
        }
        
        .products-page.dark {
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
        
        .stats-badge {
          display: flex;
          gap: 12px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 8px 20px;
          border-radius: 20px;
          color: white;
          font-size: 13px;
          flex-wrap: wrap;
          align-items: center;
        }
        
        .stat-active, .stat-inactive {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
        }
        
        .btn-exchange-rate, .btn-price-update, .btn-excel-import, .btn-excel-export, .btn-help {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .btn-help {
          background: #f59e0b;
          margin-left: 4px;
        }
        
        .btn-exchange-rate:hover, .btn-price-update:hover, .btn-excel-import:hover, .btn-excel-export:hover, .btn-help:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.02);
        }
        
        .import-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .import-help {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--bg-card);
          border-radius: 20px;
          padding: 24px;
          max-width: 800px;
          width: 90%;
          max-height: 80vh;
          overflow: auto;
          z-index: 1100;
          border: 1px solid var(--border);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .import-help h4 {
          margin-bottom: 16px;
          color: var(--text-primary);
        }
        
        .help-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        
        .help-table th, .help-table td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .help-table th {
          background: var(--bg-header);
          font-weight: 600;
        }
        
        .help-table .required {
          color: #10b981;
          font-weight: 600;
        }
          .required::after {
          content: ' *';
          color: #dc2626;
        }
        
        .btn-close-help {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0,0,0,0.2);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 16px;
          color: var(--text-primary);
        }
        
        .code-hint {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
          display: block;
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
        
        .bulk-activate-btn, .bulk-deactivate-btn, .bulk-delete-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .bulk-activate-btn { background: #10b981; color: white; }
        .bulk-deactivate-btn { background: #f59e0b; color: white; }
        .bulk-delete-btn { background: #dc2626; color: white; }
        
        .bulk-activate-btn:hover:not(:disabled),
        .bulk-deactivate-btn:hover:not(:disabled),
        .bulk-delete-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        
        .bulk-clear-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 16px;
        }
        
        .product-code {
          font-family: monospace;
          background: var(--bg-main);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-primary);
          cursor: pointer;
        }
        
        .product-code:hover {
          background: var(--bg-card);
          outline: 1px solid #667eea;
        }
        
        .product-desc {
          color: var(--text-secondary);
          font-size: 11px;
        }
        
        .stock-cell {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .stock-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          background: var(--bg-main);
        }
        
        .price-aed, .price-usd, .price-bif, .selling-price {
          font-weight: 500;
          cursor: pointer;
        }
        
        .price-aed:hover, .selling-price:hover {
          background: var(--bg-main);
          outline: 1px solid #667eea;
          border-radius: 4px;
        }
        
        .price-aed { color: #f59e0b; }
        .price-usd { color: #10b981; }
        .price-bif { color: #3b82f6; }
        
        .inactive-row {
          opacity: 0.7;
          background: var(--bg-main);
        }
        
        .disabled-input {
          background: var(--bg-main);
          color: var(--text-secondary);
          cursor: not-allowed;
        }
        
        .inline-edit-input {
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #667eea;
          border-radius: 4px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 14px;
        }
        
        .inline-edit-input.price-input {
          width: 120px;
          text-align: right;
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
        
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-main);
        }
        
        .btn-small {
          padding: 10px 15px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }
        
        .btn-small:hover {
          transform: translateY(-1px);
        }
        
        .btn-icon {
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin: 0 4px;
          transition: all 0.2s;
          font-size: 14px;
        }
        
        .btn-icon.view { background: rgba(102,126,234,0.1); color: #667eea; }
        .btn-icon.edit { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .btn-icon.delete { background: rgba(239,68,68,0.1); color: #dc2626; }
        
        .btn-icon:hover:not(:disabled) {
          transform: scale(1.05);
        }
        
        .btn-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
        
        .action-buttons {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        
        .table-responsive {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
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
        
        .data-table tbody tr:hover {
          background: var(--bg-main);
        }
        
        .checkbox-cell {
          text-align: center;
        }
        
        .code-cell, .name-cell, .price-aed, .selling-price {
          min-width: 100px;
        }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 24px;
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
          background: #667eea;
          color: white;
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
          font-size: 14px;
          color: var(--text-primary);
        }
        
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
          font-size: 14px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .form-group input:focus, 
        .form-group select:focus, 
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .info-box {
          background: rgba(102,126,234,0.1);
          padding: 12px 16px;
          border-radius: 12px;
          margin: 16px 0;
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .info-box.warning {
          background: rgba(245,158,11,0.1);
          border-left: 4px solid #f59e0b;
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
          max-width: 900px;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--border);
        }
        
        .modal-container-small {
          background: var(--bg-card);
          border-radius: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--border);
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
        
        @media (max-width: 768px) {
          .products-page {
            padding: 16px;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .form-group.full-width {
            grid-column: span 1;
          }
          .modal-container {
            width: 95%;
          }
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }
          .stats-badge {
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .action-buttons {
            flex-wrap: wrap;
          }
          .bulk-actions-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .inline-edit-input.price-input {
            width: 80px;
          }
          .import-help {
            width: 95%;
            padding: 16px;
          }
          .help-table {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
});

export default Products;
