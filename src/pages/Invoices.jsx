// frontend/src/pages/Invoices.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import Select from "react-select";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import {
  invoiceService,
  productService,
  customerService,
  stockService,
  settingsService,
} from "../services/apiService";
import { confirm } from "../services/notificationService";
import { useLanguage } from "../contexts/LanguageContext";
import { useAction } from "../contexts/ActionContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";

// Types de factures
const invoiceTypes = [
  {
    value: "FN",
    label: "Facture Normale",
    icon: "📄",
    color: "#10b981",
    affectsStock: true,
    stockType: "out",
  },
  {
    value: "FA",
    label: "Facture d'Avoir",
    icon: "🔄",
    color: "#f59e0b",
    affectsStock: true,
    stockType: "in",
  },
  {
    value: "RC",
    label: "Remboursement Caution",
    icon: "💰",
    color: "#3b82f6",
    affectsStock: false,
    stockType: null,
  },
  {
    value: "RHF",
    label: "Réduction Hors Facture",
    icon: "🏷️",
    color: "#8b5cf6",
    affectsStock: false,
    stockType: null,
  },
];

const paymentMethods = [
  { value: "cash", label: "Espèces", icon: "💵" },
  { value: "bank", label: "Virement bancaire", icon: "🏦" },
  { value: "credit", label: "A crédit", icon: "📱" },
  { value: "autre", label: "Autres", icon: "📝" },
];

const itemsPerPageOptions = [5, 10, 25, 50, 100];

const Invoices = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const fileInputRef = useRef(null);
  const isDark = theme === "dark";

  // ========== ÉTATS ==========
  const [invoices, setInvoices] = useState([]);
  const [_products, setProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [_warehouses, setWarehouses] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showProductsSection, setShowProductsSection] = useState(true);

  // États pour les améliorations
  const [sortField, setSortField] = useState("invoice_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [stats, setStats] = useState({
    total_invoices: 0,
    total_amount: 0,
    total_paid: 0,
    overdue_count: 0,
  });
  const [reminderLoading, setReminderLoading] = useState(null);

  // États des modaux
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [ebmsLogsModalOpen, setEbmsLogsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [ebmsLogs, setEbmsLogs] = useState([]);

  // États des filtres
  const [filters, setFilters] = useState({
    invoice_number: "",
    customer_name: "",
    customer_TIN: "",
    invoice_type: "",
    payment_status: "",
    ebms_status: "",
    date_from: "",
    date_to: "",
    min_amount: "",
    max_amount: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({});

  // États pour le formulaire
  const [formData, setFormData] = useState({
    invoice_type: "FN",
    customer_id: null,
    customer_name: "",
    customer_TIN: "",
    customer_address: "",
    customer_email: "",
    customer_phone: "",
    vat_customer_payer: false,
    invoice_date: new Date().toISOString().slice(0, 16),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    payment_type: "1",
    invoice_currency: "BIF",
    warehouse_id: null,
    notes: "",
    discount_percent: 0,
    discount_amount: 0,
    shipping_cost: 0,
  });

  const [invoiceItems, setInvoiceItems] = useState([
    {
      id: Date.now(),
      product_id: null,
      quantity: 1,
      unit_price: 0,
      total: 0,
      final_total: 0,
      product_name: "",
      product_code: "",
      unit: "",
      tax_rate: 18,
      ct_tax_rate: 0,
      tl_tax_rate: 0,
      tsce_tax: 0,
      ott_tax: 0,
      vat_amount: 0,
      ct_amount: 0,
      tl_amount: 0,
      tsce_amount: 0,
      ott_amount: 0,
      discount_percent: 0,
      discount_amount: 0,
      available_stock: 0,
      stock_warning: false,
    },
  ]);

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: "cash",
    payment_date: new Date().toISOString().slice(0, 16),
    reference: "",
    notes: "",
  });

  // États pour les loaders
  const [submitLoading, setSubmitLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(null);
  const [emailLoading, setEmailLoading] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);

  // État pour le dropdown avec Portal
  const [dropdownState, setDropdownState] = useState({
    visible: false,
    invoiceId: null,
    position: { top: 0, left: 0 },
    invoice: null,
  });

  // ========== STATUTS ==========
  const invoiceStatuses = {
    draft: { label: "draft", color: "#64748b", icon: "📝", bg: "#f1f5f9" },
    pending: { label: "pending", color: "#f59e0b", icon: "⏳", bg: "#fef3c7" },
    paid: { label: "paid", color: "#10b981", icon: "✅", bg: "#d1fae5" },
    partial: { label: "partial", color: "#3b82f6", icon: "🔄", bg: "#dbeafe" },
    overdue: { label: "overdue", color: "#ef4444", icon: "⚠️", bg: "#fee2e2" },
    cancelled: {
      label: "cancelled",
      color: "#dc2626",
      icon: "❌",
      bg: "#fef2f2",
    },
  };

  const ebmsStatuses = {
    PENDING: {
      label: "ebms_pending",
      color: "#f59e0b",
      icon: "⏳",
      bg: "#fef3c7",
    },
    SENT: { label: "ebms_sent", color: "#3b82f6", icon: "📤", bg: "#dbeafe" },
    ACKNOWLEDGED: {
      label: "ebms_acknowledged",
      color: "#10b981",
      icon: "✅",
      bg: "#d1fae5",
    },
    FAILED: {
      label: "ebms_failed",
      color: "#ef4444",
      icon: "❌",
      bg: "#fee2e2",
    },
  };

  // ========== STYLES POUR REACT-SELECT ==========
  const selectStyles = {
    control: (base) => ({
      ...base,
      background: isDark ? "#1e293b" : "#ffffff",
      borderColor: isDark ? "#334155" : "#e2e8f0",
      minHeight: "38px",
      cursor: "pointer",
    }),
    menu: (base) => ({
      ...base,
      background: isDark ? "#1e293b" : "#ffffff",
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused
        ? isDark
          ? "#334155"
          : "#f1f5f9"
        : isDark
          ? "#1e293b"
          : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
      cursor: "pointer",
    }),
    singleValue: (base) => ({
      ...base,
      color: isDark ? "#f1f5f9" : "#1e293b",
    }),
    input: (base) => ({
      ...base,
      color: isDark ? "#f1f5f9" : "#1e293b",
    }),
    placeholder: (base) => ({
      ...base,
      color: isDark ? "#94a3b8" : "#64748b",
    }),
  };

  // ========== AFFICHER CONFIRMATION SWEETALERT ==========
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

  // ========== CHARGEMENT DES PARAMÈTRES ==========
  /*const loadSettings = useCallback(async () => {
    try {
      const { authFetchJson } = await import('../utils/authFetch');
      const { data: settingsData } = await authFetchJson('/api/settings');
      const response = { json: async () => settingsData };

      
      if (response.ok) {
        const result = await response.json();
        const settingsObj = {};
        if (result.data && Array.isArray(result.data)) {
          result.data.forEach(setting => {
            settingsObj[setting.setting_key] = setting.setting_value;
          });
        }
        setSettings(settingsObj);
      }
    } catch (error) {
      console.error("Erreur chargement settings:", error);
    }
  }, []);*/
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState(false);

  const [settings, setSettings] = useState({
    company_name: "",
    company_nif: "",
    company_rc: "",
    company_center: "",
    company_activity: "",
    company_legal_form: "",
    company_phone: "",
    company_commune: "",
    company_address: "",
    company_email: "",
    company_logo: "",
    invoice_footer_text: "",
    invoice_validity_days: "30",
    company_is_subject_to_vat: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.getAll();
      if (response.data?.success) {
        let settingsData = response.data.data;
        if (Array.isArray(settingsData)) {
          settingsData = settingsData.reduce((acc, setting) => {
            acc[setting.setting_key] = setting.setting_value;
            return acc;
          }, {});
        }
        setSettings((prev) => ({ ...prev, ...settingsData }));
        if (settingsData.company_logo) {
          setLogoPreview(settingsData.company_logo);
          setLogoError(false);
        }
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error(t("error_loading_settings"));
    } finally {
      setLoading(false);
    }
  };

  // ========== CHARGEMENT DES STATISTIQUES ==========
  const loadStats = useCallback(async () => {
    try {
      const response = await invoiceService.getStats({
        date_from: appliedFilters.date_from,
        date_to: appliedFilters.date_to,
      });
      if (response.data?.success) {
        setStats(response.data.data || {});
      }
    } catch (error) {
      console.error("Erreur chargement stats:", error);
    }
  }, [appliedFilters.date_from, appliedFilters.date_to]);

  // ========== CHARGEMENT DES DONNÉES ==========
  const loadInvoices = useCallback(
    async (params = {}, page = 1) => {
      setLoading(true);
      try {
        const cleanParams = {
          ...params,
          page,
          limit: itemsPerPage,
          sort: sortField,
          order: sortOrder,
        };

        const response = await invoiceService.getAll(cleanParams);
        setInvoices(response.data?.data || []);
        setTotalItems(response.data?.pagination?.total || 0);
        setCurrentPage(page);
        setAppliedFilters(params);
        await loadStats();
      } catch (error) {
        console.error("Erreur chargement factures:", error);
        toast.error(t("error_loading_invoices"));
      } finally {
        setLoading(false);
      }
    },
    [itemsPerPage, sortField, sortOrder, loadStats, t],
  );

  const loadReferenceData = useCallback(async () => {
    try {
      const [productsRes, customersRes, warehousesRes] = await Promise.all([
        productService.getAll({ limit: 9999, is_active: 1 }),
        customerService.getAll(),
        stockService.getWarehouses(),
      ]);

      const productsData = productsRes.data?.data || [];
      setProducts(productsData);
      setProductOptions(
        productsData.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.code}) - ${(p.selling_price || 0).toLocaleString()} FBu`,
          unit: p.unit,
          selling_price: p.selling_price || 0,
          tax_rate: p.tax_rate || 18,
          ct_tax_rate: p.ct_tax_rate || 0,
          tl_tax_rate: p.tl_tax_rate || 0,
          code: p.code,
          name: p.name,
          current_stock: p.current_stock || 0,
        })),
      );

      const customersData = customersRes.data?.data || [];
      console.log("Customers data sample:", customersData[0]);
      setCustomers(customersData);
      setCustomerOptions(
        customersData.map((c) => ({
          value: c.id,
          label: `${c.display_name || c.first_name + " " + c.last_name}${c.code ? ` (${c.code})` : ""}`,
          tin: c.tin || c.tax_number,
          address: c.address_line1 || c.billing_address || c.shipping_address,
          name: c.display_name || c.first_name + " " + c.last_name || c.name,
          email: c.email,
          phone: c.phone,
          is_vat_subject: c.is_vat_subject === "1" || c.is_vat_subject === 1,
        })),
      );

      const warehousesData = warehousesRes.data?.data || [];
      setWarehouses(warehousesData);
      setWarehouseOptions(
        warehousesData.map((w) => ({
          value: w.id,
          label: `${w.name} (${w.code})`,
        })),
      );
    } catch (error) {
      console.error("Erreur chargement données référence:", error);
      toast.error(t("error_loading_reference_data"));
    }
  }, [t]);

  // ========== RÉCUPÉRATION DU STOCK ==========
  const fetchProductStock = async (productId, warehouseId) => {
    if (!productId || !warehouseId) return 0;
    try {
      const response = await stockService.getProductStock(
        productId,
        warehouseId,
      );
      return (
        response.data?.current_stock || response.data?.data?.current_stock || 0
      );
    } catch (error) {
      console.error("Erreur chargement stock:", error);
      return 0;
    }
  };

  // Vérifier le stock pour un produit spécifique
  const checkSingleProductStock = async (productId, quantity, itemId) => {
    const warehouseId = formData.warehouse_id?.value;
    if (!warehouseId) {
      // Pas d'entrepôt sélectionné, pas de vérification
      return;
    }

    const availableStock = await fetchProductStock(productId, warehouseId);
    const stockWarning = quantity > availableStock;

    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            available_stock: availableStock,
            stock_warning: stockWarning,
          };
        }
        return item;
      }),
    );

    if (stockWarning) {
      const product = productOptions.find((p) => p.value === productId);
      toast.error(
        `⚠️ Stock insuffisant pour ${product?.name || "ce produit"}. Disponible: ${availableStock} ${product?.unit || ""}, Demandé: ${quantity}`,
      );
    }
  };

  // Mettre à jour le stock pour tous les produits (quand l'entrepôt change)
  const updateAllProductsStock = async (warehouseId) => {
    if (!warehouseId) return;
    setCheckingStock(true);

    const updatedItems = await Promise.all(
      invoiceItems.map(async (item) => {
        if (item.product_id && item.quantity > 0) {
          const availableStock = await fetchProductStock(
            item.product_id,
            warehouseId,
          );
          const stockWarning = item.quantity > availableStock;
          if (stockWarning) {
            const product = productOptions.find(
              (p) => p.value === item.product_id,
            );
            toast.error(
              `⚠️ Stock insuffisant pour ${product?.name || "ce produit"}. Disponible: ${availableStock} ${product?.unit || ""}`,
            );
          }
          return {
            ...item,
            available_stock: availableStock,
            stock_warning: stockWarning,
          };
        }
        return { ...item, available_stock: 0, stock_warning: false };
      }),
    );
    setInvoiceItems(updatedItems);
    setCheckingStock(false);
  };

  // ========== GESTION DES ITEMS CORRIGÉE ==========
  const addInvoiceItem = () => {
    const newItem = {
      id: Date.now(),
      product_id: null,
      quantity: 1,
      unit_price: 0,
      total: 0,
      final_total: 0,
      product_name: "",
      product_code: "",
      unit: "",
      tax_rate: 18,
      ct_tax_rate: 0,
      tl_tax_rate: 0,
      tsce_tax: 0,
      ott_tax: 0,
      vat_amount: 0,
      ct_amount: 0,
      tl_amount: 0,
      tsce_amount: 0,
      ott_amount: 0,
      discount_percent: 0,
      discount_amount: 0,
      available_stock: 0,
      stock_warning: false,
    };

    setInvoiceItems((prev) => [...prev, newItem]);

    // Si un entrepôt est déjà sélectionné et qu'on ajoute un nouveau produit,
    // il faudra vérifier le stock après sélection du produit
  };

  const removeInvoiceItem = (id) => {
    if (invoiceItems.length === 1) {
      toast.error(t("at_least_one_product"));
      return;
    }
    setInvoiceItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateInvoiceItem = async (id, field, value) => {
    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === "product_id") {
            const selectedProduct = productOptions.find(
              (p) => p.value === value,
            );
            if (selectedProduct) {
              updated.product_name = selectedProduct.name;
              updated.product_code = selectedProduct.code;
              updated.unit = selectedProduct.unit;
              updated.unit_price = selectedProduct.selling_price;
              updated.tax_rate = selectedProduct.tax_rate;
              updated.ct_tax_rate = selectedProduct.ct_tax_rate || 0;
              updated.tl_tax_rate = selectedProduct.tl_tax_rate || 0;
              updated.tsce_tax = selectedProduct.tsce_tax || 0;
              updated.ott_tax = selectedProduct.ott_tax || 0;
            }
          }

          if (
            field === "product_id" ||
            field === "quantity" ||
            field === "unit_price" ||
            field === "discount_percent" ||
            field === "tax_rate" ||
            field === "ct_tax_rate" ||
            field === "tl_tax_rate" ||
            field === "tsce_tax" ||
            field === "ott_tax"
          ) {
            const qty = parseFloat(updated.quantity) || 0;
            const price = parseFloat(updated.unit_price) || 0;
            const discountPercent = parseFloat(updated.discount_percent) || 0;

            updated.total = qty * price;
            updated.discount_amount = updated.total * (discountPercent / 100);
            updated.final_total = updated.total - updated.discount_amount;

            // CALCUL TVA CONDITIONNEL
            // La TVA n'est appliquée que si le client est assujetti
            if (formData.vat_customer_payer) {
              updated.vat_amount =
                updated.final_total * (updated.tax_rate / 100);
            } else {
              updated.vat_amount = 0; // Pas de TVA pour les clients non assujettis
            }

            updated.ct_amount =
              updated.final_total * (updated.ct_tax_rate / 100);
            updated.tl_amount =
              updated.final_total * (updated.tl_tax_rate / 100);
            updated.tsce_amount =
              updated.final_total * (updated.tsce_tax / 100);
            updated.ott_amount = updated.final_total * (updated.ott_tax / 100);
          }
          return updated;
        }
        return item;
      }),
    );

    // Vérification du stock (reste inchangée)
    const warehouseId = formData.warehouse_id?.value;
    if (!warehouseId) return;

    if (field === "product_id" && value) {
      const newQuantity = invoiceItems.find((i) => i.id === id)?.quantity || 1;
      const availableStock = await fetchProductStock(value, warehouseId);
      const stockWarning = newQuantity > availableStock;

      setInvoiceItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              available_stock: availableStock,
              stock_warning: stockWarning,
            };
          }
          return item;
        }),
      );
    }

    if (field === "quantity") {
      const item = invoiceItems.find((i) => i.id === id);
      if (item && item.product_id) {
        const newQuantity = parseFloat(value) || 0;
        const availableStock = await fetchProductStock(
          item.product_id,
          warehouseId,
        );
        const stockWarning = newQuantity > availableStock;

        setInvoiceItems((prev) =>
          prev.map((i) => {
            if (i.id === id) {
              return {
                ...i,
                available_stock: availableStock,
                stock_warning: stockWarning,
              };
            }
            return i;
          }),
        );
      }
    }

    // Après la mise à jour, vérifier le stock si nécessaire
    if (field === "product_id" && value && formData.warehouse_id?.value) {
      // Produit sélectionné - vérifier immédiatement le stock
      const item = invoiceItems.find((i) => i.id === id);
      if (item) {
        await checkSingleProductStock(value, item.quantity, id);
      }
    }

    if (field === "quantity" && value && formData.warehouse_id?.value) {
      // Quantité modifiée - vérifier si un produit est sélectionné
      const item = invoiceItems.find((i) => i.id === id);
      if (item && item.product_id) {
        await checkSingleProductStock(item.product_id, parseFloat(value), id);
      }
    }
  };

  // Ajoutez cette fonction après vos autres fonctions, par exemple après `updateInvoiceItem`
  const getSelectedProductIds = () => {
    return invoiceItems
      .filter((item) => item.product_id !== null)
      .map((item) => item.product_id);
  };

  // Ajoutez une fonction pour vérifier si tous les produits disponibles sont sélectionnés
  const isAllProductsSelected = () => {
    const selectedIds = getSelectedProductIds();
    return (
      selectedIds.length >= productOptions.length && productOptions.length > 0
    );
  };

  // Ajoutez cette fonction pour obtenir les options disponibles pour un item spécifique
  const getAvailableProductOptions = (currentItemId) => {
    const selectedProductIds = getSelectedProductIds();

    return productOptions.filter((option) => {
      // Si c'est le produit actuel, on le garde (permettre de le modifier)
      const currentItem = invoiceItems.find(
        (item) => item.id === currentItemId,
      );
      if (currentItem && currentItem.product_id === option.value) {
        return true;
      }
      // Sinon, on exclut les produits déjà sélectionnés ailleurs
      return !selectedProductIds.includes(option.value);
    });
  };

  // ========== CALCULS ==========
  const getSubtotal = () =>
    invoiceItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const getItemsDiscountTotal = () =>
    invoiceItems.reduce(
      (sum, item) => sum + (Number(item.discount_amount) || 0),
      0,
    );
  const getGlobalDiscount = () => {
    const subtotal = getSubtotal();
    const percentDiscount = parseFloat(formData.discount_percent) || 0;
    const fixedDiscount = parseFloat(formData.discount_amount) || 0;
    return (
      (Number(subtotal) * percentDiscount) / 100 + Number(fixedDiscount || 0)
    );
  };
  const getDiscountTotal = () =>
    Number(getItemsDiscountTotal() || 0) + Number(getGlobalDiscount() || 0);

  // HTVA = montant après remises (items après remises + global discount)
  const getHTVA = () => getSubtotal() - getDiscountTotal();

  const getVatTotal = () => {
    // Si le client n'est pas assujetti à la TVA, retourner 0
    if (!formData.vat_customer_payer) return 0;
    return invoiceItems.reduce(
      (sum, item) => sum + (Number(item.vat_amount) || 0),
      0,
    );
  };

  // getCtTotal et getTlTotal restent inchangés
  const getCtTotal = () => {
    return invoiceItems.reduce(
      (sum, item) => sum + (Number(item.ct_amount) || 0),
      0,
    );
  };

  const getTlTotal = () => {
    return invoiceItems.reduce(
      (sum, item) => sum + (Number(item.tl_amount) || 0),
      0,
    );
  };

  // TSCE and OTT amounts are computed per-item if available (fallback to 0)
  const getTsceTotal = () => {
    return invoiceItems.reduce((sum, item) => {
      const base = Number(
        item.total_amount || item.final_total || item.total || 0,
      );
      const rate = parseFloat(item.tsce_tax || item.tsce_amount || 0) || 0;
      return sum + base * (rate / 100);
    }, 0);
  };

  const getOttTotal = () => {
    return invoiceItems.reduce((sum, item) => {
      const base = Number(
        item.total_amount || item.final_total || item.total || 0,
      );
      const rate = parseFloat(item.ott_tax || item.ott_amount || 0) || 0;
      return sum + base * (rate / 100);
    }, 0);
  };

  const getTVAC = () => {
    return getHTVA() + getVatTotal();
  };

  const getTTC = () => {
    return (
      getTVAC() +
      getCtTotal() +
      getTlTotal() +
      getTsceTotal() +
      getOttTotal() +
      getShippingCost()
    );
  };

  const getGrandTotal = () => {
    return getTTC();
  };

  //const getVatTotal = () => invoiceItems.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
  //const getCtTotal = () => invoiceItems.reduce((sum, item) => sum + (item.ct_amount || 0), 0);
  //const getTlTotal = () => invoiceItems.reduce((sum, item) => sum + (item.tl_amount || 0), 0);
  const getShippingCost = () => parseFloat(formData.shipping_cost) || 0;
  //const getGrandTotal = () => getSubtotal() - getDiscountTotal() + getVatTotal() + getCtTotal() + getTlTotal() + getShippingCost();

  // ========== VÉRIFICATION DU STOCK ==========
  /* const checkStockAvailability = async () => {
    const warehouseId = formData.warehouse_id?.value;
    const currentType = invoiceTypes.find((t) => t.value === formData.invoice_type);
    if (currentType?.stockType !== "out") return true;
    if (!warehouseId) {
      toast.error(t("select_warehouse_first"));
      return false;
    }
    let hasError = false;
    for (const item of invoiceItems) {
      if (item.product_id && item.quantity > 0 && item.quantity > item.available_stock) {
        toast.error(`Stock insuffisant pour ${item.product_name}. Disponible: ${item.available_stock} ${item.unit}`);
        hasError = true;
      }
    }
    return !hasError;
  };*/

  // ========== VÉRIFICATION DU STOCK AVANT SOUMISSION ==========
  const checkStockAvailability = async () => {
    const warehouseId = formData.warehouse_id?.value;
    const currentType = invoiceTypes.find(
      (t) => t.value === formData.invoice_type,
    );

    if (currentType?.stockType !== "out") return true;

    if (!warehouseId) {
      toast.error(t("select_warehouse_first"));
      return false;
    }

    let hasError = false;
    for (const item of invoiceItems) {
      if (item.product_id && item.quantity > 0) {
        // Rafraîchir le stock avant vérification
        const availableStock = await fetchProductStock(
          item.product_id,
          warehouseId,
        );
        if (item.quantity > availableStock) {
          toast.error(
            `⚠️ Stock insuffisant pour ${item.product_name}. Disponible: ${availableStock} ${item.unit}, Demandé: ${item.quantity}`,
          );
          hasError = true;
        }
      }
    }
    return !hasError;
  };

  // ========== CRUD FACTURES ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = invoiceItems.filter(
      (item) => item.product_id && item.quantity > 0,
    );
    const currentType = invoiceTypes.find(
      (t) => t.value === formData.invoice_type,
    );

    // Validation des produits obligatoires seulement pour les factures qui affectent le stock
    if (
      currentType?.affectsStock &&
      formData.invoice_type !== "FA" &&
      validItems.length === 0
    ) {
      toast.error(t("at_least_one_product"));
      return;
    }

    // Validation des champs spécifiques à FA (Facture d'Avoir) et RC (Remboursement Caution)
    if (
      (formData.invoice_type === "FA" || formData.invoice_type === "RC") &&
      !formData.invoice_ref
    ) {
      toast.error(
        formData.invoice_type === "RC"
          ? t("invoice_ref_required")
          : t("invoice_ref_required"),
      );
      return;
    }

    if (formData.invoice_type === "FA" && !formData.cn_motif) {
      toast.error(t("cn_motif_required"));
      return;
    }

    // Valider que la facture référencée existe et récupérer son montant pour FA
    if (formData.invoice_type === "FA" && formData.invoice_ref) {
      const refInvoice = invoices.find(
        (inv) => inv.invoice_number === formData.invoice_ref,
      );
      if (!refInvoice) {
        toast.error(t("invoice_ref_not_found"));
        return;
      }
      // Valider que le montant d'avoir ne dépasse pas le montant original
      const creditNoteAmount = getGrandTotal();
      if (creditNoteAmount > refInvoice.total_amount) {
        toast.error(t("credit_note_amount_exceeds_original"));
        return;
      }
    }

    const stockOk = await checkStockAvailability();
    if (!stockOk) return;

    let customerId = null;
    let customerName = formData.customer_name;
    let customerTIN = formData.customer_TIN;
    let customerAddress = formData.customer_address;
    let customerEmail = formData.customer_email;
    let customerPhone = formData.customer_phone;
    let isVatSubject = false;

    if (formData.customer_id?.value) {
      customerId = formData.customer_id.value;
      const selectedCustomer = customers.find((c) => c.id === customerId);
      if (selectedCustomer) {
        customerName =
          selectedCustomer.display_name ||
          selectedCustomer.first_name + " " + selectedCustomer.last_name;
        customerTIN = selectedCustomer.tin || selectedCustomer.tax_number;
        customerAddress =
          selectedCustomer.address_line1 || selectedCustomer.billing_address;
        customerEmail = selectedCustomer.email || "";
        customerPhone = selectedCustomer.phone || "";
        isVatSubject = selectedCustomer.is_vat_subject === 1;
      }
    }

    if (!customerId && !customerName) {
      toast.error(t("customer_required"));
      return;
    }

    const confirmed = await showConfirmDialog(
      editingInvoice ? t("confirm_update") : t("confirm_create"),
      editingInvoice ? t("update_confirmation") : t("create_confirmation"),
      editingInvoice ? t("save") : t("create"),
    );
    if (!confirmed) return;

    setSubmitLoading(true);
    try {
      const payload = {
        invoice_type: formData.invoice_type,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        invoice_currency: formData.invoice_currency || "BIF",
        payment_type: formData.payment_type || "1",
        notes: formData.notes || "",
        warehouse_id: formData.warehouse_id?.value || null,
        customer_id: customerId,
        customer_name: customerName,
        customer_TIN: customerTIN || null,
        customer_address: customerAddress || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        vat_customer_payer: formData.vat_customer_payer ? 1 : 0,
        discount_percent: parseFloat(formData.discount_percent) || 0,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        shipping_cost: parseFloat(formData.shipping_cost) || 0,
        htva: getHTVA(),
        tvac: getTVAC(),
        discount_total: getDiscountTotal(),
        vat_amount: getVatTotal(),
        ct_amount: getCtTotal(),
        tl_amount: getTlTotal(),
        shipping_amount: getShippingCost(),
        total_amount: getTTC(),
        invoice_ref: formData.invoice_ref || null,
        cn_motif: formData.cn_motif || null,
        items: validItems.map((item) => {
          // HTVA = prix hors TVA (prix après remise)
          const HTVA = +(item.final_total || item.total || 0);
          // TVA amount déjà calculée: item.vat_amount
          const TVAC = +(HTVA + (item.vat_amount || 0)); // prix avec TVA
          // TTC (TVAC + autres taxes OTT & TSCE)
          const TTC = +(
            TVAC +
            (item.ott_amount || 0) +
            (item.tsce_amount || 0)
          );

          return {
            product_id: item.product_id,
            item_code: item.product_code,
            item_designation: item.product_name,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            item_price_nvat: Number(HTVA.toFixed(2)), // HTVA
            item_price_wvat: Number(TVAC.toFixed(2)), // TVAC
            discount_percent: Number(item.discount_percent) || 0,
            discount_amount: Number(item.discount_amount) || 0,
            total_amount: Number(HTVA) || 0,
            vat_amount: Number(item.vat_amount) || 0,
            ct_amount: Number(item.ct_amount) || 0,
            tl_amount: Number(item.tl_amount) || 0,
            tsce_tax: Number(item.tsce_tax) || 0,
            ott_tax: Number(item.ott_tax) || 0,
            tax_rate: Number(item.tax_rate) || 18,
            ttc_amount: Number(TTC.toFixed(2)),
          };
        }),
      };

      if (editingInvoice) {
        await invoiceService.update(editingInvoice.id, payload);
        toast.success(t("invoice_updated"));
      } else {
        const response = await invoiceService.create(payload);
        toast.success(t("invoice_created"));
        if (attachedFiles.length > 0 && response.data?.id) {
          const formDataFiles = new FormData();
          attachedFiles.forEach((file) =>
            formDataFiles.append("attachments[]", file.file),
          );
          await invoiceService.addAttachments(response.data.id, formDataFiles);
        }
      }
      loadInvoices(appliedFilters, currentPage);
      closeModal();
      resetForm();
    } catch (error) {
      console.error("Erreur création facture:", error);
      toast.error(error.response?.data?.message || t("error_creating_invoice"));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = async (invoice) => {
    const reason = prompt(t("cancel_reason") || "Raison de l'annulation:");
    if (!reason) return;
    const confirmed = await showConfirmDialog(
      t("confirm_cancel_invoice"),
      `${t("confirm_cancel_invoice_desc")} ${invoice.invoice_number} ?`,
      t("confirm"),
      "#dc2626",
    );
    if (!confirmed) return;
    setCancelLoading(invoice.id);
    try {
      await invoiceService.cancel(invoice.id, { reason });
      toast.success(t("invoice_cancelled"));
      loadInvoices(appliedFilters, currentPage);
    } catch (error) {
      console.error("Erreur annulation:", error);
      toast.error(t("error_cancelling_invoice"));
    } finally {
      setCancelLoading(null);
    }
  };

  // ========== ACTIONS EBMS ==========
  const syncWithEBMS = async (invoice) => {
    setSyncLoading(invoice.id);
    toast.loading(t("syncing_invoice"), { id: "ebms_sync" });
    try {
      await invoiceService.syncWithEBMS(invoice.id);
      toast.success(t("invoice_synced"), { id: "ebms_sync" });
      loadInvoices(appliedFilters, currentPage);
    } catch (error) {
      console.error("Erreur synchronisation EBMS:", error);
      toast.error(error.response?.data?.message || t("error_syncing_invoice"), {
        id: "ebms_sync",
      });
    } finally {
      setSyncLoading(null);
    }
  };

  const verifyInvoiceWithEBMS = async (invoice) => {
    setSyncLoading(invoice.id);
    toast.loading(t("verifying_invoice") || "Vérification EBMS en cours...", {
      id: "ebms_verify",
    });
    try {
      await invoiceService.verify(invoice.id);
      toast.success(t("invoice_verified") || "Facture vérifiée", {
        id: "ebms_verify",
      });
      loadInvoices(appliedFilters, currentPage);
    } catch (error) {
      console.error("Erreur de vérification EBMS:", error);
      toast.error(
        error.response?.data?.message || t("error_verifying_invoice"),
        {
          id: "ebms_verify",
        },
      );
    } finally {
      setSyncLoading(null);
    }
  };

  const viewEbmsLogs = async (invoice) => {
    setSelectedInvoice(invoice);
    try {
      const response = await invoiceService.getEbmsLogs(invoice.id);
      setEbmsLogs(response.data?.data || []);
      setEbmsLogsModalOpen(true);
    } catch (error) {
      console.error("Erreur chargement logs EBMS:", error);
      toast.error(t("error_loading_ebms_logs"));
    }
  };

  // ========== ACTIONS EMAIL ==========
  const sendByEmail = async (invoice) => {
    const customerEmail =
      invoice.customer_email ||
      customers.find((c) => c.id === invoice.customer_id)?.email;
    if (!customerEmail && !window.confirm(t("no_customer_email_continue")))
      return;
    setEmailLoading(invoice.id);
    toast.loading(t("sending_email"), { id: "email_send" });
    try {
      await invoiceService.sendEmail(invoice.id);
      toast.success(t("email_sent"), { id: "email_send" });
    } catch (error) {
      console.error("Erreur envoi email:", error);
      toast.error(t("error_sending_email"), { id: "email_send" });
    } finally {
      setEmailLoading(null);
    }
  };

  const sendPaymentReminder = async (invoice) => {
    setReminderLoading(invoice.id);
    toast.loading(t("sending_reminder"), { id: "reminder_send" });
    try {
      await invoiceService.sendPaymentReminder(invoice.id);
      toast.success(t("reminder_sent"), { id: "reminder_send" });
    } catch (error) {
      console.error("Erreur envoi rappel:", error);
      toast.error(t("error_sending_reminder"), { id: "reminder_send" });
    } finally {
      setReminderLoading(null);
    }
  };

  // ========== IMPRESSION FACTURE CORRIGÉE ==========
  const escapeHtml = (text) => {
    if (!text) return "";
    return text.replace(/[&<>]/g, (m) =>
      m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
    );
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("fr-BI", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const getInvoicePrintCss = () => `
      @page { size: A4; margin: 0; }
      html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 10pt; line-height: 1.3; background: #ffffff; color: #111; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-container { position: relative; width: 100%; max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 6mm 8mm; background: #ffffff; overflow: hidden; }
      .watermark {
        position: absolute;
        top: 52%;
        left: 52%;
        width: 90mm;
        height: 90mm;
        transform: translate(-50%, -50%) rotate(-25deg);
        opacity: 0.04;
        pointer-events: none;
        z-index: 0;
        background-repeat: no-repeat;
        background-position: center;
        background-size: 90mm auto;
      }
      .invoice-container > *:not(.watermark) { position: relative; z-index: 1; }
      .header { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 2px; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 2px; }
      .invoice-number { font-size: 10pt; font-weight: bold; margin-bottom: 0; letter-spacing: 0.5px; }
      .header .title { font-size: 18pt; font-weight: bold; letter-spacing: 1.5px; margin: 0; }
      .header .subtitle { font-size: 10pt; margin-top: 0px; color: #555; width: 100%; text-align: center; }
      .amount-words { margin-top: 8px; padding: 6px 8px; border: 1px solid #ddd; text-align: center; font-size: 9pt; background: #f9f9f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .signatures { margin-top: 4px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; }
      .invoice-ref { text-align: right; font-size: 9pt; margin: 5px 0; }
      .qr-container { float: right; width: 85px; margin-left: 10px; text-align: center; }
      .qr-container img { width: 80px; height: 80px; border: 1px solid #ddd; padding: 2px; display: block; margin: 0 auto; }
      .qr-text { font-size: 7pt; color: #666; margin-top: 4px; }
      .identities { display: flex; flex-wrap: wrap; gap: 20px; margin: 15px 0; clear: both; }
      .identity-box { flex: 1 1 45%; min-width: 200px; border: 1px solid #ddd; padding: 10px; background: #f9f9f9; border-radius: 8px; }
      .identity-title { font-weight: bold; font-size: 11pt; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #667eea; }
      .identity-content { font-size: 9pt; line-height: 1.4; }
      .identity-content p { margin: 3px 0; }
      .identity-label { font-weight: bold; display: inline-block; width: 70px; }
      .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; table-layout: fixed; }
      .items-table th, .items-table td { border: 1px solid #aaa; padding: 5px 4px; word-wrap: break-word; }
      .items-table th { background: #e8e8e8; text-align: center; font-weight: bold; }
      .items-table td { background: #fff; }
      .col-num { width: 35px; text-align: center; }
      .col-product { width: 45%; text-align: left; }
      .col-qty { width: 80px; text-align: center; }
      .col-price { width: 100px; text-align: right; }
      .col-total { width: 110px; text-align: right; }
      .totals-table { width: auto; min-width: 280px; margin-top: 10px; margin-left: auto; border-collapse: collapse; }
      .totals-table td { padding: 4px 6px; }
      .totals-table td.label { text-align: right; font-weight: bold; }
      .totals-table td.amount { text-align: right; width: 110px; }
      .grand-total { font-weight: bold; border-top: 2px solid #000; margin-top: 3px; padding-top: 3px; }
      .amount-words { margin-top: 8px; padding: 6px 8px; border: 1px solid #ddd; text-align: center; font-size: 9pt; background: #f9f9f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .signatures { margin-top: 5px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px; }
      .signature-box { text-align: center; width: 200px; }
      .signature-line { border-top: 1px solid #000; margin-top: 35px; padding-top: 5px; font-size: 8pt; }
      .footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 7pt; color: #666; }
      .vat-info { margin-top: 5px; font-size: 8pt; color: #10b981; }
      img { max-width: 100%; height: auto; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-before: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      @media print {
        @page { margin: 0; }
        html, body { width: 210mm; margin: 0; padding: 0; }
        .invoice-container { padding: 8mm; }
      }
    `;

  const getInvoicePrintFragment = (invoice) => {
    const qrData = {
      inv: invoice.invoice_number,
      date: invoice.invoice_date,
      total: invoice.total_amount || 0,
      tin: settings.company_nif || "4002141416",
    };

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(JSON.stringify(qrData))}`;

    const itemsHtml =
      invoice.items
        ?.map(
          (item, index) => `
      <tr class="item-row">
        <td class="col-num">${index + 1}</td>
        <td class="col-product">${escapeHtml(item.item_designation || item.product_name)}</td>
        <td class="col-qty">${item.quantity} ${item.unit || ""}</td>
        <td class="col-price">${formatNumber(item.unit_price)}</td>
        <td class="col-total">${formatNumber(item.total_amount || item.total)}</td>
      </tr>
    `,
        )
        .join("") ||
      '<tr><td colspan="5" class="empty-row">Aucun produit</td></tr>';
    return `
      <div class="invoice-container">
        <div class="watermark" style="background-image: url('${settings.company_logo || ""}');"></div>
        <div class="qr-container"><img src="${qrCodeUrl}" alt="QR" /><div class="qr-text">Scanner pour vérifier</div></div>
        <div class="header"><div class="title">FACTURE</div><div class="invoice-number"><strong>N° ${invoice.invoice_number}</strong></div><div class="subtitle">${invoice.payment_status || invoice.status ? `${invoice.payment_status || invoice.status} - Originale` : "Originale"}</div></div>
        <div class="invoice-ref"><strong>Date :</strong> ${new Date(invoice.invoice_date).toLocaleString("fr-BI")}<br><strong>Date d'echeance :</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("fr-BI") : "-"}</div>
        <div class="identities">
          <div class="identity-box">
            <div class="identity-title">A. Vendeur</div>
            <div class="identity-content">
              <p><strong>${escapeHtml(settings.company_name || "SM-PRO")}</strong></p>
              <p>NIF: ${settings.company_nif || "4002141416"} &nbsp;|&nbsp; RC: ${settings.company_rc || "0041847/23"}</p>
              <p>Centre Fiscal: ${escapeHtml(settings.company_center || "-")} &nbsp;|&nbsp; Forme juridique: ${escapeHtml(settings.company_legal_form || "-")}</p>
              <p>Exonéré à la TVA: ${settings.vat_exemption ? "✅" : "❌"} &nbsp;|&nbsp; Assujetti à la TVA: ${settings.company_is_subject_to_vat ? "✅" : "❌"}</p>
              <p>Assujetti à la TC : ${settings.ct_taxpayer ? " ✅" : " ❌"} &nbsp;|&nbsp; Assujetti à la PF ${settings.tl_taxpayer ? " ✅" : " ❌"}</p>
              <p>Secteur d'activité: ${escapeHtml(settings.company_activity || "-")}</p>
              <p>Adresse: ${escapeHtml(settings.company_address || "ROHERO")} &nbsp;|&nbsp; B.P: ${escapeHtml(settings.tp_address_number || "-")}&nbsp;|&nbsp;Commune: ${escapeHtml(settings.company_commune || "-")}</p>
              <p>Email: ${settings.company_email || "contact@stockmanager.com"} &nbsp;|&nbsp; Tél: ${settings.company_phone || "69377364"}</p>
            </div>
          </div>
          <div class="identity-box">
            <div class="identity-title">B. Client</div>
            <div class="identity-content">
              <p><strong>${escapeHtml(invoice.customer_name)}</strong></p>
              <p>NIF: ${invoice.customer_TIN || "-"}</p>
              <p>Adresse: ${escapeHtml(invoice.customer_address || "-")}</p>
              ${invoice.customer_email ? `<p>Email: ${invoice.customer_email}</p>` : ""}
              ${invoice.customer_phone ? `<p>Tél: ${invoice.customer_phone}</p>` : ""}
              <div class="vat-info">Assujetti à la TVA: ${invoice.vat_customer_payer === "1" || invoice.vat_customer_payer === 1 ? "✅" : "❌"}</div>
              <p style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; font-style: italic; color: #666;"><strong>Doit pour ce qui suit</strong></p>
            </div>
          </div>
        </div>
        <div class="identity-box">
          <div class="identity-title">Articles</div>
          <table class="items-table"><thead><tr><th class="col-num">N°</th><th class="col-product">Désignation</th><th class="col-qty">Qté</th><th class="col-price">PV.U</th><th class="col-total">Montant(TTC)</th></tr></thead><tbody>${itemsHtml}</tbody></table>
          
          <table class="totals-table">
            <tr><td class="label">PV HTT :</td><td class="amount">${formatNumber(invoice.subtotal)} FBu</td></tr>
            ${(invoice.discount_total || 0) > 0 ? `<tr><td class="label">Remise :</td><td class="amount">-${formatNumber(invoice.discount_total || 0)} FBu</td></tr>` : ``}
            <tr><td class="label">PV HTVA :</td><td class="amount">${formatNumber(invoice.subtotal - (invoice.discount_total || 0))} FBu</td></tr>
            <tr><td class="label">TVA (18%) :</td><td class="amount">${formatNumber(invoice.vat_amount || 0)} FBu</td></tr>
            <tr><td class="label">TC :</td><td class="amount">${formatNumber(invoice.ct_amount || 0)} FBu</td></tr>
            <tr><td class="label">PF :</td><td class="amount">${formatNumber(invoice.tl_amount || 0)} FBu</td></tr>
            <tr><td class="label">TSCE :</td><td class="amount">${formatNumber(invoice.tsce_amount || 0)} FBu</td></tr>
            <tr><td class="label">OTT :</td><td class="amount">${formatNumber(invoice.ott_amount || 0)} FBu</td></tr>
            ${(invoice.shipping_amount || 0) > 0 ? `<tr><td class="label">Frais livraison :</td><td class="amount">${formatNumber(invoice.shipping_amount || 0)} FBu</td></tr>` : ``}
            <tr class="grand-total"><td class="label"><strong>TOTAL (${invoice.invoice_currency || "FBu"}) :</strong></td><td class="amount"><strong>${formatNumber(invoice.total_amount)} ${invoice.invoice_currency || "FBu"}</strong></td></tr>
          </table>
        </div>
        <div class="amount-words"><strong>Arrêté la présente facture à la somme de : ${formatNumber(invoice.total_amount)} FBu</strong> - Toutes taxes comprises</div>
        <div class="signatures"><div class="signature-box"><div class="signature-line">Signature du client</div><div style="font-size: 7pt; margin-top: 0;">Lu et approuvé</div></div><div class="signature-box"><div class="signature-line">Cachet et signature</div><div style="font-size: 7pt; margin-top: 0;">${escapeHtml(settings.company_name || "SM-PRO")}</div></div></div>
        <div class="footer"><p>${settings.invoice_footer_text || "Merci de votre confiance"} | ${new Date().toLocaleString("fr-BI")}</p></div>
      </div>
    `;
  };

  const getInvoicePrintHtml = (invoice) => `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <link rel="icon" type="image/png" href="%PUBLIC_URL%/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="%PUBLIC_URL%/favicon.svg" />
        <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="%PUBLIC_URL%/apple-touch-icon.png" />
        <link rel="manifest" href="%PUBLIC_URL%/site.webmanifest" />
        <title>FACTURE ${invoice.invoice_number}</title>
        <style>${getInvoicePrintCss()}</style>
      </head>
      <body>${getInvoicePrintFragment(invoice)}</body>
    </html>`;

  const printInvoice = async (invoice) => {
    setPrintLoading(true);
    try {
      const html = getInvoicePrintHtml(invoice);
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error(
          t("popup_blocked") ||
            "Veuillez autoriser les popups pour l'impression.",
        );
        return;
      }

      const script = `
        <script>
          let printStarted = false;

          function closeWindow() {
            try {
              window.close();
            } catch (e) {
              // ignore
            }
            if (window.opener && !window.opener.closed) {
              window.opener.focus();
            }
          }

          function handlePrintClose() {
            if (printStarted) {
              closeWindow();
            }
          }

          window.onload = function() {
            window.focus();
            setTimeout(function() {
              printStarted = true;
              window.print();
            }, 100);
          };

          window.onafterprint = function() {
            handlePrintClose();
          };

          window.onbeforeunload = function() {
            handlePrintClose();
          };

          window.onfocus = function() {
            handlePrintClose();
          };
        <\/script>
      `;

      printWindow.document.write(html.replace("</body>", `${script}</body>`));
      printWindow.document.close();
    } catch (error) {
      console.error("Erreur impression:", error);
      toast.error("Erreur lors de la génération de la facture");
    } finally {
      setPrintLoading(false);
    }
  };

  const addPayment = async () => {
    const remainingAmount =
      (selectedInvoice.total_amount || 0) - (selectedInvoice.paid_amount || 0);
    if (paymentData.amount > remainingAmount) {
      toast.error(t("payment_exceeds_remaining"));
      return;
    }
    setPaymentLoading(true);
    try {
      await invoiceService.addPayment(selectedInvoice.id, paymentData);
      toast.success(t("payment_added"));
      setPaymentModalOpen(false);
      loadInvoices(appliedFilters, currentPage);
      setPaymentData({
        amount: 0,
        payment_method: "cash",
        payment_date: new Date().toISOString().slice(0, 16),
        reference: "",
        notes: "",
      });
    } catch (error) {
      console.error("Erreur ajout paiement:", error);
      toast.error(t("error_adding_payment"));
    } finally {
      setPaymentLoading(false);
    }
  };

  // ========== GESTION FICHIERS ==========
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024;
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        toast.error(`${file.name} ${t("file_too_large")}`);
        return false;
      }
      return true;
    });
    const newFiles = validFiles.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id) => {
    const file = attachedFiles.find((f) => f.id === id);
    if (file?.url) URL.revokeObjectURL(file.url);
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ========== FILTRES ==========
  const applyFilters = () => {
    const params = {};
    Object.keys(filters).forEach((key) => {
      if (filters[key]) params[key] = filters[key];
    });
    loadInvoices(params, 1);
    setFilterModalOpen(false);
    toast.success(t("filters_applied"));
  };

  const resetFilters = () => {
    setFilters({
      invoice_number: "",
      customer_name: "",
      customer_TIN: "",
      invoice_type: "",
      payment_status: "",
      ebms_status: "",
      date_from: "",
      date_to: "",
      min_amount: "",
      max_amount: "",
    });
    loadInvoices({}, 1);
    setFilterModalOpen(false);
    toast.success(t("filters_reset"));
  };

  const refreshInvoices = () => {
    loadInvoices(appliedFilters, currentPage);
    toast.success(t("refresh_success"));
  };
  const hasActiveFilters = () => Object.keys(appliedFilters).length > 0;

  // ========== ACTIONS GROUPÉES ==========
  const handleSelectAll = () =>
    setSelectedInvoices(
      selectedInvoices.length === invoices.length
        ? []
        : invoices.map((i) => i.id),
    );
  const handleSelectOne = (id) =>
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const handleBulkDelete = async () => {
    if (selectedInvoices.length === 0) {
      toast.error(t("select_invoices"));
      return;
    }
    const confirmed = await showConfirmDialog(
      t("confirm_bulk_delete"),
      t("confirm_bulk_delete_desc").replace("{count}", selectedInvoices.length),
      t("delete"),
      "#dc2626",
    );
    if (!confirmed) return;
    try {
      await invoiceService.bulkDelete(selectedInvoices);
      toast.success(
        t("bulk_delete_success").replace("{count}", selectedInvoices.length),
      );
      setSelectedInvoices([]);
      loadInvoices(appliedFilters, currentPage);
    } catch (error) {
      console.error("Erreur suppression groupée:", error);
      toast.error(t("bulk_delete_error"));
    }
  };

  const handleBulkSync = async () => {
    if (selectedInvoices.length === 0) {
      toast.error(t("select_invoices"));
      return;
    }
    const confirmed = await showConfirmDialog(
      t("confirm_bulk_sync"),
      t("confirm_bulk_sync_desc").replace("{count}", selectedInvoices.length),
      t("sync"),
    );
    if (!confirmed) return;
    toast.loading(t("syncing_invoices"), { id: "bulk_sync" });
    let successCount = 0;
    for (const id of selectedInvoices) {
      try {
        await invoiceService.syncWithEBMS(id);
        successCount++;
      } catch (error) {
        console.error(`Erreur sync facture ${id}:`, error);
      }
    }
    toast.success(t("bulk_sync_success").replace("{count}", successCount), {
      id: "bulk_sync",
    });
    setSelectedInvoices([]);
    loadInvoices(appliedFilters, currentPage);
  };

  // ========== EXPORT CSV ==========
  const exportInvoicesToCSV = async () => {
    setExportLoading(true);
    toast.loading(t("export_preparing"), { id: "export" });
    try {
      const response = await invoiceService.getAll({
        limit: 9999,
        ...appliedFilters,
      });
      const allInvoices = response.data?.data || [];
      if (allInvoices.length === 0) {
        toast.error(t("export_no_data"), { id: "export" });
        return;
      }
      const headers = [
        t("invoice_number"),
        t("customer"),
        t("customer_tin"),
        t("date"),
        t("due_date"),
        t("type"),
        t("subtotal"),
        t("discount"),
        t("vat"),
        t("shipping"),
        t("total"),
        t("paid"),
        t("due"),
        t("status"),
        t("payment_status"),
        t("ebms_status"),
        t("ebms_registered_number"),
        "Assujetti TVA",
      ];
      const rows = allInvoices.map((i) => [
        i.invoice_number,
        i.customer_name,
        i.customer_TIN || "-",
        new Date(i.invoice_date).toLocaleDateString(),
        i.due_date ? new Date(i.due_date).toLocaleDateString() : "-",
        i.invoice_type,
        (i.subtotal || 0).toLocaleString(),
        (i.discount_total || 0).toLocaleString(),
        (i.vat_amount || 0).toLocaleString(),
        (i.shipping_amount || 0).toLocaleString(),
        (i.total_amount || 0).toLocaleString(),
        (i.paid_amount || 0).toLocaleString(),
        ((i.total_amount || 0) - (i.paid_amount || 0)).toLocaleString(),
        i.status,
        i.payment_status,
        i.ebms_status,
        i.ebms_registered_number || "-",
        i.vat_customer_payer ? "Oui" : "Non",
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
        `invoices_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        t("export_success_invoices").replace("{count}", allInvoices.length),
        { id: "export" },
      );
    } catch (error) {
      console.error("Erreur export CSV:", error);
      toast.error(t("export_error"), { id: "export" });
    } finally {
      setExportLoading(false);
    }
  };

  // ========== TRI ==========
  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    loadInvoices(appliedFilters, currentPage);
  };

  // ========== DROPDOWN ACTIONS AVEC PORTAL ==========
  const toggleDropdown = (invoice, event) => {
    event.stopPropagation();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const dropdownWidth = 200;
    let leftPosition = buttonRect.right - dropdownWidth + window.scrollX;
    if (leftPosition < 10) leftPosition = 10;
    if (leftPosition + dropdownWidth > window.innerWidth - 10)
      leftPosition = buttonRect.left - dropdownWidth + window.scrollX;
    setDropdownState({
      visible: dropdownState.invoiceId !== invoice.id,
      invoiceId: dropdownState.invoiceId === invoice.id ? null : invoice.id,
      position: {
        top: buttonRect.bottom + window.scrollY + 5,
        left: leftPosition,
      },
      invoice: invoice,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownState.visible &&
        !event.target.closest(".portal-dropdown") &&
        !event.target.closest(".action-dropdown-trigger")
      ) {
        setDropdownState({
          visible: false,
          invoiceId: null,
          position: { top: 0, left: 0 },
          invoice: null,
        });
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [dropdownState.visible]);

  // Ajouter cet effet pour recalculer les TVA quand le statut TVA du client change
  useEffect(() => {
    if (!showProductsSection) return;

    // Recalculer la TVA pour tous les items quand le statut TVA change
    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.product_id && item.quantity > 0) {
          const qty = item.quantity;
          const price = item.unit_price;
          const discountPercent = item.discount_percent || 0;
          const total = qty * price;
          const discountAmount = total * (discountPercent / 100);
          const finalTotal = total - discountAmount;

          let vatAmount = 0;
          if (formData.vat_customer_payer) {
            vatAmount = finalTotal * (item.tax_rate / 100);
          }

          return {
            ...item,
            total: total,
            discount_amount: discountAmount,
            final_total: finalTotal,
            vat_amount: vatAmount,
          };
        }
        return item;
      }),
    );
  }, [formData.vat_customer_payer]);

  // ========== UTILITAIRES ==========
  const resetForm = () => {
    setFormData({
      invoice_type: "FN",
      customer_id: null,
      customer_name: "",
      customer_TIN: "",
      customer_address: "",
      customer_email: "",
      customer_phone: "",
      vat_customer_payer: false,
      invoice_date: new Date().toISOString().slice(0, 16),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      payment_type: "1",
      invoice_currency: "BIF",
      warehouse_id: null,
      notes: "",
      discount_percent: 0,
      discount_amount: 0,
      shipping_cost: 0,
      invoice_ref: "",
      cn_motif: "",
    });
    setInvoiceItems([
      {
        id: Date.now(),
        product_id: null,
        quantity: 1,
        unit_price: 0,
        total: 0,
        final_total: 0,
        product_name: "",
        product_code: "",
        unit: "",
        tax_rate: 18,
        ct_tax_rate: 0,
        tl_tax_rate: 0,
        tsce_tax: 0,
        ott_tax: 0,
        vat_amount: 0,
        ct_amount: 0,
        tl_amount: 0,
        tsce_amount: 0,
        ott_amount: 0,
        discount_percent: 0,
        discount_amount: 0,
        available_stock: 0,
        stock_warning: false,
      },
    ]);
    setAttachedFiles([]);
    setEditingInvoice(null);
  };

  const openModal = (invoice = null) => {
    if (invoice) {
      setEditingInvoice(invoice);
      // Récupérer le client pour connaître son statut TVA
      const customer = customers.find((c) => c.id === invoice.customer_id);

      setFormData({
        ...formData,
        invoice_type: invoice.invoice_type || "FN",
        customer_id: invoice.customer_id
          ? { value: invoice.customer_id, label: invoice.customer_name }
          : null,
        customer_name: invoice.customer_name || "",
        customer_TIN: invoice.customer_TIN || "",
        customer_address: invoice.customer_address || "",
        customer_email: invoice.customer_email || "",
        customer_phone: invoice.customer_phone || "",
        vat_customer_payer: customer
          ? customer.is_vat_subject === "1" || customer.is_vat_subject === 1
          : invoice.vat_customer_payer === 1,
        invoice_date:
          invoice.invoice_date?.slice(0, 16) ||
          new Date().toISOString().slice(0, 16),
        due_date:
          invoice.due_date?.slice(0, 10) ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        payment_type: invoice.payment_type || "1",
        invoice_currency: invoice.invoice_currency || "BIF",
        warehouse_id: invoice.warehouse_id
          ? { value: invoice.warehouse_id, label: invoice.warehouse_name }
          : null,
        notes: invoice.notes || "",
        discount_percent: invoice.discount_percent || 0,
        discount_amount: invoice.discount_amount || 0,
        shipping_cost: invoice.shipping_amount || 0,
      });
      // ... reste du code
      setInvoiceItems(
        invoice.items?.map((item) => ({
          id: item.id || Date.now(),
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total_amount || item.total,
          final_total: item.final_total || item.total_amount || item.total,
          product_name: item.item_designation || item.product_name,
          product_code: item.item_code,
          unit: item.unit,
          tax_rate: item.tax_rate || 18,
          ct_tax_rate: item.ct_tax_rate || 0,
          tl_tax_rate: item.tl_tax_rate || 0,
          tsce_tax: item.tsce_tax || 0,
          ott_tax: item.ott_tax || 0,
          vat_amount: item.vat_amount || 0,
          ct_amount: item.ct_amount || 0,
          tl_amount: item.tl_amount || 0,
          tsce_amount: item.tsce_amount || 0,
          ott_amount: item.ott_amount || 0,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          available_stock: 0,
          stock_warning: false,
        })) || [
          {
            id: Date.now(),
            product_id: null,
            quantity: 1,
            unit_price: 0,
            total: 0,
            final_total: 0,
            product_name: "",
            product_code: "",
            unit: "",
            tax_rate: 18,
            ct_tax_rate: 0,
            tl_tax_rate: 0,
            vat_amount: 0,
            ct_amount: 0,
            tl_amount: 0,
            discount_percent: 0,
            discount_amount: 0,
            available_stock: 0,
            stock_warning: false,
          },
        ],
      );
      if (invoice.warehouse_id) updateAllProductsStock(invoice.warehouse_id);
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingInvoice(null);
    attachedFiles.forEach((file) => {
      if (file.url) URL.revokeObjectURL(file.url);
    });
    setAttachedFiles([]);
  };
  const viewInvoiceDetail = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailModalOpen(true);
  };
  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: (invoice.total_amount || 0) - (invoice.paid_amount || 0),
      payment_method: "cash",
      payment_date: new Date().toISOString().slice(0, 16),
      reference: "",
      notes: "",
    });
    setPaymentModalOpen(true);
  };
  //const handleCustomerSelect = (customer) => setFormData((prev) => ({ ...prev, customer_id: customer, customer_name: customer?.name || "", customer_TIN: customer?.tin || "", customer_address: customer?.address || "", customer_email: customer?.email || "", customer_phone: customer?.phone || "", vat_customer_payer: customer?.is_vat_subject || false }));

  const handleCustomerSelect = (customer) => {
    if (customer) {
      setFormData((prev) => ({
        ...prev,
        customer_id: customer,
        customer_name: customer.name || "",
        customer_TIN: customer.tin || "",
        customer_address: customer.address || "",
        customer_email: customer.email || "",
        customer_phone: customer.phone || "",
        vat_customer_payer:
          customer.is_vat_subject === "1" || customer.is_vat_subject == 1, // Important: récupérer le statut TVA du client
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        customer_id: null,
        customer_name: "",
        customer_TIN: "",
        customer_address: "",
        customer_email: "",
        customer_phone: "",
        vat_customer_payer: false, // Réinitialiser si pas de client
      }));
    }
  };
  const handleModalClick = (e) => e.stopPropagation();

  // ========== EFFETS ==========
  useEffect(() => {
    const type = formData.invoice_type;
    const currentType = invoiceTypes.find((t) => t.value === type);
    if (currentType && !currentType.affectsStock && type !== "FA") {
      setShowProductsSection(false);
      setInvoiceItems([]);
    } else {
      setShowProductsSection(true);
      if (invoiceItems.length === 0 && currentType?.affectsStock)
        addInvoiceItem();
    }
  }, [formData.invoice_type]);

  /* useEffect(() => {
    const warehouseId = formData.warehouse_id?.value;
    if (warehouseId && showProductsSection && invoiceItems.length > 0 && invoiceItems.some((i) => i.product_id)) { updateAllProductsStock(warehouseId); }
  }, [formData.warehouse_id?.value]);*/

  // ========== EFFET POUR LA SÉLECTION DE L'ENTREPÔT ==========
  useEffect(() => {
    const warehouseId = formData.warehouse_id?.value;
    if (
      warehouseId &&
      showProductsSection &&
      invoiceItems.length > 0 &&
      invoiceItems.some((i) => i.product_id && i.product_id !== null)
    ) {
      // Un entrepôt a été sélectionné, vérifier le stock pour tous les produits existants
      updateAllProductsStock(warehouseId);
    } else if (!warehouseId && invoiceItems.some((i) => i.product_id)) {
      // Aucun entrepôt sélectionné mais des produits existent - afficher un avertissement
      setInvoiceItems((prev) =>
        prev.map((item) => ({
          ...item,
          stock_warning: false,
          available_stock: 0,
        })),
      );
      toast.error(t("select_warehouse_first"));
    }
  }, [formData.warehouse_id?.value]);

  useEffect(() => {
    registerAction("add", () => openModal());
    registerAction("export", () => exportInvoicesToCSV());
    registerAction("filter", () => setFilterModalOpen(true));
    registerAction("refresh", () => refreshInvoices());
    return () => {
      unregisterAction("add");
      unregisterAction("export");
      unregisterAction("filter");
      unregisterAction("refresh");
    };
  }, []);

  useEffect(() => {
    loadSettings();
    loadReferenceData();
    loadInvoices({}, 1);
  }, []);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentInvoiceType = invoiceTypes.find(
    (t) => t.value === formData.invoice_type,
  );
  const isStockAffecting = currentInvoiceType?.affectsStock;

  if (loading) return <Loader />;

  // Suite du JSX (tableau, modaux, etc.) - suite dans le prochain message en raison de la longueur

  return (
    <div className={`invoices-page ${isDark ? "dark" : "light"}`}>
      <style>{`
        /* Items table improvements */
        .items-table-wrapper { overflow-x: auto; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        .items-table td, .items-table th { padding: 6px 8px; vertical-align: middle; }
        .items-table .product-cell { width: 30%; }
        .items-table .select-product .select__control { width: 100% !important; min-height: 36px; }
        .items-table .item-qty-input, .items-table .item-price-input { width: 100%; box-sizing: border-box; padding: 6px; border-radius: 4px; border: 1px solid #d1d5db; }
        .items-table .total-cell, .items-table td.total-amount, .items-table tfoot td { text-align: right; }
        .items-table tbody td { text-align: left; }
        .items-table tbody td.total-cell, .items-table tbody td:nth-last-child(4), .items-table tbody td:nth-last-child(5) { text-align: right; }
        .items-table tfoot .total-label { text-align: right; padding-right: 12px; font-weight: 600; }
        .items-table tfoot td.grand-total { text-align: right; font-weight: 700; }
        .items-table .stock-ok-message, .items-table .stock-alert { font-size: 12px; margin-top: 4px; }
        .items-table .warning-row { background: rgba(254,226,226,0.6); }
        .items-table .btn-remove-item { background: transparent; border: none; color: #ef4444; font-weight: bold; }
        /* Increase width of the last column (remove/button column) */
        .items-table thead th:last-child, .items-table tbody td:last-child, .items-table tfoot td:last-child { width: 70px; text-align: center; }
        @media (max-width: 768px) {
          .items-table thead th:last-child, .items-table tbody td:last-child, .items-table tfoot td:last-child { width: 56px; }
        }
      `}</style>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#1e293b",
          },
        }}
      />

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2>{t("invoices")}</h2>
          <p>{t("invoices_desc")}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">
            📄 {t("total_invoices")}: {stats.total_invoices || totalItems}
          </span>
          <span className="stat-value">
            💰 CA: {(stats.total_amount || 0).toLocaleString()} FBu
          </span>
          <span className="stat-paid">
            ✅ Payé: {(stats.total_paid || 0).toLocaleString()} FBu
          </span>
          <span className="stat-overdue">
            🔴 Retard: {stats.overdue_count || 0}
          </span>
          {hasActiveFilters() && (
            <span className="filter-badge">🔍 {t("active_filters")}</span>
          )}
        </div>
      </div>

      {/* ACTIONS GROUPÉES */}
      {selectedInvoices.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">
            {selectedInvoices.length} {t("selected")}
          </span>
          <button
            className="bulk-delete-btn"
            onClick={handleBulkDelete}
            disabled={exportLoading}
            style={{ cursor: "pointer" }}
          >
            🗑️ {t("delete_selected")}
          </button>
          <button
            className="bulk-sync-btn"
            onClick={handleBulkSync}
            disabled={syncLoading}
            style={{ cursor: "pointer" }}
          >
            🔄 {t("sync_selected")}
          </button>
          <button
            className="bulk-clear-btn"
            onClick={() => setSelectedInvoices([])}
            style={{ cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* FILTRES ACTIFS */}
      {hasActiveFilters() && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">{t("active_filters_label")}:</span>
          {Object.entries(appliedFilters).map(
            ([key, value]) =>
              value && (
                <span key={key} className="filter-tag">
                  {key}: {value}
                </span>
              ),
          )}
          <button
            className="clear-filters-btn"
            onClick={resetFilters}
            style={{ cursor: "pointer" }}
          >
            ✕ {t("clear_filters")}
          </button>
        </div>
      )}

      {/* Barre de contrôle supplémentaire */}
      <div className="controls-bar">
        <div className="items-per-page">
          <span>{t("show")}:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              loadInvoices(appliedFilters, 1);
            }}
            style={{ cursor: "pointer" }}
          >
            {itemsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="pagination-info">
          {t("showing")} {(currentPage - 1) * itemsPerPage + 1} à{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} sur {totalItems}
        </div>
      </div>

      {/* TABLEAU DES FACTURES */}
      <div className="page-content">
        {invoices.length === 0 && !hasActiveFilters() ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_invoices")}</p>
            <Tippy
              content={t("create_invoice")}
              placement="bottom"
              animation="scale"
            >
              <button
                className="btn-primary"
                onClick={() => openModal()}
                style={{ cursor: "pointer" }}
              >
                ➕ {t("create_first_invoice")}
              </button>
            </Tippy>
          </div>
        ) : invoices.length === 0 && hasActiveFilters() ? (
          <div className={`empty-state ${isDark ? "dark" : "light"}`}>
            <p>{t("no_invoices_match_filters")}</p>
            <button
              className="btn-secondary"
              onClick={resetFilters}
              style={{ cursor: "pointer" }}
            >
              {t("reset_filters")}
            </button>
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
                          selectedInvoices.length === invoices.length &&
                          invoices.length > 0
                        }
                        onChange={handleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th
                      className="sortable"
                      onClick={() => handleSort("invoice_number")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("invoice_number")}{" "}
                      {sortField === "invoice_number" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="sortable"
                      onClick={() => handleSort("customer_name")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("customer")}{" "}
                      {sortField === "customer_name" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="sortable"
                      onClick={() => handleSort("invoice_date")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("date")}{" "}
                      {sortField === "invoice_date" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="sortable"
                      onClick={() => handleSort("due_date")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("due_date")}{" "}
                      {sortField === "due_date" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th>{t("type")}</th>
                    <th
                      className="sortable"
                      onClick={() => handleSort("total_amount")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("total")}{" "}
                      {sortField === "total_amount" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th>{t("status")}</th>
                    <th>{t("payment")}</th>
                    <th>EBMS</th>
                    <th>TVA</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const status =
                      invoiceStatuses[invoice.status] ||
                      invoiceStatuses.pending;
                    const ebmsStatus =
                      ebmsStatuses[invoice.ebms_status] || ebmsStatuses.PENDING;
                    const isOverdue =
                      invoice.due_date &&
                      new Date(invoice.due_date) < new Date() &&
                      invoice.payment_status !== "paid";
                    return (
                      <tr
                        key={invoice.id}
                        className={isOverdue ? "row-overdue" : ""}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={() => handleSelectOne(invoice.id)}
                            disabled={invoice.status === "cancelled"}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td>
                          <span className="invoice-number">
                            {invoice.invoice_number}
                          </span>
                          {invoice.ebms_registered_number && (
                            <span
                              className="ebms-ref"
                              title={t("ebms_registered")}
                              style={{ cursor: "help" }}
                            >
                              📋
                            </span>
                          )}
                        </td>
                        <td>
                          <div>
                            <strong>{invoice.customer_name}</strong>
                            {invoice.customer_TIN && (
                              <small className="tin-text">
                                TIN: {invoice.customer_TIN}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </td>
                        <td className={isOverdue ? "date-overdue" : ""}>
                          {invoice.due_date
                            ? new Date(invoice.due_date).toLocaleDateString()
                            : "-"}
                          {isOverdue && (
                            <span className="overdue-badge">⚠️</span>
                          )}
                        </td>
                        <td>
                          <span
                            className="type-badge"
                            style={{
                              backgroundColor:
                                invoiceTypes.find(
                                  (t) => t.value === invoice.invoice_type,
                                )?.color + "20",
                            }}
                          >
                            {
                              invoiceTypes.find(
                                (t) => t.value === invoice.invoice_type,
                              )?.icon
                            }{" "}
                            {invoice.invoice_type}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {(invoice.total_amount || 0).toLocaleString()} FBu
                          </strong>
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              backgroundColor: status.bg,
                              color: status.color,
                            }}
                          >
                            {status.icon} {t(status.label)}
                          </span>
                        </td>
                        <td>
                          <span className="payment-status">
                            {(invoice.paid_amount || 0).toLocaleString()} /{" "}
                            {(invoice.total_amount || 0).toLocaleString()}
                          </span>
                          <div className="payment-progress">
                            <div
                              className="payment-progress-bar"
                              style={{
                                width: `${((invoice.paid_amount || 0) / (invoice.total_amount || 1)) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </td>
                        <td>
                          <Tippy content={ebmsStatus.label}>
                            <span
                              className="ebms-status"
                              style={{
                                color: ebmsStatus.color,
                                cursor: "pointer",
                              }}
                            >
                              {ebmsStatus.icon}
                            </span>
                          </Tippy>
                        </td>
                        <td>
                          <span
                            className={`vat-badge ${invoice.vat_customer_payer ? "assujetti" : "non-assujetti"}`}
                          >
                            {invoice.vat_customer_payer === "1" ? "✅" : "❌"}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <div className="action-dropdown-trigger-wrapper">
                            <button
                              className="action-dropdown-trigger"
                              onClick={(e) => toggleDropdown(invoice, e)}
                              style={{ cursor: "pointer" }}
                            >
                              ⋮
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => loadInvoices(appliedFilters, 1)}
                  disabled={currentPage === 1}
                  style={{
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  «
                </button>
                <button
                  onClick={() => loadInvoices(appliedFilters, currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ‹
                </button>
                <span className="page-info">
                  {t("page")} {currentPage} {t("of")} {totalPages}
                </span>
                <button
                  onClick={() => loadInvoices(appliedFilters, currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  ›
                </button>
                <button
                  onClick={() => loadInvoices(appliedFilters, totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  »
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* PORTAL POUR LE DROPDOWN DES ACTIONS */}
      {dropdownState.visible &&
        dropdownState.invoice &&
        createPortal(
          <div
            className={`portal-dropdown ${isDark ? "dark" : "light"}`}
            style={{
              position: "absolute",
              top: dropdownState.position.top,
              left: dropdownState.position.left,
              zIndex: 999999,
            }}
          >
            <button
              onClick={() => {
                viewInvoiceDetail(dropdownState.invoice);
                setDropdownState({
                  visible: false,
                  invoiceId: null,
                  position: { top: 0, left: 0 },
                  invoice: null,
                });
              }}
              style={{ cursor: "pointer" }}
            >
              👁️ {t("view_details")}
            </button>
            {dropdownState.invoice.status !== "cancelled" && (
              <>
                <button
                  onClick={() => {
                    openModal(dropdownState.invoice);
                    setDropdownState({
                      visible: false,
                      invoiceId: null,
                      position: { top: 0, left: 0 },
                      invoice: null,
                    });
                  }}
                  style={{ cursor: "pointer" }}
                >
                  ✏️ {t("edit")}
                </button>
                <button
                  onClick={() => {
                    openPaymentModal(dropdownState.invoice);
                    setDropdownState({
                      visible: false,
                      invoiceId: null,
                      position: { top: 0, left: 0 },
                      invoice: null,
                    });
                  }}
                  style={{ cursor: "pointer" }}
                >
                  💰 {t("add_payment")}
                </button>
                <button
                  onClick={() => {
                    sendPaymentReminder(dropdownState.invoice);
                    setDropdownState({
                      visible: false,
                      invoiceId: null,
                      position: { top: 0, left: 0 },
                      invoice: null,
                    });
                  }}
                  disabled={reminderLoading === dropdownState.invoice.id}
                  style={{
                    cursor:
                      reminderLoading === dropdownState.invoice.id
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  🔔 {t("send_reminder")}
                </button>
              </>
            )}
            <button
              onClick={() => {
                printInvoice(dropdownState.invoice);
                setDropdownState({
                  visible: false,
                  invoiceId: null,
                  position: { top: 0, left: 0 },
                  invoice: null,
                });
              }}
              disabled={printLoading}
              style={{ cursor: printLoading ? "not-allowed" : "pointer" }}
            >
              🖨️ {t("print")}
            </button>
            <button
              onClick={() => {
                syncWithEBMS(dropdownState.invoice);
                setDropdownState({
                  visible: false,
                  invoiceId: null,
                  position: { top: 0, left: 0 },
                  invoice: null,
                });
              }}
              disabled={
                syncLoading === dropdownState.invoice.id ||
                dropdownState.invoice.status === "cancelled"
              }
              style={{
                cursor:
                  syncLoading === dropdownState.invoice.id ||
                  dropdownState.invoice.status === "cancelled"
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              🔄 {t("sync_ebms")}
            </button>
            <button
              onClick={() => {
                verifyInvoiceWithEBMS(dropdownState.invoice);
                setDropdownState({
                  visible: false,
                  invoiceId: null,
                  position: { top: 0, left: 0 },
                  invoice: null,
                });
              }}
              disabled={
                syncLoading === dropdownState.invoice.id ||
                dropdownState.invoice.status === "cancelled"
              }
              style={{
                cursor:
                  syncLoading === dropdownState.invoice.id ||
                  dropdownState.invoice.status === "cancelled"
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              ✅ {t("verify_ebms") || "Vérifier EBMS"}
            </button>
            <button
              onClick={() => {
                viewEbmsLogs(dropdownState.invoice);
                setDropdownState({
                  visible: false,
                  invoiceId: null,
                  position: { top: 0, left: 0 },
                  invoice: null,
                });
              }}
              style={{ cursor: "pointer" }}
            >
              📋 {t("view_ebms_logs")}
            </button>
            <button
              onClick={() => {
                sendByEmail(dropdownState.invoice);
                setDropdownState({
                  visible: false,
                  invoiceId: null,
                  position: { top: 0, left: 0 },
                  invoice: null,
                });
              }}
              disabled={emailLoading === dropdownState.invoice.id}
              style={{
                cursor:
                  emailLoading === dropdownState.invoice.id
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              📧 {t("send_email")}
            </button>
            {dropdownState.invoice.status !== "cancelled" && (
              <button
                className="danger"
                onClick={() => {
                  handleCancel(dropdownState.invoice);
                  setDropdownState({
                    visible: false,
                    invoiceId: null,
                    position: { top: 0, left: 0 },
                    invoice: null,
                  });
                }}
                disabled={cancelLoading === dropdownState.invoice.id}
                style={{
                  cursor:
                    cancelLoading === dropdownState.invoice.id
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ❌ {t("cancel")}
              </button>
            )}
          </div>,
          document.body,
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
              <h3>{t("filter_invoices")}</h3>
              <button
                className="modal-close"
                onClick={() => setFilterModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("invoice_number")}</label>
                <input
                  type="text"
                  value={filters.invoice_number}
                  onChange={(e) =>
                    setFilters({ ...filters, invoice_number: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
              <div className="form-group">
                <label>{t("customer_name")}</label>
                <input
                  type="text"
                  value={filters.customer_name}
                  onChange={(e) =>
                    setFilters({ ...filters, customer_name: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
              <div className="form-group">
                <label>{t("customer_tin")}</label>
                <input
                  type="text"
                  value={filters.customer_TIN}
                  onChange={(e) =>
                    setFilters({ ...filters, customer_TIN: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
              <div className="form-group">
                <label>{t("invoice_type")}</label>
                <select
                  value={filters.invoice_type}
                  onChange={(e) =>
                    setFilters({ ...filters, invoice_type: e.target.value })
                  }
                  style={{ cursor: "pointer" }}
                >
                  <option value="">{t("all_types")}</option>
                  {invoiceTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t("payment_status")}</label>
                <select
                  value={filters.payment_status}
                  onChange={(e) =>
                    setFilters({ ...filters, payment_status: e.target.value })
                  }
                  style={{ cursor: "pointer" }}
                >
                  <option value="">{t("all")}</option>
                  <option value="pending">En attente</option>
                  <option value="paid">Payée</option>
                  <option value="partial">Partielle</option>
                  <option value="overdue">En retard</option>
                </select>
              </div>
              <div className="form-group">
                <label>EBMS Status</label>
                <select
                  value={filters.ebms_status}
                  onChange={(e) =>
                    setFilters({ ...filters, ebms_status: e.target.value })
                  }
                  style={{ cursor: "pointer" }}
                >
                  <option value="">{t("all")}</option>
                  <option value="PENDING">En attente</option>
                  <option value="SENT">Envoyée</option>
                  <option value="ACKNOWLEDGED">Reçue</option>
                  <option value="FAILED">Échec</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t("date_from")}</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) =>
                    setFilters({ ...filters, date_from: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
              <div className="form-group">
                <label>{t("date_to")}</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) =>
                    setFilters({ ...filters, date_to: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
              <div className="form-group">
                <label>{t("min_amount")} (FBu)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={filters.min_amount}
                  onChange={(e) =>
                    setFilters({ ...filters, min_amount: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
              <div className="form-group">
                <label>{t("max_amount")} (FBu)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={filters.max_amount}
                  onChange={(e) =>
                    setFilters({ ...filters, max_amount: e.target.value })
                  }
                  style={{ cursor: "text" }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={resetFilters}
                style={{ cursor: "pointer" }}
              >
                {t("reset_filters")}
              </button>
              <button
                className="btn-primary"
                onClick={applyFilters}
                style={{ cursor: "pointer" }}
              >
                {t("apply_filters")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAIEMENT */}
      {paymentModalOpen && selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">💰</span>
              <h3>
                {t("add_payment")} - {selectedInvoice.invoice_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setPaymentModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="payment-info-card">
                <div className="payment-info-row">
                  Total facture:{" "}
                  <strong>
                    {(selectedInvoice.total_amount || 0).toLocaleString()} FBu
                  </strong>
                </div>
                <div className="payment-info-row">
                  Déjà payé:{" "}
                  <strong>
                    {(selectedInvoice.paid_amount || 0).toLocaleString()} FBu
                  </strong>
                </div>
                <div className="payment-info-row">
                  Reste à payer:{" "}
                  <strong className="remaining-amount">
                    {(
                      (selectedInvoice.total_amount || 0) -
                      (selectedInvoice.paid_amount || 0)
                    ).toLocaleString()}{" "}
                    FBu
                  </strong>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="required">{t("amount")} </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={
                      (selectedInvoice.total_amount || 0) -
                      (selectedInvoice.paid_amount || 0)
                    }
                    value={paymentData.amount}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        amount: parseFloat(e.target.value),
                      })
                    }
                    required
                    style={{ cursor: "text" }}
                  />
                  <small className="form-hint">
                    {t("remaining_amount")}:{" "}
                    {(
                      (selectedInvoice.total_amount || 0) -
                      (selectedInvoice.paid_amount || 0)
                    ).toLocaleString()}{" "}
                    FBu
                  </small>
                </div>
                <div className="form-group">
                  <label>{t("payment_method")}</label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        payment_method: e.target.value,
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.icon} {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("payment_date")}</label>
                  <input
                    type="datetime-local"
                    value={paymentData.payment_date}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        payment_date: e.target.value,
                      })
                    }
                    style={{ cursor: "text" }}
                  />
                </div>
                <div className="form-group">
                  <label>{t("reference")}</label>
                  <input
                    type="text"
                    value={paymentData.reference}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        reference: e.target.value,
                      })
                    }
                    placeholder={t("transaction_reference")}
                    style={{ cursor: "text" }}
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("notes")}</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, notes: e.target.value })
                    }
                    rows="2"
                    style={{ cursor: "text" }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setPaymentModalOpen(false)}
                disabled={paymentLoading}
                style={{ cursor: paymentLoading ? "not-allowed" : "pointer" }}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={addPayment}
                disabled={paymentLoading || paymentData.amount <= 0}
                style={{
                  cursor:
                    paymentLoading || paymentData.amount <= 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {paymentLoading ? (
                  <span className="btn-spinner"></span>
                ) : (
                  t("record_payment")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRÉATION/MODIFICATION FACTURE */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📄</span>
              <h3>{editingInvoice ? t("edit_invoice") : t("new_invoice")}</h3>
              <button
                className="modal-close"
                onClick={closeModal}
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-section">
                  <h4>{t("invoice_information")}</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">{t("invoice_type")} </label>
                      <select
                        value={formData.invoice_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_type: e.target.value,
                          })
                        }
                        required
                        style={{ cursor: "pointer" }}
                      >
                        {invoiceTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("invoice_date")}</label>
                      <input
                        type="datetime-local"
                        value={formData.invoice_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_date: e.target.value,
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("due_date")}</label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("currency")}</label>
                      <select
                        value={formData.invoice_currency}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_currency: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <option value="BIF">FBu (Franc Burundais)</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("payment_type")}</label>
                      <select
                        value={formData.payment_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            payment_type: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <option value="1">{t("cash")}</option>
                        <option value="2">{t("bank_transfer")}</option>
                        <option value="3">{t("mobile_money")}</option>
                        <option value="4">{t("check")}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="required">{t("warehouse")}</label>
                      <Select
                        options={warehouseOptions}
                        value={formData.warehouse_id}
                        onChange={(val) =>
                          setFormData({ ...formData, warehouse_id: val })
                        }
                        className="select-filter"
                        classNamePrefix="select"
                        placeholder={t("select_warehouse")}
                        isClearable
                        styles={selectStyles}
                      />
                      {isStockAffecting && !formData.warehouse_id && (
                        <small className="warning-hint">
                          ⚠️ {t("select_warehouse_first")}
                        </small>
                      )}
                    </div>
                  </div>
                </div>

                {/* Champs pour Facture d'Avoir (FA) et Remboursement Caution (RC) */}
                {(formData.invoice_type === "FA" ||
                  formData.invoice_type === "RC") && (
                  <div className="form-section">
                    <h4>🔄 {t("credit_note_info")}</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label
                          className={
                            formData.invoice_type === "RC" ? "required" : ""
                          }
                        >
                          {t("invoice_ref")}{" "}
                          {formData.invoice_type === "RC" ? "*" : ""}
                        </label>
                        <input
                          type="text"
                          value={formData.invoice_ref}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              invoice_ref: e.target.value,
                            })
                          }
                          placeholder={
                            formData.invoice_type === "RC"
                              ? "Numéro de facture de caution"
                              : "Numéro de facture originale"
                          }
                          required={formData.invoice_type === "RC"}
                          style={{ cursor: "text" }}
                        />
                      </div>
                      <div className="form-group">
                        <label
                          className={
                            formData.invoice_type === "FA" ? "required" : ""
                          }
                        >
                          {t("cn_motif")}{" "}
                          {formData.invoice_type === "FA" ? "*" : ""}
                        </label>
                        <select
                          value={formData.cn_motif}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cn_motif: e.target.value,
                            })
                          }
                          required={formData.invoice_type === "FA"}
                          style={{ cursor: "pointer" }}
                        >
                          <option value="">-- {t("select_reason")} --</option>
                          <option value="erreur">❌ Erreur</option>
                          <option value="retour_marchandises">
                            📦 Retour marchandises
                          </option>
                          <option value="rabais">🏷️ Rabais</option>
                          <option value="ristourne">💰 Ristourne</option>
                          <option value="remise">🎁 Remise</option>
                          <option value="escompte">📊 Escompte</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-section">
                  <h4>{t("customer_information")}</h4>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>{t("customer")}</label>
                      <Select
                        options={customerOptions}
                        value={formData.customer_id}
                        onChange={handleCustomerSelect}
                        className="select-filter"
                        classNamePrefix="select"
                        placeholder={t("select_customer")}
                        isClearable
                        styles={selectStyles}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("customer_name")}</label>
                      <input
                        type="text"
                        value={formData.customer_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_name: e.target.value,
                          })
                        }
                        placeholder={t("customer_name_placeholder")}
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("customer_tin")}</label>
                      <input
                        type="text"
                        value={formData.customer_TIN}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_TIN: e.target.value,
                          })
                        }
                        placeholder={t("customer_tin_placeholder")}
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>{t("customer_address")}</label>
                      <input
                        type="text"
                        value={formData.customer_address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_address: e.target.value,
                          })
                        }
                        placeholder={t("customer_address_placeholder")}
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("customer_email")}</label>
                      <input
                        type="email"
                        value={formData.customer_email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_email: e.target.value,
                          })
                        }
                        placeholder={t("customer_email_placeholder")}
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("customer_phone")}</label>
                      <input
                        type="tel"
                        value={formData.customer_phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_phone: e.target.value,
                          })
                        }
                        placeholder={t("customer_phone_placeholder")}
                        style={{ cursor: "text" }}
                      />
                    </div>

                    {/* Dans le modal, dans la section customer_information, ajoutez : */}
                    <div className="form-group full-width">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.vat_customer_payer}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              vat_customer_payer: e.target.checked,
                            })
                          }
                          style={{
                            cursor: "pointer",
                            width: "auto",
                            marginRight: "8px",
                          }}
                        />
                        {t("vat_customer_payer")}
                      </label>
                      <small className="form-hint">
                        {t("vat_customer_payer_hint")}
                      </small>
                    </div>
                  </div>
                </div>

                {!isStockAffecting && formData.invoice_type !== "FA" && (
                  <div className="info-box">
                    <span className="info-icon">ℹ️</span>
                    <p>{t("no_stock_impact")}</p>
                  </div>
                )}
                {isStockAffecting && checkingStock && (
                  <div className="loading-box">
                    <span className="btn-spinner"></span>
                    <span>{t("checking_stock")}</span>
                  </div>
                )}

                {showProductsSection &&
                  (isStockAffecting || formData.invoice_type === "FA") && (
                    <div className="items-section">
                      <div className="items-header">
                        <h4>
                          {t("products_list")}{" "}
                          {formData.invoice_type === "FA" && (
                            <span className="optional-label">
                              {t("optional")}
                            </span>
                          )}
                        </h4>
                        <button
                          type="button"
                          className="btn-add-item"
                          onClick={addInvoiceItem}
                          style={{ cursor: "pointer" }}
                          disabled={
                            formData.invoice_type !== "FA" &&
                            isAllProductsSelected()
                          }
                        >
                          ➕ {t("add_product")}
                        </button>
                      </div>
                      <div className="items-table-wrapper">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th
                                style={{ width: "30%" }}
                                className={isStockAffecting ? "required" : ""}
                              >
                                {t("product")}{" "}
                              </th>
                              <th
                                style={{ width: "10%" }}
                                className={isStockAffecting ? "required" : ""}
                              >
                                {t("quantity")}{" "}
                              </th>
                              <th style={{ width: "15%" }}>
                                {t("unit_price")} (FBu)
                              </th>
                              <th style={{ width: "15%" }}>
                                {t("total")} (FBu)
                              </th>
                              <th style={{ width: "8%" }}>{t("vat")}</th>
                              <th style={{ width: "8%" }}>CT</th>
                              <th style={{ width: "8%" }}>TL</th>
                              <th style={{ width: "8%" }}>TSCE</th>
                              <th style={{ width: "8%" }}>OTT</th>
                              {isStockAffecting && (
                                <th style={{ width: "10%" }}>{t("stock")}</th>
                              )}
                              <th style={{ width: "5%" }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceItems.map((item) => (
                              <tr
                                key={item.id}
                                className={
                                  item.stock_warning ? "warning-row" : ""
                                }
                              >
                                <td className="product-cell">
                                  <Select
                                    options={getAvailableProductOptions(
                                      item.id,
                                    )}
                                    value={productOptions.find(
                                      (p) => p.value === item.product_id,
                                    )}
                                    onChange={(val) =>
                                      updateInvoiceItem(
                                        item.id,
                                        "product_id",
                                        val?.value,
                                      )
                                    }
                                    className="select-product"
                                    classNamePrefix="select"
                                    placeholder={t("select_product")}
                                    isClearable
                                    styles={selectStyles}
                                    noOptionsMessage={() =>
                                      t("no_products_available")
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.00"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateInvoiceItem(
                                        item.id,
                                        "quantity",
                                        parseFloat(e.target.value),
                                      )
                                    }
                                    className={`item-qty-input ${
                                      item.stock_warning ? "error-input" : ""
                                    }`}
                                    required={isStockAffecting}
                                    style={{ cursor: "text" }}
                                  />
                                  {item.unit && (
                                    <small className="unit-hint">
                                      {item.unit}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.unit_price}
                                    onChange={(e) =>
                                      updateInvoiceItem(
                                        item.id,
                                        "unit_price",
                                        parseFloat(e.target.value),
                                      )
                                    }
                                    className="item-price-input"
                                    style={{ cursor: "text" }}
                                  />
                                </td>
                                <td className="total-cell">
                                  {item.final_total.toLocaleString()} FBu
                                </td>
                                <td>{item.vat_amount?.toLocaleString()} FBu</td>
                                <td>{item.ct_amount?.toLocaleString()} FBu</td>
                                <td>{item.tl_amount?.toLocaleString()} FBu</td>
                                <td>
                                  {item.tsce_amount?.toLocaleString()} FBu
                                </td>
                                <td>{item.ott_amount?.toLocaleString()} FBu</td>
                                {isStockAffecting && (
                                  <td
                                    className={
                                      item.stock_warning
                                        ? "stock-warning"
                                        : "stock-ok"
                                    }
                                  >
                                    {formData.warehouse_id?.value ? (
                                      item.available_stock > 0 ? (
                                        <>
                                          📦{" "}
                                          <span className="stock-number">
                                            {item.available_stock} {item.unit}
                                          </span>
                                          {item.quantity >
                                            item.available_stock && (
                                            <div className="stock-alert">
                                              ⚠️ Stock insuffisant!
                                            </div>
                                          )}
                                          {item.quantity <=
                                            item.available_stock &&
                                            item.quantity > 0 &&
                                            item.available_stock > 0 && (
                                              <div className="stock-ok-message">
                                                ✅ Stock OK
                                              </div>
                                            )}
                                        </>
                                      ) : (
                                        <span className="no-stock">
                                          ❌ Stock épuisé ou inconnu
                                        </span>
                                      )
                                    ) : (
                                      <span className="no-warehouse">
                                        🏪 Sélectionnez un entrepôt d'abord
                                      </span>
                                    )}
                                  </td>
                                )}
                                <td>
                                  {invoiceItems.length > 1 && (
                                    <button
                                      type="button"
                                      className="btn-remove-item"
                                      onClick={() => removeInvoiceItem(item.id)}
                                      style={{ cursor: "pointer" }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            {/* Position amount cell under the 'Total' column (4th column)
                                Table columns: 1=product,2=quantity,3=unit_price,4=total,5=vat,6=ct,7=tl,8=tsce,9=ott,10=stock?,11=remove
                                We set label colspan to 3 so amount td is in column 4, then fill remaining space with a colspan empty td. */}
                            <tr>
                              <td colSpan={3} className="total-label">
                                {t("subtotal")}
                              </td>
                              <td className="grand-total">
                                {getSubtotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                {t("discount")}
                              </td>
                              <td className="grand-total">
                                - {getDiscountTotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                HTVA
                              </td>
                              <td className="grand-total">
                                {getHTVA().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                {t("vat")}
                              </td>
                              <td className="grand-total">
                                {getVatTotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                TVAC
                              </td>
                              <td className="grand-total">
                                {getTVAC().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                CT
                              </td>
                              <td className="grand-total">
                                {getCtTotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                TL
                              </td>
                              <td className="grand-total">
                                {getTlTotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                TSCE
                              </td>
                              <td className="grand-total">
                                {getTsceTotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                OTT
                              </td>
                              <td className="grand-total">
                                {getOttTotal().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="total-label">
                                {t("shipping")}
                              </td>
                              <td className="grand-total">
                                {getShippingCost().toLocaleString()} FBu
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                            <tr className="total-line grand-total">
                              <td colSpan={3} className="total-label">
                                <strong>{t("grand_total_ttc")}</strong>
                              </td>
                              <td className="grand-total">
                                <strong>
                                  {getGrandTotal().toLocaleString()} FBu
                                </strong>
                              </td>
                              <td colSpan={isStockAffecting ? 7 : 6}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                <div className="form-section">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>{t("discount")} (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.discount_percent}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discount_percent: parseFloat(e.target.value),
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("discount_amount")} (FBu)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.discount_amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discount_amount: parseFloat(e.target.value),
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("shipping_cost")} (FBu)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.shipping_cost}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shipping_cost: parseFloat(e.target.value),
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>{t("notes")}</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        rows="3"
                        placeholder={t("invoice_notes")}
                        style={{ cursor: "text" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="attachments-section">
                  <label>{t("attachments")}</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      className="file-input"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      style={{ cursor: "pointer" }}
                    />
                    <button
                      type="button"
                      className="btn-upload"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ cursor: "pointer" }}
                    >
                      📎 {t("add_files")}
                    </button>
                    <div className="file-list">
                      {attachedFiles.map((file) => (
                        <div key={file.id} className="file-item">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">
                            {(file.size / 1024).toFixed(2)} KB
                          </span>
                          <button
                            type="button"
                            className="btn-remove-file"
                            onClick={() => removeFile(file.id)}
                            style={{ cursor: "pointer" }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={submitLoading}
                  style={{ cursor: submitLoading ? "not-allowed" : "pointer" }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitLoading}
                  style={{ cursor: submitLoading ? "not-allowed" : "pointer" }}
                >
                  {submitLoading ? (
                    <span className="btn-spinner"></span>
                  ) : editingInvoice ? (
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

      {/* MODAL DÉTAIL FACTURE */}
      {detailModalOpen && selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📄</span>
              <h3>
                {t("invoice_details")} - {selectedInvoice.invoice_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setDetailModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-status-bar">
                <span
                  className="status-badge"
                  style={{
                    backgroundColor:
                      invoiceStatuses[selectedInvoice.status]?.bg,
                    color: invoiceStatuses[selectedInvoice.status]?.color,
                  }}
                >
                  {invoiceStatuses[selectedInvoice.status]?.icon}{" "}
                  {invoiceStatuses[selectedInvoice.status]?.label}
                </span>
                <span
                  className="ebms-status-box"
                  style={{
                    backgroundColor:
                      ebmsStatuses[selectedInvoice.ebms_status]?.bg ||
                      "#eef2ff",
                    color:
                      ebmsStatuses[selectedInvoice.ebms_status]?.color ||
                      "#111827",
                  }}
                >
                  {ebmsStatuses[selectedInvoice.ebms_status]?.icon || "ℹ️"}{" "}
                  {ebmsStatuses[selectedInvoice.ebms_status]?.label || "EBMS"}
                </span>
                <span
                  className={`vat-badge ${selectedInvoice.vat_customer_payer === "1" ? "assujetti" : "non-assujetti"}`}
                >
                  {selectedInvoice.vat_customer_payer === "1"
                    ? "✅ Assujetti TVA"
                    : "❌ Non assujetti TVA"}
                </span>
              </div>
              {selectedInvoice.ebms_registered_number && (
                <div className="detail-subinfo-row">
                  <strong>Réf EBMS :</strong>{" "}
                  {selectedInvoice.ebms_registered_number}
                  {selectedInvoice.ebms_registered_date && (
                    <span>
                      {" "}
                      •{" "}
                      {new Date(
                        selectedInvoice.ebms_registered_date,
                      ).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              <div className="detail-grid-2cols">
                <div className="detail-card">
                  <h4>{t("customer_information")}</h4>
                  <div className="detail-row">
                    <strong>{selectedInvoice.customer_name}</strong>
                  </div>
                  {selectedInvoice.customer_TIN && (
                    <div className="detail-row">
                      TIN: {selectedInvoice.customer_TIN}
                    </div>
                  )}
                  {selectedInvoice.customer_address && (
                    <div className="detail-row">
                      📮 {selectedInvoice.customer_address}
                    </div>
                  )}
                  {selectedInvoice.customer_email && (
                    <div className="detail-row">
                      📧 {selectedInvoice.customer_email}
                    </div>
                  )}
                  {selectedInvoice.customer_phone && (
                    <div className="detail-row">
                      📞 {selectedInvoice.customer_phone}
                    </div>
                  )}
                </div>
                <div className="detail-card">
                  <h4>{t("invoice_information")}</h4>
                  <div className="detail-row">
                    📅 {t("date")}:{" "}
                    {new Date(selectedInvoice.invoice_date).toLocaleString()}
                  </div>
                  {selectedInvoice.due_date && (
                    <div className="detail-row">
                      ⏰ {t("due_date")}:{" "}
                      {new Date(selectedInvoice.due_date).toLocaleDateString()}
                    </div>
                  )}
                  <div className="detail-row">
                    🏷️ {t("type")}: {selectedInvoice.invoice_type}
                  </div>
                  <div className="detail-row">
                    💵 {t("currency")}:{" "}
                    {selectedInvoice.invoice_currency || "BIF"}
                  </div>
                  <div className="detail-row">
                    🏪 {t("warehouse")}: {selectedInvoice.warehouse_name || "-"}
                  </div>
                </div>
              </div>
              <div className="detail-section">
                <h4>{t("products")}</h4>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("product")}</th>
                        <th>{t("quantity")}</th>
                        <th>{t("unit_price")}</th>
                        <th>{t("discount")}</th>
                        <th>{t("total")}</th>
                        <th>{t("vat")}</th>
                        <th>CT</th>
                        <th>TL</th>
                        <th>TSCE</th>
                        <th>OTT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.item_designation || item.product_name}</td>
                          <td>
                            {item.quantity} {item.unit}
                          </td>
                          <td>{(item.unit_price || 0).toLocaleString()} FBu</td>
                          <td>{item.discount_percent || 0}%</td>
                          <td>
                            {(item.total_amount || 0).toLocaleString()} FBu
                          </td>
                          <td>{(item.vat_amount || 0).toLocaleString()} FBu</td>
                          <td>{(item.ct_amount || 0).toLocaleString()} FBu</td>
                          <td>{(item.tl_amount || 0).toLocaleString()} FBu</td>
                          <td>
                            {(item.tsce_amount || 0).toLocaleString()} FBu
                          </td>
                          <td>{(item.ott_amount || 0).toLocaleString()} FBu</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4" className="total-label">
                          HTVA
                        </td>
                        <td>
                          {(selectedInvoice.subtotal || 0).toLocaleString()} FBu
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="total-label">
                          {t("discount")}
                        </td>
                        <td>
                          -{" "}
                          {(
                            selectedInvoice.discount_total || 0
                          ).toLocaleString()}{" "}
                          FBu
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="total-label">
                          {t("vat")}
                        </td>
                        <td>
                          {(selectedInvoice.vat_amount || 0).toLocaleString()}{" "}
                          FBu
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="total-label">
                          TVAC
                        </td>
                        <td>
                          {(
                            (selectedInvoice.subtotal || 0) +
                            (selectedInvoice.vat_amount || 0)
                          ).toLocaleString()}{" "}
                          FBu
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="total-label">
                          TSCE
                        </td>
                        <td>
                          {(selectedInvoice.items || [])
                            .reduce((sum, it) => {
                              const base = it.total_amount || it.total || 0;
                              const rate = parseFloat(it.tsce_tax || 0) || 0;
                              return sum + base * (rate / 100);
                            }, 0)
                            .toLocaleString()}{" "}
                          FBu
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="total-label">
                          OTT
                        </td>
                        <td>
                          {(selectedInvoice.items || [])
                            .reduce((sum, it) => {
                              const base = it.total_amount || it.total || 0;
                              const rate = parseFloat(it.ott_tax || 0) || 0;
                              return sum + base * (rate / 100);
                            }, 0)
                            .toLocaleString()}{" "}
                          FBu
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="total-label">
                          <strong>{t("grand_total_ttc")}</strong>
                        </td>
                        <td>
                          <strong>
                            {(
                              selectedInvoice.total_amount || 0
                            ).toLocaleString()}{" "}
                            FBu
                          </strong>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              {selectedInvoice.payments?.length > 0 && (
                <div className="detail-section">
                  <h4>{t("payments")}</h4>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("date")}</th>
                          <th>{t("amount")}</th>
                          <th>{t("method")}</th>
                          <th>{t("reference")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.payments.map((payment, idx) => (
                          <tr key={idx}>
                            <td>
                              {new Date(payment.payment_date).toLocaleString()}
                            </td>
                            <td>
                              {(payment.amount || 0).toLocaleString()} FBu
                            </td>
                            <td>{payment.payment_method}</td>
                            <td>{payment.reference || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3" className="total-label">
                            <strong>{t("total_paid")}</strong>
                          </td>
                          <td>
                            <strong>
                              {(
                                selectedInvoice.paid_amount || 0
                              ).toLocaleString()}{" "}
                              FBu
                            </strong>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="3" className="total-label">
                            <strong>{t("remaining")}</strong>
                          </td>
                          <td>
                            <strong>
                              {(
                                (selectedInvoice.total_amount || 0) -
                                (selectedInvoice.paid_amount || 0)
                              ).toLocaleString()}{" "}
                              FBu
                            </strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              {selectedInvoice.notes && (
                <div className="detail-section">
                  <h4>{t("notes")}</h4>
                  <p className="notes-text">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer invoice-detail-actions">
              <button
                className="btn-secondary"
                onClick={() => setDetailModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                {t("close")}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  viewEbmsLogs(selectedInvoice);
                  setDetailModalOpen(false);
                }}
                style={{ cursor: "pointer" }}
              >
                📋 {t("view_ebms_logs") || "Voir logs EBMS"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => verifyInvoiceWithEBMS(selectedInvoice)}
                disabled={selectedInvoice.status === "cancelled"}
                style={{
                  cursor:
                    selectedInvoice.status === "cancelled"
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ✅ {t("verify_ebms") || "Vérifier EBMS"}
              </button>
              <button
                className="btn-primary"
                onClick={() => printInvoice(selectedInvoice)}
                disabled={printLoading}
                style={{ cursor: printLoading ? "not-allowed" : "pointer" }}
              >
                🖨️ {t("print")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOGS EBMS */}
      {ebmsLogsModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setEbmsLogsModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📋</span>
              <h3>EBMS Logs - {selectedInvoice?.invoice_number}</h3>
              <button
                className="modal-close"
                onClick={() => setEbmsLogsModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {ebmsLogs.length === 0 ? (
                <p className="no-data">{t("no_ebms_logs")}</p>
              ) : (
                <div className="logs-list">
                  {ebmsLogs.map((log, idx) => (
                    <div key={idx} className="log-item">
                      <div className="log-header">
                        <span className="log-date">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        <span
                          className={`log-status ${log.status_code === 200 ? "success" : "error"}`}
                        >
                          {log.status_code === 200
                            ? "✅ Succès"
                            : `❌ Erreur ${log.status_code}`}
                        </span>
                      </div>
                      <div className="log-endpoint">
                        Endpoint: {log.endpoint}
                      </div>
                      {log.error_message && (
                        <div className="log-error">
                          Erreur: {log.error_message}
                        </div>
                      )}
                      <details className="log-details">
                        <summary>{t("view_details")}</summary>
                        <pre className="log-data">
                          {JSON.stringify(log.request_data, null, 2)}
                        </pre>
                        <pre className="log-data">
                          {JSON.stringify(log.response_data, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setEbmsLogsModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLES CSS - conservation de tous les styles existants plus ajouts */}
      <style>{`
        /* Tous les styles existants sont conservés */

        .invoices-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .invoices-page.light {
          background: var(--bg-main);
        }
        
        .invoices-page.dark {
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
          gap: 16px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 8px 20px;
          border-radius: 20px;
          color: white;
          font-size: 13px;
          flex-wrap: wrap;
        }
        
        .stat-value {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
        }
        
        .filter-badge {
          background: rgba(255,255,255,0.3);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          margin-left: 8px;
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
          padding: 6px 12px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .bulk-delete-btn:hover:not(:disabled) {
          background: #b91c1c;
          transform: translateY(-1px);
        }
        
        .bulk-sync-btn {
          padding: 6px 12px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .bulk-sync-btn:hover:not(:disabled) {
          background: #d97706;
          transform: translateY(-1px);
        }
        
        .bulk-clear-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 16px;
        }
        
        .active-filters-info {
          background: rgba(102,126,234,0.1);
          padding: 10px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 13px;
          border-left: 4px solid #667eea;
        }
        
        .filter-tag {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
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
        
        .table-responsive {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          margin-bottom: 20px;
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
        
        .invoice-number {
          font-family: monospace;
          font-weight: 600;
          color: #667eea;
        }
        
        .ebms-ref {
          margin-left: 6px;
          font-size: 12px;
          cursor: help;
        }
        
        .tin-text {
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .type-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .ebms-status-box {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin-left: 8px;
        }
        .detail-subinfo-row {
          margin-top: 12px;
          color: var(--text-secondary);
          font-size: 13px;
        }
        .invoice-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 16px;
        }
        
        .payment-status {
          font-size: 12px;
          color: var(--text-primary);
        }
        
        .ebms-status {
          font-size: 12px;
          font-weight: 500;
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
        }
        
        .btn-icon.view { background: rgba(102,126,234,0.1); color: #667eea; }
        .btn-icon.edit { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-icon.payment { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .btn-icon.print { background: rgba(245,158,11,0.1); color: #d97706; }
        .btn-icon.sync { background: rgba(245,158,11,0.1); color: #d97706; }
        .btn-icon.logs { background: rgba(102,126,234,0.1); color: #667eea; }
        .btn-icon.email { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .btn-icon.cancel { background: rgba(220,38,38,0.1); color: #dc2626; }
        
        .btn-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-icon:hover:not(:disabled) {
          transform: scale(1.05);
        }
        
        .btn-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
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
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
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
          color: var(--text-primary);
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
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-main);
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
        
        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 14px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .required {
          color: #dc2626;
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
        
        .unit-hint {
          font-size: 10px;
          color: var(--text-secondary);
          margin-left: 4px;
        }
        
        .items-section {
          margin-top: 24px;
          border-top: 2px solid var(--border);
          padding-top: 24px;
        }
        
        .items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .items-header h4 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: 0.3px;
        }
        
        .btn-add-item {
          padding: 8px 14px;
          background: linear-gradient(135deg, #667eea 0%, #5568d3 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
        }
        
        .btn-add-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
        }
        
        .btn-add-item:active {
          transform: translateY(0);
        }
        
        .btn-remove-item {
          padding: 6px 10px;
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 5px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        .btn-remove-item:hover {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.3);
        }
        
        .items-table-wrapper {
          overflow-x: auto;
          margin-top: 16px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          background: var(--bg-secondary);
        }
        
        .items-table table {
          width: 100%;
        }
        
        .items-table th {
          padding: 12px 10px;
          background: var(--bg-header);
          font-weight: 700;
          color: var(--text-primary);
          border-bottom: 2px solid var(--border);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.4px;
        }
        
        .items-table td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          background: var(--bg-secondary);
        }
        
        .items-table tr:hover td {
          background: var(--bg-hover);
        }
        
        .warning-row td {
          background: rgba(245, 158, 11, 0.08) !important;
        }
        
        .warning-row:hover td {
          background: rgba(245, 158, 11, 0.12) !important;
        }
        
        .select-product {
          min-width: 200px;
          border-radius: 6px;
          border: 1px solid var(--border);
        }
        
        .item-qty-input, .item-price-input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: 5px;
          font-size: 13px;
          transition: all 0.2s ease;
        }
        
        .item-qty-input:focus, .item-price-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .item-qty-input.error-input {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }
        
        }
        
        .attachments-section {
          margin-top: 20px;
          border-top: 1px solid var(--border);
          padding-top: 20px;
        }
        
        .file-upload-area {
          border: 2px dashed var(--border);
          border-radius: 12px;
          padding: 16px;
          margin-top: 8px;
        }
        
        .btn-upload {
          padding: 8px 16px;
          background: var(--bg-main);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .btn-upload:hover {
          background: var(--bg-card);
        }
        
        .file-list {
          margin-top: 12px;
          max-height: 150px;
          overflow-y: auto;
        }
        
        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: var(--bg-main);
          border-radius: 6px;
          margin-bottom: 4px;
        }
        
        .file-name {
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .file-size {
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .btn-remove-file {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
        }
        
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
          background: var(--bg-card);
          border-radius: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
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
        
        .detail-section {
          margin-bottom: 24px;
        }
        
        .detail-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
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
        
        .tin-detail, .address-detail {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        
        .notes-text {
          background: var(--bg-main);
          padding: 12px;
          border-radius: 8px;
          color: var(--text-primary);
        }
        
        .logs-list {
          max-height: 500px;
          overflow-y: auto;
        }
        
        .log-item {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        }
        
        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .log-date {
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .log-status.status-success {
          color: #10b981;
        }
        
        .log-status.status-error {
          color: #ef4444;
        }
        
        .log-endpoint {
          font-size: 12px;
          font-family: monospace;
          color: #667eea;
          margin-bottom: 8px;
        }
        
        .log-error {
          color: #dc2626;
          font-size: 12px;
          margin-bottom: 8px;
        }
        
        .log-details {
          margin-top: 8px;
        }
        
        .log-details summary {
          cursor: pointer;
          color: #667eea;
          font-size: 12px;
        }
        
        .log-data {
          background: var(--bg-main);
          color: var(--text-primary);
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 11px;
          margin-top: 8px;
        }
        
        .no-data {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
        }
        
        .warning-row {
          background-color: rgba(245,158,11,0.1) !important;
        }
        
        .warning-message {
          font-size: 10px;
          color: #dc2626;
          margin-top: 2px;
        }
        
        .stock-warning {
          color: #dc2626;
          font-weight: 500;
        }
        
        .stock-ok {
          color: #10b981;
        }
        
        .no-stock {
          color: #f59e0b;
          font-size: 11px;
        }
        
        .warning-hint {
          color: #f59e0b;
          font-size: 11px;
          margin-top: 4px;
          display: block;
        }
        
        .info-box {
          background: rgba(102,126,234,0.1);
          padding: 12px 16px;
          border-radius: 12px;
          margin: 16px 0;
          display: flex;
          align-items: center;
          gap: 12px;
          border-left: 4px solid #667eea;
        }
        
        .info-icon {
          font-size: 20px;
        }
        
        .loading-box {
          background: var(--bg-main);
          padding: 12px 16px;
          border-radius: 12px;
          margin: 16px 0;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #667eea;
        }
        
        .error-input {
          border-color: #dc2626 !important;
          background-color: rgba(220,38,38,0.1) !important;
        }
        
        @media (max-width: 1024px) {
          .invoices-page {
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
        }
        
        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }
          .stats-badge {
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .modal-container-large {
            width: 95%;
          }
          .action-buttons {
            flex-wrap: wrap;
          }
          .items-table {
            font-size: 12px;
          }
          .select-product {
            min-width: 150px;
          }
        }
        /* Vos styles existants... */

        /* NOUVEAUX STYLES */
        .sortable {
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }
        
        .sortable:hover {
          background: rgba(102,126,234,0.1);
        }
        
        .row-overdue {
          background: rgba(239,68,68,0.05);
        }
        
        .date-overdue {
          color: #dc2626;
          font-weight: 500;
        }
        
        .overdue-badge {
          margin-left: 6px;
          font-size: 12px;
        }
        
        .payment-progress {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }
        
        .payment-progress-bar {
          height: 100%;
          background: #10b981;
          transition: width 0.3s;
        }
        
        .action-dropdown {
          position: relative;
        }
        
        .action-dropdown-trigger {
          background: #e2e8f0;
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }
        
        .action-dropdown-trigger:hover {
          background: #667eea;
          color: white;
        }
        
        .action-dropdown-menu {
          position: absolute;
          right: 0;
          top: 100%;
          margin-top: 4px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          min-width: 180px;
          z-index: 1000;
          overflow: hidden;
        }
        
        .dark .action-dropdown-menu {
          background: #1e293b;
          border-color: #334155;
        }
        
        .action-dropdown-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          color: #1e293b;
          transition: background 0.2s;
        }
        
        .dark .action-dropdown-menu button {
          color: #f1f5f9;
        }
        
        .action-dropdown-menu button:hover {
          background: #f1f5f9;
        }
        
        .dark .action-dropdown-menu button:hover {
          background: #334155;
        }
        
        .action-dropdown-menu button.danger {
          color: #dc2626;
        }
        
        .stats-badge {
          display: flex;
          gap: 16px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 8px 20px;
          border-radius: 20px;
          color: white;
          font-size: 13px;
          flex-wrap: wrap;
        }
        
        .stat-total, .stat-value, .stat-paid, .stat-overdue {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
        }
          /* Ajoutez ces styles dans votre composant Invoices.jsx (dans la balise <style>) */

/* Pour que le dropdown dépasse du tableau */
.data-table td {
  position: relative;
  overflow: visible !important;  /* Important pour permettre au dropdown de dépasser */
}

.action-dropdown {
  position: relative;
  display: inline-block;
}

.action-dropdown-trigger {
  background: #e2e8f0;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  line-height: 1;
}

.action-dropdown-trigger:hover {
  background: #667eea;
  color: white;
}

.action-dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 8px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
  min-width: 200px;
  z-index: 9999 !important;  /* z-index très élevé */
  overflow: visible;
}

/* Version dark mode */
.dark .action-dropdown-menu {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
}

.action-dropdown-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #1e293b;
  transition: background 0.2s;
  white-space: nowrap;
}

.dark .action-dropdown-menu button {
  color: #f1f5f9;
}

.action-dropdown-menu button:hover {
  background: #f1f5f9;
}

.dark .action-dropdown-menu button:hover {
  background: #334155;
}

.action-dropdown-menu button.danger {
  color: #dc2626;
}

.action-dropdown-menu button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Assurer que le conteneur du tableau n'a pas d'overflow caché */
.table-responsive {
  overflow-x: auto !important;
  overflow-y: visible !important;
}

.data-table {
  overflow: visible !important;
}

/* Pour que chaque cellule de la colonne actions puisse contenir un dropdown */
.data-table td:last-child {
  overflow: visible !important;
}
  .data-table th:last-child,
.data-table td:last-child {
  position: sticky;
  right: 0;
  background: inherit;
  z-index: 10;
}

/* Pour le mode sombre */
.dark .data-table td:last-child {
  background-color: #1e293b;
}

.light .data-table td:last-child {
  background-color: white;
}
  /* Styles pour le dropdown avec Portal - Version corrigée */
.portal-dropdown {
  position: absolute;
  background: var(--bg-card, white);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 170px;
  max-width: 200px;
  z-index: 999999 !important;
  overflow: hidden;
  font-size: 13px;
}

/* Support du thème sombre - Fond */
.dark .portal-dropdown {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.light .portal-dropdown {
  background: #ffffff;
  border-color: #e2e8f0;
}

/* Boutons du menu */
.portal-dropdown button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary, #1e293b);
  transition: all 0.2s ease;
  white-space: nowrap;
}

/* Mode clair - texte normal */
.light .portal-dropdown button {
  color: #1e293b;
}

.portal-dropdown button:hover {
  background: var(--bg-main, #f1f5f9) !important;
  color: var(--text-primary, #1e293b) !important;
}

/* Mode sombre - texte normal */
.dark .portal-dropdown button {
  color: #e2e8f0;  /* Gris clair pour bien voir */
}

/* MODE CLAIR - HOVER */
.light .portal-dropdown button:hover {
  background: #e2e8f0 !important;
  color: #1e293b !important;
}

/* MODE SOMBRE - HOVER (correction importante) */
.dark .portal-dropdown button:hover {
  background: #3b82f6 !important;  /* Bleu vif pour bien voir le survol */
  color: #ffffff !important;
}

/* Alternative pour hover en mode sombre avec une autre couleur */
.dark .portal-dropdown button:hover {
  background: #334155 !important;  /* Gris plus clair */
  color: #f1f5f9 !important;
}

/* Ou si vous préférez le violet comme le thème principal */
.dark .portal-dropdown button:hover {
  background: #667eea !important;  /* Violet */
  color: #ffffff !important;
}

/* Bouton danger (supprimer/annuler) */
.portal-dropdown button.danger {
  color: #ef4444;
}

.light .portal-dropdown button.danger:hover {
  background: #fee2e2 !important;
  color: #dc2626 !important;
}

.dark .portal-dropdown button.danger:hover {
  background: #7f1d1d !important;  /* Rouge foncé pour survol */
  color: #fca5a5 !important;
}

/* Boutons désactivés */
.portal-dropdown button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dark .portal-dropdown button:disabled {
  opacity: 0.4;
}

/* Séparateur */
.portal-dropdown hr {
  margin: 4px 0;
  border: none;
  border-top: 1px solid var(--border, #e2e8f0);
}

.dark .portal-dropdown hr {
  border-top-color: #334155;
}

/* Style du bouton déclencheur */
.action-dropdown-trigger-wrapper {
  position: relative;
  display: inline-block;
}

.action-dropdown-trigger {
  background: var(--bg-card, #e2e8f0);
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
  line-height: 1;
  color: var(--text-primary, #1e293b);
}

        /* Styles additionnels */
        .controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .items-per-page {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-card);
          padding: 6px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
        }
        
        .items-per-page select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--bg-main);
          color: var(--text-primary);
        }
        
        .pagination-info {
          color: var(--text-secondary);
          font-size: 13px;
        }
        
        .detail-grid-2cols {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .detail-card {
          background: var(--bg-main);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        
        .detail-card h4 {
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        
        .detail-status-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          padding: 12px;
          background: var(--bg-main);
          border-radius: 10px;
          flex-wrap: wrap;
        }
        
        .payment-info-card {
          background: rgba(16,185,129,0.1);
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          border-left: 4px solid #10b981;
        }
        
        .payment-info-row {
          padding: 6px 0;
        }
        
        .remaining-amount {
          color: #dc2626;
          font-size: 18px;
        }
        
        .total-line {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
        }
        
        .vat-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .vat-badge.assujetti {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }
        
        .vat-badge.non-assujetti {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        
        .info-box {
          background: rgba(102,126,234,0.1);
          padding: 12px 16px;
          border-radius: 12px;
          margin: 16px 0;
          display: flex;
          align-items: center;
          gap: 12px;
          border-left: 4px solid #667eea;
        }
        
        .loading-box {
          background: var(--bg-main);
          padding: 12px 16px;
          border-radius: 12px;
          margin: 16px 0;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #667eea;
        }
        
        .warning-row {
          background-color: rgba(245,158,11,0.1) !important;
        }
        
        .warning-message {
          font-size: 10px;
          color: #dc2626;
          margin-top: 2px;
        }
        
        .stock-warning {
          color: #dc2626;
          font-weight: 500;
        }
        
        .stock-ok {
          color: #10b981;
        }
        
        .no-stock {
          color: #f59e0b;
          font-size: 11px;
        }
        
        .warning-hint {
          color: #f59e0b;
          font-size: 11px;
          margin-top: 4px;
          display: block;
        }
        
        .items-table-wrapper {
          overflow-x: auto;
          margin-top: 12px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .items-table th {
          padding: 10px 8px;
          background: var(--bg-header);
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border);
        }
        
        .items-table td {
          padding: 8px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        
        .select-product {
          min-width: 200px;
        }
        
        @media (max-width: 768px) {
          .detail-grid-2cols {
            grid-template-columns: 1fr;
          }
          .controls-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .items-per-page {
            justify-content: center;
          }
          .select-product {
            min-width: 150px;
          }
        }

        .stock-number {
  font-weight: bold;
  color: inherit;
}

.stock-alert {
  font-size: 11px;
  color: #dc2626;
  margin-top: 2px;
  font-weight: 500;
}

.stock-ok-message {
  font-size: 10px;
  color: #10b981;
  margin-top: 2px;
}

.no-warehouse {
  font-size: 11px;
  color: #f59e0b;
}

.stock-warning {
  background-color: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.stock-ok {
  background-color: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
      `}</style>
    </div>
  );
};

export default Invoices;
