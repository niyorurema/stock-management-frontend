import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import Swal from "sweetalert2";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAction } from "../contexts/ActionContext";
import { usePermission } from "../hooks/usePermission";
import {
  reservationService,
  productService,
  customerService,
  getApiErrorMessage,
} from "../services/apiService";
import { getSelectStyles } from "../utils/selectTheme";
import { getSwalTheme } from "../utils/swalTheme";
import { confirm } from "../services/notificationService";
import Loader from "../components/common/Loader";
import DropdownMenu from "../components/common/DropdownMenu";

const ITEMS_PER_PAGE = 5;

const getStatuses = (t) => [
  {
    value: "pending",
    label: t("reservation_status_pending"),
    color: "#f59e0b",
    icon: "⏳",
  },
  {
    value: "confirmed",
    label: t("reservation_status_confirmed"),
    color: "#3b82f6",
    icon: "✅",
  },
  {
    value: "partially_delivered",
    label: t("reservation_status_partially_delivered"),
    color: "#f97316",
    icon: "📦",
  },
  {
    value: "completed",
    label: t("reservation_status_completed"),
    color: "#10b981",
    icon: "🎉",
  },
  {
    value: "cancelled",
    label: t("reservation_status_cancelled"),
    color: "#ef4444",
    icon: "❌",
  },
];

const getPriorities = (t) => [
  { value: "low", label: t("priority_low"), color: "#10b981", icon: "🟢" },
  {
    value: "normal",
    label: t("priority_normal"),
    color: "#3b82f6",
    icon: "🔵",
  },
  { value: "high", label: t("priority_high"), color: "#f59e0b", icon: "🟡" },
  {
    value: "urgent",
    label: t("priority_urgent"),
    color: "#ef4444",
    icon: "🔴",
  },
];

const StatusBadge = ({ status, t }) => {
  const info =
    getStatuses(t).find((s) => s.value === status) || getStatuses(t)[0];
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: `${info.color}22`, color: info.color }}
    >
      {info.icon} {info.label}
    </span>
  );
};

const PriorityBadge = ({ priority, t }) => {
  const info =
    getPriorities(t).find((p) => p.value === priority) || getPriorities(t)[1];
  return (
    <span
      className="priority-badge"
      style={{ backgroundColor: `${info.color}22`, color: info.color }}
    >
      {info.icon} {info.label}
    </span>
  );
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const emptyLine = () => ({
  _id: uid(),
  product_id: null,
  quantity: 1,
  unit_price: 0,
  discount_percent: 0,
  tax_rate: 18,
});

function calcLine(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const sub = qty * price;
  const disc = sub * ((Number(item.discount_percent) || 0) / 100);
  const afterDisc = sub - disc;
  const tax = afterDisc * ((Number(item.tax_rate) || 0) / 100);
  return {
    subtotal: sub,
    discount: disc,
    afterDiscount: afterDisc,
    tax,
    total: afterDisc + tax,
  };
}

function formatNum(n) {
  return Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function getCustomerLabel(c) {
  return (
    c.display_name ||
    c.company_name ||
    `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
    c.code ||
    `#${c.id}`
  );
}

function progressColor(pct) {
  if (pct >= 100) return "#10b981";
  if (pct >= 50) return "#3b82f6";
  if (pct > 0) return "#f59e0b";
  return "#94a3b8";
}

const Reservations = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { registerAction, unregisterAction } = useAction();
  const { can } = usePermission();
  const navigate = useNavigate();
  const canManage = can("reservations.manage");

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [statusTab, setStatusTab] = useState("");
  const [customerFilter, setCustomerFilter] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [completePreviewModalOpen, setCompletePreviewModalOpen] =
    useState(false);
  const [completePreviewReservation, setCompletePreviewReservation] =
    useState(null);
  const [completePreviewItems, setCompletePreviewItems] = useState([]);
  const [reservationFiles, setReservationFiles] = useState([]);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState(null);
  const [showInvoiceNotification, setShowInvoiceNotification] = useState(false);
  const searchDebounceRef = useRef(null);

  const [form, setForm] = useState({
    customer_id: "",
    reservation_date: new Date().toISOString().slice(0, 16),
    expected_delivery_date: "",
    priority: "normal",
    notes: "",
    items: [emptyLine()],
  });
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const swalTheme = useMemo(() => getSwalTheme(theme), [theme]);
  const selectStyles = useMemo(() => getSelectStyles(isDark), [isDark]);

  const customerOptions = useMemo(
    () =>
      [...customers]
        .sort((a, b) =>
          getCustomerLabel(a).localeCompare(getCustomerLabel(b), "fr"),
        )
        .map((c) => ({
          value: c.id,
          label: getCustomerLabel(c),
        })),
    [customers],
  );

  const sortedCustomers = useMemo(
    () =>
      [...customers].sort((a, b) =>
        getCustomerLabel(a).localeCompare(getCustomerLabel(b), "fr"),
      ),
    [customers],
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.code})`,
        selling_price: p.selling_price,
        tax_rate: p.tax_rate ?? 18,
        unit: p.unit,
      })),
    [products],
  );

  const handleProductSelect = (idx, option) => {
    updateLine(idx, {
      product_id: option,
      unit_price: option?.selling_price ?? 0,
      tax_rate: option?.tax_rate ?? 18,
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    form.items.forEach((it) => {
      const c = calcLine(it);
      subtotal += c.subtotal;
      discount += c.discount;
      tax += c.tax;
    });
    const afterDiscount = subtotal - discount;
    const grand = afterDiscount + tax;
    return { subtotal, discount, afterDiscount, tax, grand };
  }, [form.items]);

  const loadList = useCallback(
    async (filters = appliedFilters, silent = false) => {
      if (!silent) setTableLoading(true);
      else if (!list.length) setLoading(true);
      try {
        const params = {};
        if (filters.status) params.status = filters.status;
        if (filters.reservation_number)
          params.reservation_number = filters.reservation_number;
        if (filters.customer_id) params.customer_id = filters.customer_id;
        const res = await reservationService.getAll(params);
        if (res.data?.success) {
          setList(res.data.data || []);
        } else {
          toast.error(res.data?.message || t("error_loading_data"));
        }
      } catch (e) {
        toast.error(getApiErrorMessage(e, t("error_loading_data")));
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    },
    [appliedFilters, list.length, t],
  );

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const custRes = await customerService.getAll({ limit: 9999 });
      if (custRes.data?.success) {
        setCustomers(custRes.data.data || []);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("error_loading_customers")));
    } finally {
      setLoadingCustomers(false);
    }
  }, [t]);

  const loadRef = useCallback(async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        customerService.getAll({ limit: 9999 }),
        productService.getAll({ limit: 9999, is_active: 1 }),
      ]);
      if (custRes.data?.success) setCustomers(custRes.data.data || []);
      if (prodRes.data?.success) setProducts(prodRes.data.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadRef();
  }, [loadRef]);

  useEffect(() => {
    loadList(appliedFilters);
  }, [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = useCallback(
    (patch = {}) => {
      const next = {
        status: statusTab,
        reservation_number: searchInput.trim(),
        customer_id: customerFilter?.value || "",
        ...patch,
      };
      setAppliedFilters(next);
      setCurrentPage(1);
    },
    [statusTab, searchInput, customerFilter],
  );

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      applyFilters();
    }, 450);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusTab = (status) => {
    setStatusTab(status);
    const next = {
      status,
      reservation_number: searchInput.trim(),
      customer_id: customerFilter?.value || "",
    };
    setAppliedFilters(next);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setStatusTab("");
    setCustomerFilter(null);
    setAppliedFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters = useMemo(
    () => Object.values(appliedFilters).some((v) => v !== "" && v != null),
    [appliedFilters],
  );

  const stats = useMemo(() => {
    const total = list.length;
    const pending = list.filter((r) => r.status === "pending").length;
    const active = list.filter((r) =>
      ["confirmed", "partially_delivered"].includes(r.status),
    ).length;
    const completed = list.filter((r) => r.status === "completed").length;
    const amount = list.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
    return { total, pending, active, completed, amount };
  }, [list]);

  const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return list.slice(start, start + ITEMS_PER_PAGE);
  }, [list, currentPage]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setReservationFiles([]);
    setForm({
      customer_id: "",
      reservation_date: new Date().toISOString().slice(0, 16),
      expected_delivery_date: "",
      priority: "normal",
      notes: "",
      items: [emptyLine()],
    });
    loadCustomers();
    setDetailOpen(false);
    setDeliveryModalOpen(false);
    setModalOpen(true);
  }, [loadCustomers]);

  useEffect(() => {
    if (canManage) {
      registerAction("add", openCreate);
    }
    return () => unregisterAction("add");
  }, [canManage, openCreate, registerAction, unregisterAction]);

  const openEdit = async (row) => {
    try {
      const res = await reservationService.getById(row.id);
      const o = res.data?.data;
      if (!o) throw new Error("Not found");
      setEditing(o);
      setReservationFiles([]);
      await loadCustomers();
      setForm({
        customer_id: o.customer_id ? String(o.customer_id) : "",
        reservation_date: o.reservation_date?.slice(0, 16) || "",
        expected_delivery_date: o.expected_delivery_date || "",
        priority: o.priority || "normal",
        notes: o.notes || "",
        items: (o.items || []).map((it) => ({
          _id: uid(),
          product_id: { value: it.product_id, label: it.product_name },
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_percent: it.discount_percent ?? 0,
          tax_rate: it.tax_rate ?? 18,
          delivered_quantity: it.delivered_quantity,
        })),
      });
      setModalOpen(true);
      setDetailOpen(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("error_loading_data")));
    }
  };

  const viewDetail = async (row) => {
    try {
      const res = await reservationService.getById(row.id);
      setSelected(res.data?.data);
      setDetailOpen(true);
      setActiveDropdown(null);
    } catch (e) {
      toast.error(
        getApiErrorMessage(e, t("error_loading_reservation_details")),
      );
    }
  };

  const openCompletePreview = async (reservation) => {
    if (!reservation) return;
    let res = reservation;
    try {
      toast.info("Opening preview...", { duration: 2000 });
      if (!reservation.items || reservation.items.length === 0) {
        const resp = await reservationService.getById(reservation.id);
        if (resp.data?.success) res = resp.data.data;
        else {
          toast.error(
            resp.data?.message || t("error_loading_reservation_details"),
          );
          return;
        }
      }

      const items = (res.items || []).map((item) => ({
        product_name: item.product_name || item.item_designation || "Article",
        quantity: parseFloat(item.quantity) || 0,
        delivered: parseFloat(item.delivered_quantity) || 0,
        released_quantity:
          typeof item.released_quantity !== "undefined"
            ? Number(item.released_quantity)
            : 0,
        to_release: Math.max(
          0,
          (parseFloat(item.quantity) || 0) -
            (parseFloat(item.delivered_quantity) || 0),
        ),
      }));

      setCompletePreviewReservation(res);
      setCompletePreviewItems(items);
      setCompletePreviewModalOpen(true);
      console.log("openCompletePreview -> reservation:", res);
      console.log("openCompletePreview -> items:", items);
      toast.success(
        `${t("preview_complete_by_delivered")} ${res.reservation_number} (${items.length} ${t("products_list")})`,
        { duration: 2500 },
      );
    } catch (err) {
      console.error("Erreur aperçu finalisation:", err);
      toast.error(
        err.response?.data?.message || t("error_loading_reservation_details"),
      );
    }
  };

  const buildPayload = () => {
    const items = form.items
      .filter((it) => it.product_id?.value && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id.value,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount_percent: Number(it.discount_percent) || 0,
        tax_rate: Number(it.tax_rate) ?? 18,
        delivered_quantity: Number(it.delivered_quantity) || 0,
      }));
    return {
      customer_id: Number(form.customer_id),
      reservation_date: form.reservation_date,
      expected_delivery_date: form.expected_delivery_date || null,
      priority: form.priority,
      notes: form.notes,
      items,
    };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      toast.warning(t("customer_required"));
      return;
    }
    const payload = buildPayload();
    if (!payload.items.length) {
      toast.warning(t("at_least_one_product"));
      return;
    }
    if (
      !(await confirm.save(
        editing ? t("save_changes") : t("create_reservation"),
      ))
    )
      return;

    setSubmitLoading(true);
    try {
      let res;
      if (editing) {
        res = await reservationService.update(editing.id, payload);
      } else {
        if (reservationFiles.length > 0) {
          const formData = new FormData();
          formData.append("customer_id", payload.customer_id);
          formData.append("reservation_date", payload.reservation_date);
          if (payload.expected_delivery_date) {
            formData.append(
              "expected_delivery_date",
              payload.expected_delivery_date,
            );
          }
          formData.append("priority", payload.priority);
          if (payload.notes) {
            formData.append("notes", payload.notes);
          }
          formData.append("items", JSON.stringify(payload.items));
          reservationFiles.forEach((file) => {
            if (file.file instanceof File) {
              formData.append("attachments[]", file.file);
            }
          });
          res = await reservationService.create(formData);
        } else {
          res = await reservationService.create(payload);
        }
      }
      if (res.data?.success) {
        toast.success(
          editing ? t("updated_successfully") : t("reservation_created"),
        );
        setModalOpen(false);
        setReservationFiles([]);
        loadList(appliedFilters, true);
      } else {
        toast.error(res.data?.message || t("error_saving"));
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("error_saving")));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReservationFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const sanitized = files.map((file) => ({
      id: uid(),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    setReservationFiles((prev) => [...prev, ...sanitized]);
  };

  const removeReservationFile = (id) => {
    setReservationFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const handleConfirm = async (row) => {
    const r = await Swal.fire({
      ...swalTheme,
      title: t("confirm_reservation"),
      text: row.reservation_number,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: t("confirm"),
      cancelButtonText: t("cancel"),
    });
    if (!r.isConfirmed) return;
    try {
      const res = await reservationService.confirm(row.id);
      if (res.data?.success) {
        toast.success(t("reservation_confirmed"));
        loadList(appliedFilters, true);
        if (detailOpen && selected?.id === row.id) viewDetail(row);
      } else toast.error(res.data?.message);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const openDeliveryModal = async (row) => {
    try {
      setActiveDropdown(null);
      let reservation = row;
      if (!reservation.items || reservation.items.length === 0) {
        const res = await reservationService.getById(row.id);
        if (!res.data?.success) {
          throw new Error(
            res.data?.message || t("error_loading_reservation_details"),
          );
        }
        reservation = res.data.data;
      }

      const items = (reservation.items || []).map((it) => {
        const reserved = Number(it.quantity) || 0;
        const delivered = Number(it.delivered_quantity || 0);
        const remaining = Math.max(0, reserved - delivered);
        return {
          id: it.id,
          product_name: it.product_name,
          unit: it.unit || "",
          reserved_quantity: reserved,
          delivered_quantity: delivered,
          remaining_quantity: remaining,
          to_deliver: 0,
          unit_price: Number(it.unit_price) || 0,
          total_price: Number(it.total_price) || 0,
        };
      });

      setSelected(reservation);
      setDeliveryItems(items);
      setDeliveryModalOpen(true);
      setDetailOpen(false);
    } catch (e) {
      toast.error(
        getApiErrorMessage(e, t("error_loading_reservation_details")),
      );
    }
  };

  const updateDeliveryItem = (index, value) => {
    setDeliveryItems((prev) => {
      const next = [...prev];
      const maxDeliver = next[index]?.remaining_quantity || 0;
      const wanted = Number(value) || 0;
      next[index] = {
        ...next[index],
        to_deliver: Math.min(Math.max(0, wanted), maxDeliver),
      };
      return next;
    });
  };

  const fillDeliveryQuantities = () => {
    setDeliveryItems((prev) =>
      prev.map((item) => ({
        ...item,
        to_deliver: item.remaining_quantity,
      })),
    );
  };

  const resetDeliverySelection = () => {
    setDeliveryItems((prev) =>
      prev.map((item) => ({
        ...item,
        to_deliver: 0,
      })),
    );
  };

  const deliveryRemainingTotal = deliveryItems.reduce(
    (sum, item) => sum + (item.remaining_quantity || 0),
    0,
  );
  const deliveryTotalCount = deliveryItems.reduce(
    (sum, item) => sum + (item.to_deliver || 0),
    0,
  );
  const canFillAll = deliveryItems.some(
    (item) => item.to_deliver < item.remaining_quantity,
  );
  const canResetSelection = deliveryItems.some((item) => item.to_deliver > 0);

  const generateDeliveryInvoiceText = () => {
    if (!selected) return "";
    const header = [
      `FACTURE DE LIVRAISON - ${selected.reservation_number}`,
      `Client: ${selected.customer_name || "—"}`,
      `Date: ${new Date().toLocaleString("fr-FR")}`,
      `Statut: ${selected.status}`,
      `
Articles livrés :`,
    ];

    const delivered = deliveryItems.filter((item) => item.to_deliver > 0);
    const lines = delivered.map(
      (item) =>
        `${item.product_name} — ${item.to_deliver} ${item.unit} à ${formatNum(item.unit_price)} FBu = ${formatNum(item.unit_price * item.to_deliver)} FBu`,
    );

    const total = delivered.reduce(
      (sum, item) => sum + item.unit_price * item.to_deliver,
      0,
    );

    return [
      ...header,
      ...lines,
      "",
      `Total à livrer: ${formatNum(total)} FBu`,
    ].join("\n");
  };

  const copyDeliveryInvoice = async () => {
    try {
      const text = generateDeliveryInvoiceText();
      if (!text) {
        toast.error(t("error_generating_invoice"));
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success(t("invoice_copied"));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("error_copying_invoice")));
    }
  };

  const printDeliveryInvoice = () => {
    const text = generateDeliveryInvoiceText();
    if (!text) {
      toast.error(t("error_generating_invoice"));
      return;
    }
    const html = `
      <html>
        <head>
          <title>Facture de livraison</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            pre { white-space: pre-wrap; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>Facture de livraison</h1>
          <pre>${text.replace(/\n/g, "<br/>")}</pre>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      toast.error(t("error_printing_invoice"));
    }
  };

  const submitDelivery = async () => {
    const itemsToDeliver = deliveryItems.filter((item) => item.to_deliver > 0);
    if (itemsToDeliver.length === 0) {
      toast.warning(t("select_items_to_deliver"));
      return;
    }

    if (
      itemsToDeliver.some((item) => item.to_deliver > item.remaining_quantity)
    ) {
      toast.error(t("quantity_exceeds_remaining"));
      return;
    }

    if (!(await confirm.save(t("confirm_delivery")))) return;

    setDeliverySubmitting(true);
    try {
      const payload = {
        items: itemsToDeliver.map((item) => ({
          item_id: item.id,
          quantity: item.to_deliver,
        })),
      };
      const reservationId = selected?.id;
      if (!reservationId) {
        throw new Error("Reservation ID manquant");
      }
      const res = await reservationService.deliver(reservationId, payload);
      if (res.data?.success) {
        toast.success(t("delivery_recorded"));

        // Récupérer les informations de facture si disponibles
        if (res.data?.data?.invoice) {
          const invoiceNumber = res.data.data.invoice.invoice_number;
          setCreatedInvoiceNumber(invoiceNumber);
          setShowInvoiceNotification(true);
        }

        setDeliveryModalOpen(false);
        setDeliveryItems([]);
        await loadList(appliedFilters, true);

        // Rafraîchir les détails si le modal est ouvert
        if (detailOpen && reservationId) {
          try {
            const detailRes = await reservationService.getById(reservationId);
            if (detailRes.data?.data) {
              setSelected(detailRes.data.data);
            }
          } catch (e) {
            console.error("Erreur refresh détails", e);
          }
        }
      } else {
        toast.error(res.data?.message || t("error_delivery"));
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("error_delivery")));
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!(await confirm.delete(row.reservation_number))) return;
    try {
      const res = await reservationService.delete(row.id);
      if (res.data?.success) {
        toast.success(t("reservation_deleted"));
        setDetailOpen(false);
        loadList(appliedFilters, true);
      } else toast.error(res.data?.message);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("error_deleting_reservation")));
    }
  };

  const handleCancel = async (row) => {
    const r = await Swal.fire({
      ...swalTheme,
      title: t("cancel_reservation"),
      input: "textarea",
      inputPlaceholder: t("cancellation_reason"),
      showCancelButton: true,
    });
    if (!r.isConfirmed) return;
    try {
      const res = await reservationService.update(row.id, {
        status: "cancelled",
        notes: r.value || row.notes,
      });
      if (res.data?.success) {
        toast.success(t("reservation_cancelled"));
        loadList(appliedFilters, true);
        setDetailOpen(false);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const updateLine = (idx, patch) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...f, items };
    });
  };

  const getDropdownItems = (row) => {
    const items = [
      { icon: "👁️", label: t("view_details"), onClick: () => viewDetail(row) },
    ];
    if (!canManage) return items;

    if (row.status === "pending") {
      items.push(
        { icon: "✏️", label: t("edit"), onClick: () => openEdit(row) },
        {
          icon: "✅",
          label: t("confirm_reservation"),
          onClick: () => handleConfirm(row),
        },
        { divider: true },
        {
          icon: "🗑️",
          label: t("delete"),
          onClick: () => handleDelete(row),
          danger: true,
        },
      );
    }
    if (["confirmed", "partially_delivered"].includes(row.status)) {
      items.push({
        icon: "📦",
        label: t("deliver"),
        onClick: () => openDeliveryModal(row),
      });
    }
    if (row.status === "partially_delivered") {
      items.push({
        icon: "🔎",
        label: t("preview_complete_by_delivered"),
        onClick: () => {
          toast.info("Preview button clicked", { duration: 1500 });
          openCompletePreview(row);
        },
      });
      items.push({
        icon: "✅",
        label: t("complete_by_delivered"),
        onClick: async () => {
          const confirmed = await confirm.save(
            t("confirm_complete_by_delivered"),
          );
          if (!confirmed) return;
          try {
            const res = await reservationService.completeByDelivered(row.id);
            if (res.data?.success) {
              toast.success(t("reservation_finalized_by_delivered"));
              await loadList(appliedFilters, true);
            } else {
              toast.error(
                res.data?.message || t("error_finalizing_reservation"),
              );
            }
          } catch (err) {
            toast.error(
              err.response?.data?.message || t("error_finalizing_reservation"),
            );
          }
        },
      });
    }
    if (!["completed", "cancelled"].includes(row.status)) {
      items.push({
        icon: "❌",
        label: t("cancel_reservation"),
        onClick: () => handleCancel(row),
        danger: true,
      });
    }
    return items;
  };

  const detailGrandTotal = useMemo(() => {
    if (!selected) return 0;
    return (selected.items || []).reduce(
      (s, i) => s + Number(i.total_price || 0),
      0,
    );
  }, [selected]);

  const detailProgress = useMemo(() => {
    if (!selected?.total_quantity) return 0;
    return Math.round(
      ((selected.total_delivered || 0) / selected.total_quantity) * 100,
    );
  }, [selected]);

  if (loading && !list.length) {
    return <Loader fullScreen text={t("loading_reservations")} transparent />;
  }

  const STATUS_TABS = [
    { value: "", label: t("all"), icon: "📋" },
    ...getStatuses(t).map((s) => ({
      value: s.value,
      label: s.label,
      icon: s.icon,
    })),
  ];

  return (
    <div className={`reservations-page ${isDark ? "dark" : "light"}`}>
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
          <h2>📅 {t("reservations")}</h2>
          <p>{t("reservations_page_desc")}</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-header-primary"
            onClick={openCreate}
          >
            ➕ {t("new_reservation")}
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap total">📋</div>
          <div className="stat-content">
            <span className="stat-label">{t("total")}</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap pending">⏳</div>
          <div className="stat-content">
            <span className="stat-label">{t("status_pending")}</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap active">🔄</div>
          <div className="stat-content">
            <span className="stat-label">{t("status_confirmed")}</span>
            <span className="stat-value">{stats.active}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap amount">💰</div>
          <div className="stat-content">
            <span className="stat-label">{t("total")} (FBu)</span>
            <span className="stat-value">{formatNum(stats.amount)}</span>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={t("reservation_number")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="filter-customer">
          <Select
            options={customerOptions}
            value={customerFilter}
            onChange={(v) => {
              setCustomerFilter(v);
              const next = {
                status: statusTab,
                reservation_number: searchInput.trim(),
                customer_id: v?.value || "",
              };
              setAppliedFilters(next);
              setCurrentPage(1);
            }}
            placeholder={t("all_customers")}
            isClearable
            styles={selectStyles}
          />
        </div>
        <button
          type="button"
          className="btn-filter-refresh"
          onClick={() => loadList(appliedFilters, true)}
          disabled={tableLoading}
        >
          {tableLoading ? <span className="btn-spinner-small" /> : "🔄"}{" "}
          {t("refresh")}
        </button>
      </div>

      <div className="filter-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            className={`filter-tab ${statusTab === tab.value ? "active" : ""}`}
            onClick={() => handleStatusTab(tab.value)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {hasActiveFilters && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">{t("active_filters")}:</span>
          {appliedFilters.reservation_number && (
            <span className="filter-tag">
              {t("reservation_number")}: {appliedFilters.reservation_number}
            </span>
          )}
          {appliedFilters.customer_id && (
            <span className="filter-tag">
              {t("customer")}:{" "}
              {customerOptions.find(
                (c) => c.value === Number(appliedFilters.customer_id),
              )?.label || appliedFilters.customer_id}
            </span>
          )}
          {appliedFilters.status && (
            <span className="filter-tag">
              {t("status")}: {t(`reservation_status_${appliedFilters.status}`)}
            </span>
          )}
          <button
            type="button"
            className="clear-filters-btn"
            onClick={resetFilters}
          >
            ✕ {t("clear_filters")}
          </button>
        </div>
      )}

      <div
        className={`table-container ${isDark ? "dark" : "light"} ${tableLoading ? "loading" : ""}`}
      >
        {tableLoading && (
          <div className="table-loading-overlay">
            <span className="btn-spinner" />
          </div>
        )}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("reservation_number")}</th>
                <th>{t("customer")}</th>
                <th>{t("date")}</th>
                <th>{t("expected_delivery")}</th>
                <th>{t("total")}</th>
                <th>{t("delivery_progress")}</th>
                <th>{t("status")}</th>
                <th>{t("priority")}</th>
                <th style={{ width: 70 }}>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="9">
                    <div className="empty-state">
                      <span className="empty-icon">📅</span>
                      <p>{t("no_reservations_list")}</p>
                      {canManage && (
                        <button
                          type="button"
                          className="btn-empty-action"
                          onClick={openCreate}
                        >
                          ➕ {t("new_reservation")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((row) => {
                  const pct =
                    row.total_quantity > 0
                      ? Math.round(
                          ((row.total_delivered || 0) / row.total_quantity) *
                            100,
                        )
                      : 0;
                  const initial = (row.customer_name || "?")
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="order-number">
                          {row.reservation_number}
                        </span>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <span className="customer-avatar">{initial}</span>
                          <span>{row.customer_name || "—"}</span>
                        </div>
                      </td>
                      <td className="date-cell">
                        {new Date(row.reservation_date).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </td>
                      <td className="date-cell">
                        {row.expected_delivery_date
                          ? new Date(
                              row.expected_delivery_date,
                            ).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td>
                        <strong className="amount-cell">
                          {formatNum(row.total_amount)} FBu
                        </strong>
                      </td>
                      <td>
                        <div className="reception-progress">
                          <div className="progress-header">
                            <span>
                              {formatNum(row.total_delivered)} /{" "}
                              {formatNum(row.total_quantity)}
                            </span>
                            <span className="progress-pct">{pct}%</span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${pct}%`,
                                background: progressColor(pct),
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={row.status} t={t} />
                      </td>
                      <td>
                        <PriorityBadge priority={row.priority} t={t} />
                      </td>
                      <td className="actions-cell">
                        <DropdownMenu
                          isOpen={activeDropdown === row.id}
                          onClose={() => setActiveDropdown(null)}
                          trigger={
                            <button
                              type="button"
                              className="dropdown-trigger"
                              onClick={() =>
                                setActiveDropdown(
                                  activeDropdown === row.id ? null : row.id,
                                )
                              }
                            >
                              ⋯
                            </button>
                          }
                          items={getDropdownItems(row)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {list.length > ITEMS_PER_PAGE && (
          <div className="pagination">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            <span className="page-info">
              {t("page")} {currentPage} {t("of")} {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              »
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="modal-overlay reservation-form-modal"
          onClick={() => !submitLoading && setModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-title">
                <span className="modal-icon">📅</span>
                <div>
                  <h3>
                    {editing ? t("edit_reservation") : t("new_reservation")}
                  </h3>
                  {editing && (
                    <p className="order-subtitle">
                      {t("reservation_number")}:{" "}
                      <strong>{editing.reservation_number}</strong>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !submitLoading && setModalOpen(false)}
                aria-label={t("close")}
              >
                ✕
              </button>
            </div>

            <form className="reservation-form" onSubmit={handleSave}>
              <div className="modal-body reservation-modal-body">
                <div className="form-section">
                  <h4>📋 {t("general_information")}</h4>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label
                        className="required"
                        htmlFor="reservation-customer"
                      >
                        {t("customer")}
                      </label>
                      <select
                        id="reservation-customer"
                        className="customer-select"
                        value={form.customer_id}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            customer_id: e.target.value,
                          }))
                        }
                        required
                        disabled={loadingCustomers}
                      >
                        <option value="">
                          {loadingCustomers
                            ? t("loading")
                            : t("select_customer")}
                        </option>
                        {sortedCustomers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {getCustomerLabel(c)}
                            {c.code ? ` (${c.code})` : ""}
                          </option>
                        ))}
                      </select>
                      {!loadingCustomers && sortedCustomers.length === 0 && (
                        <small className="field-hint warning">
                          {t("no_customers")}
                        </small>
                      )}
                    </div>
                    <div className="form-group">
                      <label>📅 {t("reservation_date")}</label>
                      <input
                        type="datetime-local"
                        value={form.reservation_date}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            reservation_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>🚚 {t("expected_delivery")}</label>
                      <input
                        type="date"
                        value={form.expected_delivery_date}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            expected_delivery_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>⚡ {t("priority")}</label>
                      <select
                        value={form.priority}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, priority: e.target.value }))
                        }
                      >
                        {getPriorities(t).map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.icon} {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section items-section">
                  <div className="items-header">
                    <h4>📦 {t("products_list")}</h4>
                    <button
                      type="button"
                      className="btn-add-item"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          items: [...f.items, emptyLine()],
                        }))
                      }
                    >
                      ➕ {t("add_product")}
                    </button>
                  </div>

                  <div className="items-and-totals">
                    <div className="items-table-wrapper">
                      <div className="items-table">
                        <table>
                          <thead>
                            <tr>
                              <th
                                className="required"
                                style={{ minWidth: 220 }}
                              >
                                {t("product")}
                              </th>
                              <th style={{ width: 90 }}>{t("quantity")}</th>
                              <th style={{ width: 110 }}>{t("unit_price")}</th>
                              <th style={{ width: 80 }}>{t("discount")} %</th>
                              <th style={{ width: 70 }}>{t("vat")} %</th>
                              <th style={{ width: 100 }}>{t("subtotal")}</th>
                              <th style={{ width: 90 }}>{t("tax_amount")}</th>
                              <th style={{ width: 110 }}>{t("line_total")}</th>
                              <th style={{ width: 44 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {form.items.map((item, idx) => {
                              const c = calcLine(item);
                              return (
                                <tr key={item._id}>
                                  <td className="product-cell">
                                    <Select
                                      options={productOptions}
                                      value={item.product_id}
                                      onChange={(v) =>
                                        handleProductSelect(idx, v)
                                      }
                                      className="select-product"
                                      classNamePrefix="select"
                                      placeholder={t("select_product")}
                                      isClearable
                                      styles={{
                                        ...selectStyles,
                                        menuPortal: (b) => ({
                                          ...b,
                                          zIndex: 10001,
                                        }),
                                      }}
                                      menuPortalTarget={document.body}
                                      menuPosition="fixed"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      className="quantity-input"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          quantity: e.target.value,
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      className="cost-input"
                                      value={item.unit_price}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          unit_price: e.target.value,
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.5"
                                      className="cost-input"
                                      value={item.discount_percent}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          discount_percent: e.target.value,
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      className="cost-input"
                                      value={item.tax_rate}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          tax_rate: e.target.value,
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="num-cell">
                                    {formatNum(c.subtotal)}
                                  </td>
                                  <td className="num-cell">
                                    {formatNum(c.tax)}
                                  </td>
                                  <td className="num-cell line-total-cell">
                                    <strong>{formatNum(c.total)}</strong>
                                  </td>
                                  <td className="actions-col">
                                    <button
                                      type="button"
                                      className="btn-remove-item"
                                      disabled={form.items.length === 1}
                                      onClick={() =>
                                        setForm((f) => ({
                                          ...f,
                                          items: f.items.filter(
                                            (_, i) => i !== idx,
                                          ),
                                        }))
                                      }
                                      title={t("delete")}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="order-totals-panel">
                      <h5>{t("grand_total_ttc")}</h5>
                      <div className="totals-row">
                        <span>{t("subtotal_ht")}</span>
                        <span>{formatNum(totals.subtotal)} FBu</span>
                      </div>
                      <div className="totals-row discount">
                        <span>{t("total_discount")}</span>
                        <span>- {formatNum(totals.discount)} FBu</span>
                      </div>
                      <div className="totals-row">
                        <span>{t("amount_after_discount")}</span>
                        <span>{formatNum(totals.afterDiscount)} FBu</span>
                      </div>
                      <div className="totals-row">
                        <span>{t("total_tax")}</span>
                        <span>{formatNum(totals.tax)} FBu</span>
                      </div>
                      <div className="totals-row grand">
                        <span>{t("grand_total_ttc")}</span>
                        <strong>{formatNum(totals.grand)} FBu</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section attachments-section">
                  <h4>📎 {t("attachments")}</h4>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      onChange={handleReservationFileUpload}
                      multiple
                      className="file-input"
                    />
                    <button
                      type="button"
                      className="btn-upload"
                      onClick={() =>
                        document.querySelector(".file-input").click()
                      }
                    >
                      📎 {t("add_files")}
                    </button>
                    <div className="file-list">
                      {reservationFiles.map((file) => (
                        <div key={file.id} className="file-item">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">
                            {(file.size / 1024).toFixed(2)} KB
                          </span>
                          <button
                            type="button"
                            className="btn-remove-file"
                            onClick={() => removeReservationFile(file.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-section notes-section">
                  <h4>📝 {t("notes")}</h4>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder={t("notes_placeholder")}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalOpen(false)}
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
                    <span className="btn-spinner" />
                  ) : editing ? (
                    `💾 ${t("save")}`
                  ) : (
                    `➕ ${t("create")}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailOpen && selected && (
        <div
          className="modal-overlay reservation-detail-modal"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-title">
                <span className="modal-icon">📋</span>
                <div>
                  <h3>{selected.reservation_number}</h3>
                  <p className="order-subtitle">{selected.customer_name}</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetailOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body reservation-modal-body">
              <div className="summary-stats">
                <div className="stat-card mini">
                  <div className="stat-icon-wrap">📊</div>
                  <div className="stat-content">
                    <span className="stat-label">{t("status")}</span>
                    <StatusBadge status={selected.status} t={t} />
                  </div>
                </div>
                <div className="stat-card mini">
                  <div className="stat-icon-wrap">📅</div>
                  <div className="stat-content">
                    <span className="stat-label">{t("reservation_date")}</span>
                    <span className="stat-value-sm">
                      {new Date(selected.reservation_date).toLocaleString(
                        "fr-FR",
                      )}
                    </span>
                  </div>
                </div>
                <div className="stat-card mini">
                  <div className="stat-icon-wrap">🚚</div>
                  <div className="stat-content">
                    <span className="stat-label">{t("expected_delivery")}</span>
                    <span className="stat-value-sm">
                      {selected.expected_delivery_date
                        ? new Date(
                            selected.expected_delivery_date,
                          ).toLocaleDateString("fr-FR")
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="stat-card mini">
                  <div className="stat-icon-wrap">⚡</div>
                  <div className="stat-content">
                    <span className="stat-label">{t("priority")}</span>
                    <PriorityBadge priority={selected.priority} t={t} />
                  </div>
                </div>
              </div>

              <div className="detail-delivery-block">
                <div className="detail-delivery-header">
                  <span>{t("delivery_progress")}</span>
                  <strong>{detailProgress}%</strong>
                </div>
                <div className="progress-bar large">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${detailProgress}%`,
                      background: progressColor(detailProgress),
                    }}
                  />
                </div>
                <small>
                  {formatNum(selected.total_delivered)} /{" "}
                  {formatNum(selected.total_quantity)} {t("delivered")}
                </small>
              </div>

              <div className="detail-section">
                <h4>
                  <span className="section-icon">📦</span> {t("products_list")}
                </h4>
                <div className="items-table-wrapper">
                  <table className="data-table detail-items-table">
                    <thead>
                      <tr>
                        <th>{t("product")}</th>
                        <th>{t("quantity")}</th>
                        <th>{t("delivered")}</th>
                        <th>{t("released_quantity")}</th>
                        <th>{t("unit_price")}</th>
                        <th>{t("line_total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.items || []).map((it) => (
                        <tr key={it.id}>
                          <td>
                            <strong>{it.product_name}</strong>
                            {it.product_code && (
                              <small className="product-code">
                                {it.product_code}
                              </small>
                            )}
                          </td>
                          <td>
                            {it.quantity} {it.unit}
                          </td>
                          <td>
                            <span
                              className={
                                Number(it.delivered_quantity) >=
                                Number(it.quantity)
                                  ? "text-success"
                                  : "text-warning"
                              }
                            >
                              {it.delivered_quantity}
                            </span>
                          </td>
                          <td>
                            {typeof it.released_quantity !== "undefined"
                              ? it.released_quantity
                              : 0}
                          </td>
                          <td>{formatNum(it.unit_price)}</td>
                          <td>
                            <strong>{formatNum(it.total_price)} FBu</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan="4">{t("grand_total_ttc")}</td>
                        <td>
                          <strong>{formatNum(detailGrandTotal)} FBu</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selected.notes && (
                <div className="detail-notes">
                  <strong>{t("notes")}</strong>
                  <p>{selected.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer detail-footer">
              {canManage && selected.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleConfirm(selected)}
                  >
                    ✅ {t("confirm_reservation")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setDetailOpen(false);
                      openEdit(selected);
                    }}
                  >
                    ✏️ {t("edit")}
                  </button>
                </>
              )}
              {selected?.status === "partially_delivered" && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openCompletePreview(selected)}
                  >
                    🔎 {t("preview_complete_by_delivered")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      const confirmed = await confirm.save(
                        t("confirm_complete_by_delivered"),
                      );
                      if (!confirmed) return;
                      try {
                        const res =
                          await reservationService.completeByDelivered(
                            selected.id,
                          );
                        if (res.data?.success) {
                          toast.success(
                            t("reservation_finalized_by_delivered"),
                          );
                          await loadList(appliedFilters, true);
                          setDetailOpen(false);
                        } else {
                          toast.error(
                            res.data?.message ||
                              t("error_finalizing_reservation"),
                          );
                        }
                      } catch (err) {
                        toast.error(
                          err.response?.data?.message ||
                            t("error_finalizing_reservation"),
                        );
                      }
                    }}
                  >
                    ✅ {t("complete_by_delivered")}
                  </button>
                </>
              )}
              {canManage &&
                ["confirmed", "partially_delivered"].includes(
                  selected.status,
                ) && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => openDeliveryModal(selected)}
                  >
                    📦 {t("deliver")}
                  </button>
                )}
              {canManage &&
                !["completed", "cancelled"].includes(selected.status) && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleCancel(selected)}
                  >
                    {t("cancel_reservation")}
                  </button>
                )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDetailOpen(false)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {completePreviewModalOpen && completePreviewReservation && (
        <div
          className="complete-preview-modal-overlay"
          onClick={() => setCompletePreviewModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">🔎</span>
              <h3>
                {t("preview_complete_by_delivered")} -{" "}
                {completePreviewReservation.reservation_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setCompletePreviewModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("product")}</th>
                      <th>{t("quantity")}</th>
                      <th>{t("already_delivered")}</th>
                      <th>{t("released_quantity")}</th>
                      <th>{t("to_release")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completePreviewItems.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.product_name}</td>
                        <td>{it.quantity}</td>
                        <td>{it.delivered}</td>
                        <td>{it.released_quantity || 0}</td>
                        <td>{it.to_release}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className="total-label">
                        {t("total")}
                      </td>
                      <td>
                        {completePreviewItems.reduce(
                          (s, i) => s + i.to_release,
                          0,
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setCompletePreviewModalOpen(false)}
              >
                {t("close")}
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  const confirmed = await confirm.save(
                    t("confirm_complete_by_delivered"),
                  );
                  if (!confirmed) return;
                  try {
                    const res = await reservationService.completeByDelivered(
                      completePreviewReservation.id,
                    );
                    if (res.data?.success) {
                      toast.success(t("reservation_finalized_by_delivered"));
                      await loadList(appliedFilters, true);
                      setCompletePreviewModalOpen(false);
                      setDetailOpen(false);
                    } else {
                      toast.error(
                        res.data?.message || t("error_finalizing_reservation"),
                      );
                    }
                  } catch (err) {
                    toast.error(
                      err.response?.data?.message ||
                        t("error_finalizing_reservation"),
                    );
                  }
                }}
              >
                ✅ {t("complete_by_delivered")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryModalOpen && selected && (
        <div
          className="modal-overlay reservation-delivery-modal"
          onClick={() => setDeliveryModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-title">
                <span className="modal-icon">🚚</span>
                <div>
                  <h3>
                    {t("delivery")} - {selected.reservation_number}
                  </h3>
                  <p className="order-subtitle">{selected.customer_name}</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeliveryModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body reservation-modal-body">
              <div className="delivery-tools">
                <div className="delivery-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fillDeliveryQuantities}
                    disabled={!canFillAll}
                  >
                    {t("fill_remaining")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetDeliverySelection}
                    disabled={!canResetSelection}
                  >
                    {t("reset_selection")}
                  </button>
                </div>
                <div className="delivery-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={copyDeliveryInvoice}
                  >
                    📋 {t("copy")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={printDeliveryInvoice}
                  >
                    🖨️ {t("print")}
                  </button>
                </div>
              </div>
              <div className="delivery-summary">
                <span>
                  {t("total_items")}: {deliveryItems.length}
                </span>
                <span>
                  {t("total_remaining")}: {deliveryRemainingTotal}
                </span>
                <span>
                  {t("to_deliver")}: {deliveryTotalCount}
                </span>
              </div>
              <div className="detail-section">
                <h4>{t("products_list")}</h4>
                <div className="items-table-wrapper">
                  <table className="data-table detail-items-table">
                    <thead>
                      <tr>
                        <th>{t("product")}</th>
                        <th>{t("reserved")}</th>
                        <th>{t("already_delivered")}</th>
                        <th>{t("remaining")}</th>
                        <th>{t("to_deliver")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`delivery-row ${
                            item.remaining_quantity === 0
                              ? "completed"
                              : item.to_deliver > 0
                                ? "selected"
                                : ""
                          }`}
                        >
                          <td>{item.product_name}</td>
                          <td>
                            {item.reserved_quantity} {item.unit}
                          </td>
                          <td>
                            {item.delivered_quantity} {item.unit}
                          </td>
                          <td>
                            {item.remaining_quantity} {item.unit}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={item.remaining_quantity}
                              step="1"
                              value={item.to_deliver}
                              disabled={item.remaining_quantity === 0}
                              onChange={(e) =>
                                updateDeliveryItem(idx, e.target.value)
                              }
                              className="delivery-input"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer detail-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeliveryModalOpen(false)}
                disabled={deliverySubmitting}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitDelivery}
                disabled={
                  deliverySubmitting ||
                  deliveryItems.every((item) => item.to_deliver === 0)
                }
              >
                {deliverySubmitting
                  ? t("processing")
                  : `🚚 ${t("confirm_delivery")}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceNotification && createdInvoiceNumber && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#10b981",
            color: "white",
            padding: "12px 16px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: "600" }}>
              ✅ {t("invoice_created")}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.95, marginTop: "4px" }}>
              {createdInvoiceNumber}
            </div>
          </div>
          <button
            onClick={() => {
              navigate(`/invoices?search=${createdInvoiceNumber}`);
              setShowInvoiceNotification(false);
              setCreatedInvoiceNumber(null);
            }}
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              whiteSpace: "nowrap",
              transition: "background 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
            }}
          >
            👁️ {t("view")}
          </button>
          <button
            onClick={() => {
              setShowInvoiceNotification(false);
              setCreatedInvoiceNumber(null);
            }}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              minWidth: "32px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.reservations-page{ 
          padding: 24px 32px;
          min-height: 100vh;
          background: var(--bg-main);
        }

        .reservations-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .reservations-page .page-header h2 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 6px;
          color: var(--text-primary);
        }

        .reservations-page .page-header p {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }

        .reservations-page .btn-header-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
        }

        .reservations-page .btn-header-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.45);
        }

        .reservations-page .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .reservations-page .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .reservations-page .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .reservations-page .stat-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .reservations-page .stat-icon-wrap.total {
          background: rgba(102, 126, 234, 0.15);
        }
        .reservations-page .stat-icon-wrap.pending {
          background: rgba(245, 158, 11, 0.15);
        }
        .reservations-page .stat-icon-wrap.active {
          background: rgba(59, 130, 246, 0.15);
        }
        .reservations-page .stat-icon-wrap.amount {
          background: rgba(16, 185, 129, 0.15);
        }

        .reservations-page .stat-label {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }

        .reservations-page .stat-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .reservations-page .stat-value-sm {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .reservations-page .filters-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .reservations-page .search-box {
          flex: 1;
          min-width: 220px;
          position: relative;
        }

        .reservations-page .search-box input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 14px;
        }

        .reservations-page .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.6;
        }

        .reservations-page .filter-customer {
          min-width: 240px;
          flex: 1;
        }

        .reservations-page .btn-filter-refresh {
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .reservations-page .btn-filter-refresh:hover:not(:disabled) {
          border-color: #667eea;
          color: #667eea;
        }

        .reservations-page .filter-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
        }

        .reservations-page .filter-tab {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reservations-page .filter-tab:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .reservations-page .filter-tab.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-color: transparent;
          color: white;
        }

        .reservations-page .active-filters-info {
          background: rgba(102, 126, 234, 0.1);
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

        .reservations-page .filter-tag {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }

        .reservations-page .clear-filters-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 12px;
          margin-left: auto;
        }

        .reservations-page .table-container {
          position: relative;
          border-radius: 20px;
          padding: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }

        .reservations-page .table-container.loading {
          opacity: 0.85;
        }

        .reservations-page .table-loading-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
        }

        .reservations-page .table-responsive {
          overflow-x: auto;
          max-height: 560px;
          overflow-y: auto;
        }

        .reservations-page .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .reservations-page .data-table th {
          padding: 14px 16px;
          text-align: left;
          font-weight: 600;
          background: var(--bg-header, var(--bg-main));
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .reservations-page .data-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--text-primary);
        }

        .reservations-page .data-table tbody tr:hover {
          background: var(--bg-main);
        }

        .reservations-page .order-number {
          font-family: ui-monospace, monospace;
          font-weight: 600;
          color: #667eea;
        }

        .reservations-page .customer-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .reservations-page .customer-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .reservations-page .amount-cell {
          color: #10b981;
        }

        .reservations-page .date-cell {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .reservations-page .reception-progress {
          min-width: 120px;
        }

        .reservations-page .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 4px;
          color: var(--text-secondary);
        }

        .reservations-page .progress-pct {
          font-weight: 600;
          color: var(--text-primary);
        }

        .reservations-page .progress-bar {
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .reservations-page .progress-bar.large {
          height: 10px;
          border-radius: 5px;
          margin: 8px 0;
        }

        .reservations-page .progress-fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.35s ease;
        }

        .reservations-page .status-badge,
        .reservations-page .priority-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .reservations-page .dropdown-trigger {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--bg-main);
          border: 1px solid var(--border);
          cursor: pointer;
          font-size: 18px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .reservations-page .dropdown-trigger:hover {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }

        .reservations-page .empty-state {
          padding: 48px 24px;
          text-align: center;
        }

        .reservations-page .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .reservations-page .empty-state p {
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .reservations-page .btn-empty-action {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .reservations-page .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .reservations-page .pagination button {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-main);
          color: var(--text-primary);
          cursor: pointer;
        }

        .reservations-page .pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .reservations-page .pagination button:not(:disabled):hover {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }

        .reservations-page .page-info {
          font-size: 13px;
          color: var(--text-secondary);
          padding: 0 12px;
        }

        .reservations-page .detail-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 16px;
          color: var(--text-primary);
        }

        /* ——— Modal formulaire réservation ——— */
        .reservation-form-modal,
        .reservation-detail-modal,
        .reservation-delivery-modal {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: res-modal-overlay 0.25s ease;
        }

        @keyframes res-modal-overlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes res-modal-scale {
          from {
            transform: translateY(-12px) scale(0.98);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .reservation-form-modal .modal-container-large,
        .reservation-detail-modal .modal-container-large,
        .reservation-delivery-modal .modal-container-large {
          animation: res-modal-scale 0.25s ease;
          background: var(--bg-card);
          border-radius: 20px;
          width: 100%;
          max-width: 1200px;
          max-height: 92vh;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .reservation-form-modal .modal-header {
          padding: 18px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .reservation-form-modal .modal-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .reservation-form-modal .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .reservation-form-modal .order-subtitle {
          font-size: 12px;
          opacity: 0.9;
          margin: 4px 0 0;
        }

        .reservation-form-modal .modal-icon {
          font-size: 28px;
        }

        .reservation-form-modal .modal-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .reservation-form-modal .modal-close:hover {
          background: rgba(255, 255, 255, 0.35);
          transform: rotate(90deg);
        }

        .reservation-form-modal .reservation-form {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .reservation-form-modal .reservation-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }

        .reservation-form-modal .modal-footer {
          padding: 14px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-shrink: 0;
          background: var(--bg-card);
        }

        .reservation-delivery-modal .modal-header {
          padding: 18px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .reservation-delivery-modal .modal-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .reservation-delivery-modal .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .reservation-delivery-modal .order-subtitle {
          font-size: 12px;
          opacity: 0.9;
          margin: 4px 0 0;
        }

        .reservation-delivery-modal .modal-icon {
          font-size: 28px;
        }

        .reservation-delivery-modal .modal-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .reservation-delivery-modal .modal-close:hover {
          background: rgba(255, 255, 255, 0.35);
          transform: rotate(90deg);
        }

        .reservation-delivery-modal .reservation-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }

        .reservation-delivery-modal .modal-footer {
          padding: 14px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-shrink: 0;
          background: var(--bg-card);
        }

        .reservation-delivery-modal .delivery-tools {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }

        .reservation-delivery-modal .delivery-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .reservation-delivery-modal .delivery-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-main);
          color: var(--text-secondary);
          margin-bottom: 18px;
          font-size: 14px;
        }

        .reservation-delivery-modal .delivery-summary span {
          min-width: 130px;
          font-weight: 500;
        }

        .reservation-delivery-modal .items-table-wrapper {
          max-height: 430px;
        }

        .reservation-delivery-modal .delivery-input {
          width: 90px;
          min-width: 90px;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-main);
          color: var(--text-primary);
          text-align: right;
        }

        .reservation-delivery-modal .delivery-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: var(--bg-card);
        }

        .reservation-delivery-modal .delivery-row.completed {
          opacity: 0.6;
        }

        .reservation-delivery-modal .delivery-row.selected {
          background: rgba(102, 126, 234, 0.06);
        }

        .reservation-form-modal .form-section {
          margin-bottom: 20px;
          padding: 16px 20px;
          background: var(--bg-main);
          border-radius: 14px;
          border: 1px solid var(--border);
        }

        .reservation-form-modal .form-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #667eea;
          color: var(--text-primary);
        }

        .reservation-form-modal .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .reservation-form-modal .form-group.full-width {
          grid-column: 1 / -1;
        }

        .reservation-form-modal .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 13px;
          color: var(--text-primary);
        }

        .reservation-form-modal .form-group input,
        .reservation-form-modal .form-group select,
        .reservation-form-modal .customer-select,
        .reservation-form-modal .form-section textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .reservation-form-modal .customer-select {
          cursor: pointer;
          appearance: auto;
          min-height: 42px;
          padding-right: 36px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }

        .reservation-form-modal .customer-select:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .reservation-form-modal .field-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .reservation-form-modal .field-hint.warning {
          color: #f59e0b;
        }

        .reservation-form-modal .form-group input:focus,
        .reservation-form-modal .form-group select:focus,
        .reservation-form-modal .customer-select:focus,
        .reservation-form-modal .form-section textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
        }

        .reservation-form-modal .required::after {
          content: ' *';
          color: #dc2626;
        }

        .reservation-form-modal .items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .reservation-form-modal .items-header h4 {
          margin: 0;
          border: none;
          padding: 0;
        }

        .reservation-form-modal .btn-add-item {
          padding: 8px 14px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .reservation-form-modal .btn-add-item:hover {
          background: #5a67d8;
          transform: translateY(-1px);
        }

        .reservation-form-modal .items-and-totals {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          align-items: start;
        }

        .reservation-form-modal .items-table-wrapper {
          overflow-x: auto;
          max-height: 320px;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg-card);
        }

        .reservation-form-modal .items-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .reservation-form-modal .items-table th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          background: var(--bg-header, var(--bg-main));
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .reservation-form-modal .items-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--text-primary);
        }

        .reservation-form-modal .product-cell {
          min-width: 200px;
        }

        .reservation-form-modal .select-product {
          min-width: 180px;
        }

        .reservation-form-modal .quantity-input {
          width: 72px;
          text-align: center;
          font-weight: 600;
        }

        .reservation-form-modal .cost-input {
          width: 90px;
          text-align: right;
        }

        .reservation-form-modal .quantity-input,
        .reservation-form-modal .cost-input {
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-main);
          color: var(--text-primary);
        }

        .reservation-form-modal .num-cell {
          text-align: right;
          white-space: nowrap;
          font-size: 13px;
        }

        .reservation-form-modal .line-total-cell {
          color: #667eea;
          font-weight: 600;
        }

        .reservation-form-modal .actions-col {
          text-align: center;
        }

        .reservation-form-modal .btn-remove-item {
          padding: 6px 8px;
          background: rgba(220, 38, 38, 0.1);
          color: #dc2626;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .reservation-form-modal .btn-remove-item:hover:not(:disabled) {
          background: #dc2626;
          color: white;
        }

        .reservation-form-modal .btn-remove-item:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .reservation-form-modal .order-totals-panel {
          padding: 16px 18px;
          border-radius: 14px;
          background: ${isDark ? "#0f172a" : "linear-gradient(145deg, #f8fafc, #eef2ff)"};
          border: 1px solid ${isDark ? "#334155" : "#c7d2fe"};
          position: sticky;
          top: 0;
        }

        .reservation-form-modal .order-totals-panel h5 {
          margin: 0 0 12px;
          font-size: 13px;
          font-weight: 600;
          color: #667eea;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .reservation-form-modal .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 7px 0;
          font-size: 13px;
          color: var(--text-secondary);
          border-bottom: 1px dashed ${isDark ? "#334155" : "#e2e8f0"};
        }

        .reservation-form-modal .totals-row.discount span:last-child {
          color: #ef4444;
        }

        .reservation-form-modal .totals-row.grand {
          border-bottom: none;
          margin-top: 8px;
          padding-top: 10px;
          font-size: 15px;
          color: var(--text-primary);
        }

        .reservation-form-modal .totals-row.grand strong {
          color: #667eea;
          font-size: 17px;
        }

        .reservation-form-modal .notes-section textarea {
          resize: vertical;
          min-height: 80px;
        }

        .reservation-form-modal .btn-primary {
          padding: 10px 22px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .reservation-form-modal .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
        }

        .reservation-form-modal .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .reservation-form-modal .btn-secondary {
          padding: 10px 22px;
          background: var(--bg-main);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .reservation-form-modal .btn-secondary:hover:not(:disabled) {
          border-color: #667eea;
          color: #667eea;
        }

        .reservation-form-modal .btn-spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid white;
          border-top-color: transparent;
          border-radius: 50%;
          animation: res-spin 0.6s linear infinite;
        }

        .reservation-detail-modal {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .reservation-detail-modal .modal-container-large {
          background: var(--bg-card);
          border-radius: 20px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .reservation-detail-modal .modal-header {
          padding: 18px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .reservation-detail-modal .modal-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .reservation-detail-modal .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .reservation-detail-modal .order-subtitle {
          margin: 4px 0 0;
          font-size: 13px;
          opacity: 0.9;
        }

        .reservation-detail-modal .modal-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 18px;
        }

        .reservation-detail-modal .reservation-modal-body {
          padding: 20px 24px;
          overflow-y: auto;
          flex: 1;
        }

        .reservation-detail-modal .modal-footer {
          padding: 14px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          background: var(--bg-card);
        }

        .reservation-detail-modal .btn-primary,
        .reservation-detail-modal .btn-secondary,
        .reservation-detail-modal .btn-danger {
          padding: 10px 18px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          border: none;
        }

        .reservation-detail-modal .btn-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .reservation-detail-modal .btn-secondary {
          background: var(--bg-main);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }

        .reservation-detail-modal .btn-danger {
          background: #ef4444;
          color: white;
        }

        .reservations-page .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .reservations-page .stat-card.mini {
          padding: 14px;
          flex-direction: column;
          align-items: flex-start;
        }

        .reservations-page .detail-delivery-block {
          padding: 16px;
          background: var(--bg-main);
          border-radius: 12px;
          border: 1px solid var(--border);
          margin-bottom: 20px;
        }

        .reservations-page .detail-delivery-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .reservations-page .detail-notes {
          margin-top: 16px;
          padding: 14px;
          background: var(--bg-main);
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        .reservations-page .detail-notes p {
          margin: 8px 0 0;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .reservations-page .product-code {
          display: block;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .reservations-page .text-success {
          color: #10b981;
          font-weight: 600;
        }

        .reservations-page .text-warning {
          color: #f59e0b;
          font-weight: 600;
        }

        .reservations-page .total-row td {
          font-weight: 600;
          background: var(--bg-main);
        }

        .reservations-page .btn-danger {
          background: #ef4444;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
        }

        .reservations-page .detail-footer {
          flex-wrap: wrap;
          gap: 8px;
        }

        .reservations-page .reservation-modal-body {
          max-height: calc(90vh - 140px);
          overflow-y: auto;
        }

        .reservations-page .btn-spinner-small {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: res-spin 0.6s linear infinite;
        }

        @keyframes res-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 992px) {
          .reservation-form-modal .items-and-totals {
            grid-template-columns: 1fr;
          }
          .reservation-form-modal .order-totals-panel {
            position: static;
          }
        }

        @media (max-width: 768px) {
          .reservations-page {
            padding: 16px;
          }
          .reservations-page .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
          .reservations-page .filter-customer {
            min-width: 100%;
          }
          .reservation-form-modal {
            padding: 8px;
          }
          .reservation-form-modal .modal-container-large {
            max-height: 96vh;
            border-radius: 16px;
          }
          .reservation-form-modal .form-grid {
            grid-template-columns: 1fr;
          }
          .reservation-form-modal .form-group.full-width {
            grid-column: 1;
          }
        }

        .complete-preview-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeInOverlay 0.3s ease;
          backdrop-filter: blur(2px);
        }

        @keyframes fadeInOverlay {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .complete-preview-modal-overlay .modal-container {
          background: var(--bg-main);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          max-width: 700px;
          width: 90%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .complete-preview-modal-overlay .modal-container.dark {
          background: #2a2a2a;
          border-color: #444;
        }

        .complete-preview-modal-overlay .modal-container.light {
          background: #ffffff;
          border-color: #e0e0e0;
        }

        .complete-preview-modal-overlay .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .complete-preview-modal-overlay .modal-header .modal-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .complete-preview-modal-overlay .modal-header h3 {
          margin: 0;
          flex: 1;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .complete-preview-modal-overlay .modal-header .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .complete-preview-modal-overlay .modal-header .modal-close:hover {
          background: var(--border);
          color: var(--text-primary);
        }

        .complete-preview-modal-overlay .modal-body {
          padding: 20px 24px;
          flex: 1;
          overflow-y: auto;
        }

        .complete-preview-modal-overlay .modal-body .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        .complete-preview-modal-overlay .modal-body .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .complete-preview-modal-overlay .modal-body .data-table thead th {
          background: var(--border);
          color: var(--text-primary);
          padding: 12px;
          text-align: left;
          font-weight: 600;
          border: 1px solid var(--border);
        }

        .complete-preview-modal-overlay .modal-body .data-table tbody td {
          padding: 12px;
          border: 1px solid var(--border);
          color: var(--text-primary);
        }

        .complete-preview-modal-overlay .modal-body .data-table tbody tr:hover {
          background: var(--border);
          opacity: 0.5;
        }

        .complete-preview-modal-overlay .modal-body .data-table tfoot tr {
          background: var(--border);
          font-weight: 600;
        }

        .complete-preview-modal-overlay .modal-body .data-table tfoot td {
          padding: 12px;
          border: 1px solid var(--border);
          color: var(--text-primary);
        }

        .complete-preview-modal-overlay .modal-body .total-label {
          text-align: right;
        }

        .complete-preview-modal-overlay .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          background: var(--bg-secondary, rgba(0,0,0,0.02));
        }

        .complete-preview-modal-overlay .modal-footer button {
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .complete-preview-modal-overlay .modal-footer .btn-primary {
          background: var(--primary, #4CAF50);
          color: white;
        }

        .complete-preview-modal-overlay .modal-footer .btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .complete-preview-modal-overlay .modal-footer .btn-secondary {
          background: var(--border);
          color: var(--text-primary);
        }

        .complete-preview-modal-overlay .modal-footer .btn-secondary:hover {
          opacity: 0.8;
        }

        @media (max-width: 600px) {
          .complete-preview-modal-overlay .modal-container {
            width: 95%;
            max-height: 90vh;
          }

          .complete-preview-modal-overlay .modal-header {
            padding: 16px;
            flex-wrap: wrap;
          }

          .complete-preview-modal-overlay .modal-header h3 {
            font-size: 16px;
            width: 100%;
            order: 2;
          }

          .complete-preview-modal-overlay .modal-body {
            padding: 16px;
          }

          .complete-preview-modal-overlay .modal-body .data-table {
            font-size: 12px;
          }

          .complete-preview-modal-overlay .modal-body .data-table thead th,
          .complete-preview-modal-overlay .modal-body .data-table tbody td,
          .complete-preview-modal-overlay .modal-body .data-table tfoot td {
            padding: 8px;
          }

          .complete-preview-modal-overlay .modal-footer {
            padding: 12px 16px;
            flex-direction: column;
          }

          .complete-preview-modal-overlay .modal-footer button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Reservations;
