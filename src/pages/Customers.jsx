// frontend/src/pages/Customers.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import Select from "react-select";
import Swal from "sweetalert2";
import { useLanguage } from "../contexts/LanguageContext";
import { useAction } from "../contexts/ActionContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";
import { customerService, getApiErrorMessage } from "../services/apiService";

// Types de clients
const CUSTOMER_TYPES = [
  { value: "individual", label: "Particulier", icon: "👤" },
  { value: "company", label: "Entreprise", icon: "🏢" },
  { value: "government", label: "Gouvernement", icon: "🏛️" },
  { value: "non_profit", label: "Association", icon: "🤝" },
  { value: "foreign", label: "Étranger", icon: "🌍" },
];

// Niveaux de prix
const PRICE_TIERS = [
  { value: "retail", label: "Détail", icon: "🏪" },
  { value: "wholesale", label: "Gros", icon: "📦" },
  { value: "distributor", label: "Distributeur", icon: "🚚" },
  { value: "vip", label: "VIP", icon: "⭐" },
];

// Méthodes de contact préférées
const CONTACT_METHODS = [
  { value: "email", label: "Email", icon: "📧" },
  { value: "phone", label: "Téléphone", icon: "📞" },
  { value: "whatsapp", label: "WhatsApp", icon: "💬" },
  { value: "mail", label: "Courrier", icon: "✉️" },
];

// Méthodes de paiement préférées
const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces", icon: "💵" },
  { value: "bank_transfer", label: "Virement", icon: "🏦" },
  { value: "mobile_money", label: "Mobile Money", icon: "📱" },
  { value: "check", label: "Chèque", icon: "📝" },
  { value: "credit", label: "Crédit", icon: "💳" },
];

// Composant StatusBadge
const StatusBadge = ({ status, t }) => {
  const statusConfig = {
    active: {
      icon: "✅",
      label: "Actif",
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    inactive: {
      icon: "❌",
      label: "Inactif",
      color: "#64748b",
      bg: "rgba(100,116,139,0.1)",
    },
    suspended: {
      icon: "⛔",
      label: "Suspendu",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
    },
    blacklisted: {
      icon: "🚫",
      label: "Blacklisté",
      color: "#dc2626",
      bg: "rgba(220,38,38,0.1)",
    },
    pending: {
      icon: "⏳",
      label: "En attente",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
    },
  };
  const config = statusConfig[status] || statusConfig.active;
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.icon} {config.label}
    </span>
  );
};

// Composant TypeBadge
const TypeBadge = ({ type }) => {
  const typeInfo =
    CUSTOMER_TYPES.find((t) => t.value === type) || CUSTOMER_TYPES[0];
  return (
    <span className="type-badge">
      {typeInfo.icon} {typeInfo.label}
    </span>
  );
};

// Composant VatBadge
const VatBadge = ({ isVatSubject, t }) => {
  return (
    <span
      className={`vat-badge ${isVatSubject ? "assujetti" : "non-assujetti"}`}
    >
      {isVatSubject ? "✅ Assujetti TVA" : "❌ Non assujetti"}
    </span>
  );
};

// Styles pour React-Select
const selectStyles = (isDark) => ({
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
});

const Customers = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const location = useLocation();
  const isDark = theme === "dark";

  // États
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterVat, setFilterVat] = useState("all");

  // États des modaux
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // États pour le formulaire
  const [formData, setFormData] = useState({
    customer_type: "individual",
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    email_secondary: "",
    phone: "",
    phone_secondary: "",
    whatsapp: "",
    website: "",
    address: "",
    address_line2: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Burundi",
    tin: "",
    is_vat_subject: false,
    status: "active",
    price_tier: "retail",
    payment_terms: 30,
    credit_limit: 0,
    notes: "",
    preferred_contact_method: "email",
    preferred_payment_method: "",
    preferred_language: "fr",
    currency: "BIF",
    marketing_consent: false,
  });

  // Loaders
  const [submitLoading, setSubmitLoading] = useState(false);
  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);

  // Statistiques
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    vat_subject: 0,
    non_vat_subject: 0,
    companies: 0,
    individuals: 0,
  });

  // Calculer les statistiques
  const calculateStats = useCallback((customersList) => {
    setStats({
      total: customersList.length,
      active: customersList.filter((c) => c.status === "active").length,
      inactive: customersList.filter((c) => c.status !== "active").length,
      vat_subject: customersList.filter((c) => c.is_vat_subject === 1).length,
      non_vat_subject: customersList.filter((c) => c.is_vat_subject !== 1)
        .length,
      companies: customersList.filter((c) => c.customer_type === "company")
        .length,
      individuals: customersList.filter((c) => c.customer_type === "individual")
        .length,
    });
  }, []);

  // Afficher une confirmation SweetAlert
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

  // Chargement des clients avec AbortController pour annuler les requêtes en cours
  const loadCustomers = useCallback(async () => {
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterType !== "all") params.customer_type = filterType;
      if (filterVat !== "all")
        params.is_vat_subject = filterVat === "yes" ? 1 : 0;

      const response = await customerService.getAll(params);

      if (!controller.signal.aborted && response.data?.success) {
        const customersList = response.data.data || [];
        setCustomers(customersList);
        setTotalItems(response.data.pagination?.total || customersList.length);
        calculateStats(customersList);
      } else if (!controller.signal.aborted) {
        toast.error(response.data?.message || t("error_loading_customers"));
      }
    } catch (error) {
      if (!controller.signal.aborted && error.name !== "AbortError") {
        console.error("Erreur:", error);
        toast.error(getApiErrorMessage(error, t("error_loading_customers")));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [searchTerm, filterStatus, filterType, filterVat, calculateStats, t]);

  // Création/Mise à jour client
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name && !formData.last_name && !formData.company_name) {
      toast.error(t("name_required"));
      return;
    }

    if (!formData.phone) {
      toast.error(t("phone_required"));
      return;
    }

    const confirmed = await showConfirmDialog(
      editingCustomer ? t("confirm_update") : t("confirm_create"),
      editingCustomer ? t("update_confirmation") : t("create_confirmation"),
      editingCustomer ? t("save") : t("create"),
    );

    if (!confirmed) return;

    setSubmitLoading(true);
    try {
      const payload = {
        customer_type: formData.customer_type,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        company_name: formData.company_name || null,
        email: formData.email || null,
        email_secondary: formData.email_secondary || null,
        phone: formData.phone,
        phone_secondary: formData.phone_secondary || null,
        whatsapp: formData.whatsapp || null,
        website: formData.website || null,
        address: formData.address || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        province: formData.province || null,
        postal_code: formData.postal_code || null,
        country: formData.country || "Burundi",
        tin: formData.tin || null,
        is_vat_subject: formData.is_vat_subject ? 1 : 0,
        status: formData.status,
        price_tier: formData.price_tier,
        payment_terms: formData.payment_terms,
        credit_limit: formData.credit_limit,
        notes: formData.notes || null,
        preferred_contact_method: formData.preferred_contact_method,
        preferred_payment_method: formData.preferred_payment_method || null,
        preferred_language: formData.preferred_language,
        currency: formData.currency,
        marketing_consent: formData.marketing_consent ? 1 : 0,
      };

      let response;
      if (editingCustomer) {
        response = await customerService.update(editingCustomer.id, payload);
        toast.success(t("customer_updated"));
      } else {
        response = await customerService.create(payload);
        toast.success(t("customer_created"));
      }

      if (response.data?.success) {
        loadCustomers();
        closeModal();
        resetForm();
      } else {
        toast.error(response.data?.message || t("error_saving_customer"));
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(t("error_saving_customer"));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Suppression client
  const handleDelete = async (customer) => {
    const confirmed = await showConfirmDialog(
      t("confirm_delete"),
      `${t("confirm_delete_desc")} "${customer.display_name}" ?`,
      t("delete"),
      "#dc2626",
    );
    if (!confirmed) return;

    try {
      const response = await customerService.delete(customer.id);
      if (response.data?.success) {
        toast.success(t("customer_deleted"));
        loadCustomers();
        if (selectedCustomers.includes(customer.id)) {
          setSelectedCustomers((prev) =>
            prev.filter((id) => id !== customer.id),
          );
        }
      } else {
        toast.error(response.data?.message || t("error_deleting_customer"));
      }
    } catch (error) {
      toast.error(t("error_deleting_customer"));
    }
  };

  // Actions groupées
  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map((c) => c.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) {
      toast.error(t("select_customers"));
      return;
    }

    const confirmed = await showConfirmDialog(
      t("confirm_bulk_delete"),
      t("confirm_bulk_delete_desc").replace(
        "{count}",
        selectedCustomers.length,
      ),
      t("delete"),
      "#dc2626",
    );
    if (!confirmed) return;

    let deleted = 0;
    for (const id of selectedCustomers) {
      try {
        await customerService.delete(id);
        deleted++;
      } catch (error) {
        console.error(`Erreur suppression ${id}:`, error);
      }
    }

    toast.success(t("bulk_delete_success").replace("{count}", deleted));
    setSelectedCustomers([]);
    loadCustomers();
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedCustomers.length === 0) {
      toast.error(t("select_customers"));
      return;
    }

    const confirmed = await showConfirmDialog(
      t("confirm_bulk_status"),
      t("confirm_bulk_status_desc").replace(
        "{count}",
        selectedCustomers.length,
      ),
      t("apply"),
    );
    if (!confirmed) return;

    let updated = 0;
    for (const id of selectedCustomers) {
      try {
        await customerService.update(id, { status });
        updated++;
      } catch (error) {
        console.error(`Erreur mise à jour ${id}:`, error);
      }
    }

    toast.success(t("bulk_status_success").replace("{count}", updated));
    setSelectedCustomers([]);
    loadCustomers();
  };

  // Utilitaires
  const resetForm = () => {
    setFormData({
      customer_type: "individual",
      first_name: "",
      last_name: "",
      company_name: "",
      email: "",
      email_secondary: "",
      phone: "",
      phone_secondary: "",
      whatsapp: "",
      website: "",
      address: "",
      address_line2: "",
      city: "",
      province: "",
      postal_code: "",
      country: "Burundi",
      tin: "",
      is_vat_subject: false,
      status: "active",
      price_tier: "retail",
      payment_terms: 30,
      credit_limit: 0,
      notes: "",
      preferred_contact_method: "email",
      preferred_payment_method: "",
      preferred_language: "fr",
      currency: "BIF",
      marketing_consent: false,
    });
    setEditingCustomer(null);
  };

  const openModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        customer_type: customer.customer_type || "individual",
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        company_name: customer.company_name || "",
        email: customer.email || "",
        email_secondary: customer.email_secondary || "",
        phone: customer.phone || "",
        phone_secondary: customer.phone_secondary || "",
        whatsapp: customer.whatsapp || "",
        website: customer.website || "",
        address: customer.address_line1 || "",
        address_line2: customer.address_line2 || "",
        city: customer.city || "",
        province: customer.province || "",
        postal_code: customer.postal_code || "",
        country: customer.country || "Burundi",
        tin: customer.tin || "",
        is_vat_subject: customer.is_vat_subject === 1,
        status: customer.status || "active",
        price_tier: customer.price_tier || "retail",
        payment_terms: customer.payment_terms || 30,
        credit_limit: customer.credit_limit || 0,
        notes: customer.notes || "",
        preferred_contact_method: customer.preferred_contact_method || "email",
        preferred_payment_method: customer.preferred_payment_method || "",
        preferred_language: customer.preferred_language || "fr",
        currency: customer.currency || "BIF",
        marketing_consent: customer.marketing_consent === 1,
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
  };

  const viewCustomerDetail = async (customer) => {
    try {
      const response = await customerService.getById(customer.id);
      if (response.data?.success) {
        setSelectedCustomer(response.data.data);
        setDetailModalOpen(true);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(t("error_loading_details"));
    }
  };

  const exportCustomersToCSV = async () => {
    toast.loading(t("export_preparing"), { id: "export" });
    try {
      const response = await customerService.getAll({ limit: 9999 });
      const allCustomers = response.data?.data || [];

      if (allCustomers.length === 0) {
        toast.error(t("export_no_data"), { id: "export" });
        return;
      }

      const headers = [
        "N° Client",
        "Nom",
        "Type",
        "Email",
        "Téléphone",
        "TIN",
        "Assujetti TVA",
        "Statut",
        "Total Achats",
      ];
      const rows = allCustomers.map((c) => [
        c.customer_number,
        c.display_name,
        c.customer_type,
        c.email || "-",
        c.phone || "-",
        c.tin || "-",
        c.is_vat_subject ? "Oui" : "Non",
        c.status,
        formatCurrency(c.total_purchases || 0),
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
        `customers_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        t("export_success").replace("{count}", allCustomers.length),
        { id: "export" },
      );
    } catch (error) {
      console.error("Erreur export:", error);
      toast.error(t("export_error"), { id: "export" });
    }
  };

  const printCustomers = () => {
    const printWindow = window.open("", "_blank");
    const headers = [
      "N° Client",
      "Nom",
      "Type",
      "Email",
      "Téléphone",
      "TIN",
      "TVA",
      "Statut",
    ];
    const rows = customers
      .map(
        (c) => `
      <tr><td>${c.customer_number}</td><td>${c.display_name}</td><td>${c.customer_type}</td><td>${c.email || "-"}</td><td>${c.phone || "-"}</td><td>${c.tin || "-"}</td><td>${c.is_vat_subject ? "Oui" : "Non"}</td><td>${c.status}</td></tr>
    `,
      )
      .join("");

    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Liste des clients</title><meta charset="UTF-8"><style>body{font-family:Arial;margin:20px}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#667eea;color:white}</style></head><body><h1>Liste des clients</h1><p>Date: ${new Date().toLocaleString()}</p><p>Total clients: ${customers.length}</p><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`,
    );
    printWindow.document.close();
  };

  // Enregistrement des actions - UNE SEULE FOIS AU MONTAGE
  useEffect(() => {
    const handleAdd = () => openModal();
    const handleRefresh = () => loadCustomers();
    const handleExport = () => exportCustomersToCSV();
    const handlePrint = () => printCustomers();

    registerAction("add", handleAdd);
    registerAction("refresh", handleRefresh);
    registerAction("export", handleExport);
    registerAction("print", handlePrint);

    return () => {
      unregisterAction("add");
      unregisterAction("refresh");
      unregisterAction("export");
      unregisterAction("print");
      // Annuler les requêtes en cours au démontage
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // Tableau vide IMPORTANT pour ne pas se réenregistrer

  // Chargement initial ET à chaque changement de route ou filtres
  useEffect(() => {
    if (isMounted.current) {
      loadCustomers();
    }
  }, [loadCustomers]);

  // Montage / Démontage
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Annuler toutes les requêtes en cours au démontage
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedCustomers = customers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (loading) {
    return <Loader text={t("loading_customers")} />;
  }

  return (
    <div className={`customers-page ${isDark ? "dark" : "light"}`}>
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
          <h2>👥 {t("customers")}</h2>
          <p>{t("customers_desc")}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">👥 Total: {stats.total}</span>
          <span className="stat-active">✅ Actifs: {stats.active}</span>
          <span className="stat-inactive">❌ Inactifs: {stats.inactive}</span>
          <span className="stat-vat">📋 TVA: {stats.vat_subject}</span>
          <span className="stat-type">🏢 Entreprises: {stats.companies}</span>
        </div>
      </div>

      {/* Actions groupées */}
      {selectedCustomers.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">
            {selectedCustomers.length} {t("selected")}
          </span>
          <button className="bulk-delete-btn" onClick={handleBulkDelete}>
            🗑️ {t("delete_selected")}
          </button>
          <button
            className="bulk-active-btn"
            onClick={() => handleBulkStatusUpdate("active")}
          >
            ✅ Activer
          </button>
          <button
            className="bulk-inactive-btn"
            onClick={() => handleBulkStatusUpdate("inactive")}
          >
            ❌ Désactiver
          </button>
          <button
            className="bulk-clear-btn"
            onClick={() => setSelectedCustomers([])}
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
            placeholder={t("search_customers")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            Tous
          </button>
          <button
            className={`filter-tab ${filterStatus === "active" ? "active" : ""}`}
            onClick={() => setFilterStatus("active")}
          >
            ✅ Actifs
          </button>
          <button
            className={`filter-tab ${filterStatus === "inactive" ? "active" : ""}`}
            onClick={() => setFilterStatus("inactive")}
          >
            ❌ Inactifs
          </button>
        </div>
        <div className="filter-select">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Tous types</option>
            {CUSTOMER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-select">
          <select
            value={filterVat}
            onChange={(e) => setFilterVat(e.target.value)}
          >
            <option value="all">TVA: Tous</option>
            <option value="yes">✅ Assujetti TVA</option>
            <option value="no">❌ Non assujetti</option>
          </select>
        </div>
        <div className="items-per-page">
          <span>Afficher:</span>
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

      {/* Tableau des clients - (garder le reste du JSX identique) */}
      <div className="table-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedCustomers.length === paginatedCustomers.length &&
                      paginatedCustomers.length > 0
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th>{t("customer_number")}</th>
                <th>{t("name")}</th>
                <th>{t("type")}</th>
                <th>{t("phone")}</th>
                <th>{t("email")}</th>
                <th>TVA</th>
                <th>{t("total_purchases")}</th>
                <th>{t("status")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className={customer.status !== "active" ? "inactive-row" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={() => handleSelectOne(customer.id)}
                    />
                  </td>
                  <td>
                    <span className="customer-number">
                      {customer.customer_number}
                    </span>
                  </td>
                  <td>
                    <div className="customer-name">
                      <strong>{customer.display_name}</strong>
                      {customer.company_name &&
                        customer.customer_type === "company" && (
                          <small>{customer.company_name}</small>
                        )}
                    </div>
                  </td>
                  <td>
                    <TypeBadge type={customer.customer_type} />
                  </td>
                  <td>{customer.phone || "-"}</td>
                  <td>{customer.email || "-"}</td>
                  <td>
                    <VatBadge
                      isVatSubject={customer.is_vat_subject === 1}
                      t={t}
                    />
                  </td>
                  <td>
                    <strong>
                      {formatCurrency(customer.total_purchases || 0)}
                    </strong>
                  </td>
                  <td>
                    <StatusBadge status={customer.status} t={t} />
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Tippy content={t("view_details")} placement="top">
                        <button
                          className="btn-icon view"
                          onClick={() => viewCustomerDetail(customer)}
                        >
                          👁️
                        </button>
                      </Tippy>
                      <Tippy content={t("edit")} placement="top">
                        <button
                          className="btn-icon edit"
                          onClick={() => openModal(customer)}
                        >
                          ✏️
                        </button>
                      </Tippy>
                      <Tippy content={t("delete")} placement="top">
                        <button
                          className="btn-icon delete"
                          onClick={() => handleDelete(customer)}
                        >
                          🗑️
                        </button>
                      </Tippy>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedCustomers.length === 0 && (
                <tr className="empty-row">
                  <td colSpan="10">
                    <div className="empty-state">
                      <span className="empty-icon">👥</span>
                      <p>{t("no_customers")}</p>
                      <button
                        className="btn-primary"
                        onClick={() => openModal()}
                      >
                        ➕ {t("add_first_customer")}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination-bar">
          <div className="pagination-info">
            {t("showing")} {(currentPage - 1) * itemsPerPage + 1} à{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} sur {totalItems}{" "}
            clients
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
      </div>

      {/* MODAL CRÉATION/MODIFICATION CLIENT - (garder le reste identique) */}
      {/* MODAL CRÉATION/MODIFICATION CLIENT */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">👥</span>
              <h3>
                {editingCustomer ? t("edit_customer") : t("new_customer")}
              </h3>
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
                  <h4>Informations générales</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">{t("customer_type")}</label>
                      <select
                        value={formData.customer_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_type: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        {CUSTOMER_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {formData.customer_type === "company" ? (
                      <div className="form-group">
                        <label className="required">{t("company_name")}</label>
                        <input
                          type="text"
                          value={formData.company_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              company_name: e.target.value,
                            })
                          }
                          style={{ cursor: "text" }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="form-group">
                          <label className="required">{t("first_name")}</label>
                          <input
                            type="text"
                            value={formData.first_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                first_name: e.target.value,
                              })
                            }
                            style={{ cursor: "text" }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="required">{t("last_name")}</label>
                          <input
                            type="text"
                            value={formData.last_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                last_name: e.target.value,
                              })
                            }
                            style={{ cursor: "text" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4>Coordonnées</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">{t("phone")}</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        required
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("phone_secondary")}</label>
                      <input
                        type="tel"
                        value={formData.phone_secondary}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone_secondary: e.target.value,
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("whatsapp")}</label>
                      <input
                        type="tel"
                        value={formData.whatsapp}
                        onChange={(e) =>
                          setFormData({ ...formData, whatsapp: e.target.value })
                        }
                        style={{ cursor: "text" }}
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
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("email_secondary")}</label>
                      <input
                        type="email"
                        value={formData.email_secondary}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            email_secondary: e.target.value,
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("website")}</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) =>
                          setFormData({ ...formData, website: e.target.value })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Adresse</h4>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>{t("address")}</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>{t("address_line2")}</label>
                      <input
                        type="text"
                        value={formData.address_line2}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address_line2: e.target.value,
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("city")}</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("province")}</label>
                      <input
                        type="text"
                        value={formData.province}
                        onChange={(e) =>
                          setFormData({ ...formData, province: e.target.value })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("postal_code")}</label>
                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            postal_code: e.target.value,
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("country")}</label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Informations fiscales et commerciales</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t("tin")}</label>
                      <input
                        type="text"
                        value={formData.tin}
                        onChange={(e) =>
                          setFormData({ ...formData, tin: e.target.value })
                        }
                        placeholder="Numéro d'identification fiscale"
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("is_vat_subject")}</label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.is_vat_subject}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_vat_subject: e.target.checked,
                            })
                          }
                          style={{ cursor: "pointer" }}
                        />
                        Client assujetti à la TVA
                      </label>
                    </div>
                    <div className="form-group">
                      <label>{t("price_tier")}</label>
                      <select
                        value={formData.price_tier}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price_tier: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        {PRICE_TIERS.map((tier) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.icon} {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("payment_terms")} (jours)</label>
                      <input
                        type="number"
                        value={formData.payment_terms}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            payment_terms: parseInt(e.target.value),
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("credit_limit")} (FBu)</label>
                      <input
                        type="number"
                        value={formData.credit_limit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            credit_limit: parseFloat(e.target.value),
                          })
                        }
                        style={{ cursor: "text" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("status")}</label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <option value="active">✅ Actif</option>
                        <option value="inactive">❌ Inactif</option>
                        <option value="suspended">⛔ Suspendu</option>
                        <option value="blacklisted">🚫 Blacklisté</option>
                        <option value="pending">⏳ En attente</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Préférences</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t("preferred_contact_method")}</label>
                      <select
                        value={formData.preferred_contact_method}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferred_contact_method: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        {CONTACT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.icon} {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("preferred_payment_method")}</label>
                      <select
                        value={formData.preferred_payment_method}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferred_payment_method: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <option value="">Non spécifié</option>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.icon} {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("preferred_language")}</label>
                      <select
                        value={formData.preferred_language}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferred_language: e.target.value,
                          })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                        <option value="sw">Kiswahili</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("currency")}</label>
                      <select
                        value={formData.currency}
                        onChange={(e) =>
                          setFormData({ ...formData, currency: e.target.value })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <option value="BIF">FBu (Franc Burundais)</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.marketing_consent}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              marketing_consent: e.target.checked,
                            })
                          }
                          style={{ cursor: "pointer" }}
                        />
                        Consentement marketing
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-group full-width">
                    <label>{t("notes")}</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows="3"
                      placeholder="Notes internes..."
                      style={{ cursor: "text" }}
                    />
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
                  ) : editingCustomer ? (
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

      {/* MODAL DÉTAIL CLIENT - Version enrichie avec toutes les informations */}
      {detailModalOpen && selectedCustomer && (
        <div
          className="modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">👥</span>
              <h3>{t("customer_details")}</h3>
              <button
                className="modal-close"
                onClick={() => setDetailModalOpen(false)}
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Informations générales</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>{t("customer_number")}:</strong>{" "}
                    {selectedCustomer.customer_number}
                  </div>
                  <div className="detail-item">
                    <strong>{t("name")}:</strong>{" "}
                    {selectedCustomer.display_name}
                  </div>
                  <div className="detail-item">
                    <strong>{t("type")}:</strong>{" "}
                    <TypeBadge type={selectedCustomer.customer_type} />
                  </div>
                  <div className="detail-item">
                    <strong>Statut fiscal:</strong>{" "}
                    <VatBadge
                      isVatSubject={selectedCustomer.is_vat_subject === 1}
                      t={t}
                    />
                  </div>
                  <div className="detail-item">
                    <strong>{t("status")}:</strong>{" "}
                    <StatusBadge status={selectedCustomer.status} t={t} />
                  </div>
                  <div className="detail-item">
                    <strong>Niveau tarifaire:</strong>{" "}
                    {PRICE_TIERS.find(
                      (t) => t.value === selectedCustomer.price_tier,
                    )?.label || selectedCustomer.price_tier}
                  </div>
                  <div className="detail-item">
                    <strong>Délai de paiement:</strong>{" "}
                    {selectedCustomer.payment_terms} jours
                  </div>
                  <div className="detail-item">
                    <strong>Limite de crédit:</strong>{" "}
                    {formatCurrency(selectedCustomer.credit_limit || 0)}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Coordonnées</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>{t("email")}:</strong>{" "}
                    {selectedCustomer.email || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Email secondaire:</strong>{" "}
                    {selectedCustomer.email_secondary || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>{t("phone")}:</strong>{" "}
                    {selectedCustomer.phone || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Téléphone secondaire:</strong>{" "}
                    {selectedCustomer.phone_secondary || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>WhatsApp:</strong>{" "}
                    {selectedCustomer.whatsapp || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Site web:</strong> {selectedCustomer.website || "-"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Adresse</h4>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <strong>Adresse:</strong>{" "}
                    {selectedCustomer.address_line1 || "-"}
                  </div>
                  <div className="detail-item full-width">
                    <strong>Complément:</strong>{" "}
                    {selectedCustomer.address_line2 || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Ville:</strong> {selectedCustomer.city || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Province:</strong>{" "}
                    {selectedCustomer.province || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Code postal:</strong>{" "}
                    {selectedCustomer.postal_code || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Pays:</strong>{" "}
                    {selectedCustomer.country || "Burundi"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Informations fiscales</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>NIF (TIN):</strong> {selectedCustomer.tin || "-"}
                  </div>
                  <div className="detail-item">
                    <strong>Assujetti TVA:</strong>{" "}
                    {selectedCustomer.is_vat_subject ? "✅ Oui" : "❌ Non"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Préférences</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Contact préféré:</strong>{" "}
                    {
                      CONTACT_METHODS.find(
                        (m) =>
                          m.value === selectedCustomer.preferred_contact_method,
                      )?.icon
                    }{" "}
                    {selectedCustomer.preferred_contact_method}
                  </div>
                  <div className="detail-item">
                    <strong>Paiement préféré:</strong>{" "}
                    {
                      PAYMENT_METHODS.find(
                        (m) =>
                          m.value === selectedCustomer.preferred_payment_method,
                      )?.icon
                    }{" "}
                    {selectedCustomer.preferred_payment_method ||
                      "Non spécifié"}
                  </div>
                  <div className="detail-item">
                    <strong>Langue:</strong>{" "}
                    {selectedCustomer.preferred_language === "fr"
                      ? "Français"
                      : selectedCustomer.preferred_language === "en"
                        ? "English"
                        : "Kiswahili"}
                  </div>
                  <div className="detail-item">
                    <strong>Devise:</strong> {selectedCustomer.currency}
                  </div>
                  <div className="detail-item full-width">
                    <strong>Consentement marketing:</strong>{" "}
                    {selectedCustomer.marketing_consent
                      ? "✅ Accepté"
                      : "❌ Refusé"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Statistiques commerciales</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Total achats:</strong>{" "}
                    {formatCurrency(selectedCustomer.total_purchases || 0)}
                  </div>
                  <div className="detail-item">
                    <strong>Nombre de factures:</strong>{" "}
                    {selectedCustomer.invoice_count || 0}
                  </div>
                  <div className="detail-item">
                    <strong>Dernier achat:</strong>{" "}
                    {selectedCustomer.last_purchase_date
                      ? new Date(
                          selectedCustomer.last_purchase_date,
                        ).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="detail-section">
                  <h4>Notes internes</h4>
                  <div className="notes-text">{selectedCustomer.notes}</div>
                </div>
              )}

              {selectedCustomer.recent_invoices?.length > 0 && (
                <div className="detail-section">
                  <h4>{t("recent_invoices")}</h4>
                  <div className="table-responsive">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>{t("invoice_number")}</th>
                          <th>{t("date")}</th>
                          <th>{t("total_amount")}</th>
                          <th>{t("status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCustomer.recent_invoices.map(
                          (invoice, idx) => (
                            <tr key={idx}>
                              <td>{invoice.invoice_number}</td>
                              <td>
                                {new Date(
                                  invoice.invoice_date,
                                ).toLocaleDateString()}
                              </td>
                              <td>{formatCurrency(invoice.total_amount)}</td>
                              <td>{invoice.payment_status}</td>
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
                style={{ cursor: "pointer" }}
              >
                {t("close")}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setDetailModalOpen(false);
                  openModal(selectedCustomer);
                }}
                style={{ cursor: "pointer" }}
              >
                ✏️ {t("edit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles CSS */}
      <style>{`
        /* Garder tous les styles inchangés */
        .customers-page { padding: 24px 32px; min-height: 100vh; }
        .customers-page.light { background: var(--bg-main, #f8fafc); }
        .customers-page.dark { background: var(--bg-main, #0f172a); }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .page-header h2 { font-size: 28px; font-weight: 700; margin-bottom: 6px; color: var(--text-primary, #1e293b); }
        .page-header p { color: var(--text-secondary, #64748b); font-size: 14px; }
        .stats-badge { display: flex; gap: 12px; background: linear-gradient(135deg, #667eea, #764ba2); padding: 8px 20px; border-radius: 20px; color: white; font-size: 13px; flex-wrap: wrap; }
        .stats-badge span { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; }
        .bulk-actions-bar { background: rgba(102,126,234,0.1); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; border-left: 4px solid #667eea; }
        .bulk-count { font-weight: 600; color: var(--text-primary); }
        .bulk-delete-btn { padding: 6px 16px; background: rgba(239,68,68,0.1); color: #dc2626; border: none; border-radius: 8px; cursor: pointer; }
        .bulk-active-btn { padding: 6px 16px; background: rgba(16,185,129,0.1); color: #10b981; border: none; border-radius: 8px; cursor: pointer; }
        .bulk-inactive-btn { padding: 6px 16px; background: rgba(100,116,139,0.1); color: #64748b; border: none; border-radius: 8px; cursor: pointer; }
        .bulk-clear-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 16px; }
        .filters-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .search-box { display: flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 16px; min-width: 280px; }
        .search-icon { font-size: 18px; margin-right: 8px; color: var(--text-secondary); }
        .search-box input { flex: 1; border: none; outline: none; font-size: 14px; background: transparent; color: var(--text-primary); }
        .filter-tabs { display: flex; gap: 8px; background: var(--bg-card); padding: 4px; border-radius: 12px; border: 1px solid var(--border); }
        .filter-tab { padding: 8px 20px; border: none; background: transparent; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--text-secondary); }
        .filter-tab.active { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .filter-select select { padding: 8px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-card); color: var(--text-primary); cursor: pointer; }
        .items-per-page { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
        .items-per-page select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); color: var(--text-primary); cursor: pointer; }
        .table-container { background: var(--bg-card); border-radius: 20px; padding: 20px; border: 1px solid var(--border); }
        .table-responsive { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .data-table th { background: var(--bg-header); font-weight: 600; }
        .inactive-row { opacity: 0.7; background: var(--bg-main); }
        .customer-number { font-family: monospace; font-weight: 600; color: #667eea; }
        .customer-name strong { display: block; color: var(--text-primary); }
        .customer-name small { font-size: 11px; color: var(--text-secondary); }
        .type-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; background: rgba(102,126,234,0.1); color: #667eea; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .vat-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .vat-badge.assujetti { background: rgba(16,185,129,0.1); color: #10b981; }
        .vat-badge.non-assujetti { background: rgba(239,68,68,0.1); color: #dc2626; }
        .action-buttons { display: flex; gap: 6px; }
        .btn-icon { padding: 6px 10px; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 14px; background: transparent; }
        .btn-icon.view { background: rgba(102,126,234,0.1); color: #667eea; }
        .btn-icon.edit { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-icon.delete { background: rgba(239,68,68,0.1); color: #dc2626; }
        .btn-icon:hover { transform: scale(1.05); }
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-wrap: wrap; gap: 16px; }
        .pagination-info { font-size: 13px; color: var(--text-secondary); }
        .pagination { display: flex; gap: 8px; align-items: center; }
        .pagination button { padding: 8px 12px; border: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; cursor: pointer; color: var(--text-primary); transition: all 0.2s; }
        .pagination button:hover:not(:disabled) { background: var(--bg-main); border-color: #667eea; }
        .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { color: var(--text-secondary); font-size: 14px; }
        .empty-state { text-align: center; padding: 60px; }
        .empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
        
        /* Loading */
        .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 16px; }
        .loading-container.light { background: var(--bg-main, #f8fafc); }
        .loading-container.dark { background: var(--bg-main, #0f172a); }
        .loading-container p { color: var(--text-secondary); }
        .loader-spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* Modals - garder le reste... */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-container { background: var(--bg-card); border-radius: 20px; width: 90%; max-width: 700px; max-height: 90vh; overflow: auto; }
        .modal-container-large { background: var(--bg-card); border-radius: 20px; width: 95%; max-width: 1000px; max-height: 90vh; overflow: auto; }
        .modal-header { padding: 20px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 20px 20px 0 0; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
        .modal-header h3 { margin: 0; font-size: 18px; }
        .modal-icon { font-size: 24px; margin-right: 12px; }
        .modal-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 18px; transition: all 0.2s; }
        .modal-body { padding: 24px; }
        .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 12px; position: sticky; bottom: 0; background: var(--bg-card); }
        .form-section { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
        .form-section h4 { font-size: 15px; font-weight: 600; margin-bottom: 16px; padding-left: 8px; border-left: 3px solid #667eea; color: var(--text-primary); }
        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .form-group.full-width { grid-column: span 2; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px; color: var(--text-primary); }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-main); color: var(--text-primary); transition: all 0.2s; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: normal !important; }
        .checkbox-label input { width: auto; }
        .required::after { content: " *"; color: #dc2626; }
        .detail-section { margin-bottom: 24px; }
        .detail-section h4 { font-size: 14px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .detail-item.full-width { grid-column: span 2; }
        .detail-item { padding: 8px 0; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .notes-text { background: var(--bg-main); padding: 12px; border-radius: 8px; color: var(--text-primary); }
        .mini-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .mini-table th, .mini-table td { padding: 8px; text-align: left; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .mini-table th { background: var(--bg-header); font-weight: 600; }
        .btn-primary { padding: 10px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-secondary { padding: 10px 20px; background: var(--bg-main); color: var(--text-primary); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
        .btn-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
          .customers-page { padding: 16px; }
          .form-grid { grid-template-columns: 1fr; }
          .form-group.full-width { grid-column: span 1; }
          .detail-grid { grid-template-columns: 1fr; }
          .filters-bar { flex-direction: column; align-items: stretch; }
          .search-box { width: 100%; }
          .filter-tabs { justify-content: center; }
          .stats-badge { flex-direction: column; align-items: center; gap: 8px; }
          .page-header { flex-direction: column; align-items: stretch; }
          .bulk-actions-bar { flex-direction: column; align-items: stretch; }
          .pagination-bar { flex-direction: column; align-items: center; }
          .modal-container-large { width: 95%; }
        }
      `}</style>
    </div>
  );
};

// Helper pour formater les nombres
const formatNumber = (num) => new Intl.NumberFormat("fr-BI").format(num || 0);
const formatCurrency = (num) =>
  new Intl.NumberFormat("fr-BI", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0) + " FBu";

export default Customers;
