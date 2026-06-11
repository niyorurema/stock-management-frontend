// frontend/src/pages/Stock.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Toaster, toast } from "react-hot-toast";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import Select from "react-select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, subMonths } from "date-fns";
import {
  stockService,
  productService,
  userService,
  customerService,
  reservationService,
} from "../services/apiService";
import { confirm } from "../services/notificationService";
import { useLanguage } from "../contexts/LanguageContext";
import { useAction } from "../contexts/ActionContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";

// Générer un ID unique
const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const Stock = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const fileInputRef = useRef(null);
  const isDark = theme === "dark";

  // ========== ÉTATS PRINCIPAUX ==========
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [summarySearch, setSummarySearch] = useState("");
  const [valueSummarySearch, setValueSummarySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedMovements, setSelectedMovements] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);

  const filteredStockSummary = stockSummary.filter((item) => {
    const search = summarySearch.trim().toLowerCase();
    if (!search) return true;
    const name = (item.name || "").toString().toLowerCase();
    const code = (item.code || item.product_code || item.sku || "")
      .toString()
      .toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  const filteredStockValueSummary = stockSummary.filter((item) => {
    const search = valueSummarySearch.trim().toLowerCase();
    if (!search) return true;
    const name = (item.product_name || item.name || "")
      .toString()
      .toLowerCase();
    const code = (item.code || item.product_code || item.sku || "")
      .toString()
      .toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  // États des modaux
  const [modalOpen, setModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);

  // États pour les améliorations
  const [movementDetailModalOpen, setMovementDetailModalOpen] = useState(false);
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [stockValueSummary, setStockValueSummary] = useState([]);
  const [warehouseStockData, setWarehouseStockData] = useState([]);
  const [chartPeriod, setChartPeriod] = useState("week");

  // États des filtres
  const [filters, setFilters] = useState({
    product_id: null,
    movement_type: "",
    warehouse_id: null,
    movement_number: "",
    date_from: "",
    date_to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [movementTab, setMovementTab] = useState("all");

  // États pour mouvement multi-produits
  const [movementItems, setMovementItems] = useState([
    {
      id: generateUniqueId(),
      product_id: null,
      quantity: 0,
      unit_cost: 0,
      total: 0,
      product_name: "",
      available_stock: 0,
    },
  ]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [formData, setFormData] = useState({
    movement_type: "EN",
    warehouse_id: null,
    description: "",
    movement_date: new Date().toISOString().slice(0, 16),
    reference: "",
    reference_doc: "",
  });

  // États pour transfert multi-produits
  const [transferItems, setTransferItems] = useState([
    {
      id: generateUniqueId(),
      product_id: null,
      quantity: 0,
      available_stock: 0,
      product_name: "",
      unit: "",
      error: "",
    },
  ]);
  const [transferData, setTransferData] = useState({
    from_warehouse_id: null,
    to_warehouse_id: null,
    transfer_date: new Date().toISOString().slice(0, 16),
    reference_doc: "",
    description: "",
  });

  // États pour la gestion des entrepôts
  const [warehouseFormData, setWarehouseFormData] = useState({
    code: "",
    name: "",
    location: "",
    manager_name: "",
    phone: "",
    email: "",
    is_active: true,
    description: "",
  });
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // Loaders
  const [submitLoading, setSubmitLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [warehouseLoading, setWarehouseLoading] = useState(false);

  // Types de mouvements
  const movementTypes = {
    EN: { label: t("entry_normal"), icon: "📥", color: "#10b981", type: "in" },
    ER: { label: t("entry_return"), icon: "🔄", color: "#10b981", type: "in" },
    EI: {
      label: t("entry_inventory"),
      icon: "📋",
      color: "#10b981",
      type: "in",
    },
    EAJ: {
      label: t("entry_adjustment"),
      icon: "⚙️",
      color: "#10b981",
      type: "in",
    },
    ET: {
      label: t("entry_transfer"),
      icon: "🚚",
      color: "#10b981",
      type: "in",
    },
    EAU: { label: t("entry_other"), icon: "📦", color: "#10b981", type: "in" },
    SN: { label: t("exit_normal"), icon: "📤", color: "#ef4444", type: "out" },
    SP: { label: t("exit_loss"), icon: "⚠️", color: "#f59e0b", type: "out" },
    SV: { label: t("exit_theft"), icon: "🚨", color: "#ef4444", type: "out" },
    SD: {
      label: t("exit_obsolete"),
      icon: "⏰",
      color: "#f59e0b",
      type: "out",
    },
    SC: { label: t("exit_damage"), icon: "💔", color: "#ef4444", type: "out" },
    SAJ: {
      label: t("exit_adjustment"),
      icon: "⚙️",
      color: "#f59e0b",
      type: "out",
    },
    ST: {
      label: t("exit_transfer"),
      icon: "🚚",
      color: "#f59e0b",
      type: "out",
    },
    SAU: { label: t("exit_other"), icon: "📤", color: "#ef4444", type: "out" },
  };

  // ========== CHARGEMENT DES DONNÉES ==========
  const loadData = async (params = {}, page = 1) => {
    setLoading(true);
    try {
      const cleanParams = {};
      if (params.product_id) cleanParams.product_id = params.product_id;
      if (params.movement_type)
        cleanParams.movement_type = params.movement_type;
      if (params.warehouse_id) cleanParams.warehouse_id = params.warehouse_id;
      if (params.movement_number)
        cleanParams.movement_number = params.movement_number;
      if (params.date_from) cleanParams.date_from = params.date_from;
      if (params.date_to) cleanParams.date_to = params.date_to;
      if (params.direction) cleanParams.direction = params.direction;

      cleanParams.page = page;
      cleanParams.limit = itemsPerPage;
      const warehouseId =
        params.warehouse_id ?? selectedWarehouse?.value ?? null;

      const [movementsRes, summaryRes] = await Promise.all([
        stockService.getMovements(cleanParams),
        stockService.getSummary({ warehouse_id: warehouseId }),
      ]);

      setMovements(movementsRes.data?.data || []);
      setTotalItems(movementsRes.data?.pagination?.total || 0);
      setCurrentPage(page);
      setStockSummary(summaryRes.data?.data || []);
      setAppliedFilters(cleanParams);
      await loadWarehouseStockData(warehouseId);
    } catch (error) {
      toast.error(t("error_loading_stock"));
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouseStockData = async (
    warehouseId = selectedWarehouse?.value ?? null,
  ) => {
    try {
      const response = await stockService.getWarehouseSummary({
        warehouse_id: warehouseId,
      });
      setWarehouseStockData(response.data?.data || []);
    } catch (error) {
      console.error("Erreur chargement stock entrepôt:", error);
      setWarehouseStockData([]);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [productsRes, warehousesRes] = await Promise.all([
        productService.getAll({ limit: 9999 }),
        stockService.getWarehouses(),
      ]);

      const productsData = productsRes.data?.data || [];
      setProducts(productsData);
      setProductOptions(
        productsData.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.code})`,
          unit: p.unit,
          selling_price: p.selling_price || 0,
          purchase_price: p.purchase_price || 0,
          current_stock: p.current_stock || 0,
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
  };

  // ========== GESTION DES ENTREPÔTS ==========
  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseFormData.name) {
      toast.warning(t("warehouse_fields_required"));
      return;
    }

    const confirmed = await confirm.save(
      editingWarehouse ? t("save_changes") : t("create_warehouse"),
    );
    if (!confirmed) return;

    setWarehouseLoading(true);
    try {
      if (editingWarehouse) {
        await stockService.updateWarehouse(
          editingWarehouse.id,
          warehouseFormData,
        );
        toast.success(t("warehouse_updated"));
      } else {
        await stockService.createWarehouse(warehouseFormData);
        toast.success(t("warehouse_created"));
      }
      await loadReferenceData();
      setWarehouseModalOpen(false);
      resetWarehouseForm();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          (editingWarehouse
            ? t("error_updating_warehouse")
            : t("error_creating_warehouse")),
      );
    } finally {
      setWarehouseLoading(false);
    }
  };

  const resetWarehouseForm = () => {
    setWarehouseFormData({
      code: "",
      name: "",
      location: "",
      manager_name: "",
      phone: "",
      email: "",
      is_active: true,
      description: "",
    });
  };

  const openWarehouseModal = (warehouse = null) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setWarehouseFormData({
        code: warehouse.code,
        name: warehouse.name,
        location: warehouse.location || "",
        manager_name: warehouse.manager_name || "",
        phone: warehouse.phone || "",
        email: warehouse.email || "",
        is_active: warehouse.is_active === 1,
        description: warehouse.description || "",
      });
    } else {
      setEditingWarehouse(null);
      resetWarehouseForm();
    }
    setWarehouseModalOpen(true);
  };

  // ========== GESTION DES FICHIERS JOINTS ==========
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((file) => ({
      id: generateUniqueId(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      url: URL.createObjectURL(file),
    }));
    setAttachedFiles([...attachedFiles, ...newFiles]);
  };

  const removeFile = (id) => {
    setAttachedFiles(attachedFiles.filter((f) => f.id !== id));
  };

  // ========== GESTION DE L'INVENTAIRE ==========
  const handleInventory = async (e) => {
    e.preventDefault();
    toast.success(t("inventory_completed"));
    setInventoryModalOpen(false);
  };

  // États pour inventaire
  const [inventoryWarehouse, setInventoryWarehouse] = useState(null);
  const [inventoryProductList, setInventoryProductList] = useState([]);

  const updateInventoryDifference = (index, physicalStock) => {
    const newList = [...inventoryProductList];
    const systemStock = newList[index].system_stock;
    newList[index].physical_stock = physicalStock;
    newList[index].difference = physicalStock - systemStock;
    setInventoryProductList(newList);
  };

  const prepareInventory = async () => {
    let productsToShow = [];

    if (inventoryWarehouse) {
      productsToShow = stockSummary.filter(
        (s) => s.warehouse_id === inventoryWarehouse.value,
      );
    } else {
      const productMap = new Map();
      stockSummary.forEach((s) => {
        if (!productMap.has(s.id)) {
          productMap.set(s.id, { ...s, total_quantity: s.quantity });
        } else {
          productMap.get(s.id).total_quantity += s.quantity;
        }
      });
      productsToShow = Array.from(productMap.values()).map((p) => ({
        ...p,
        quantity: p.total_quantity,
      }));
    }

    setInventoryProductList(
      productsToShow.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        system_stock: p.quantity,
        physical_stock: p.quantity,
        difference: 0,
      })),
    );
  };

  useEffect(() => {
    if (inventoryModalOpen) {
      prepareInventory();
    }
  }, [inventoryModalOpen, inventoryWarehouse]);

  // Graphiques
  const getMovementTypeComparisonData = () => {
    const typeStats = {};
    movements.forEach((m) => {
      const type = m.movement_type;
      if (!typeStats[type]) {
        typeStats[type] = { entries: 0, exits: 0, total_quantity: 0 };
      }
      if (movementTypes[type]?.type === "in") {
        typeStats[type].entries += m.quantity;
      } else {
        typeStats[type].exits += m.quantity;
      }
      typeStats[type].total_quantity += m.quantity;
    });

    return Object.entries(typeStats).map(([type, stats]) => ({
      type: movementTypes[type]?.label || type,
      entries: stats.entries,
      exits: stats.exits,
      total: stats.total_quantity,
      color: movementTypes[type]?.color || "#667eea",
    }));
  };

  // ========== GESTION DES ITEMS MULTI-PRODUITS (MOUVEMENT) ==========
  const addMovementItem = () => {
    setMovementItems([
      ...movementItems,
      {
        id: generateUniqueId(),
        product_id: null,
        quantity: 0,
        unit_cost: 0,
        total: 0,
        product_name: "",
        available_stock: 0,
      },
    ]);
  };

  const removeMovementItem = (id) => {
    if (movementItems.length === 1) {
      toast.warning(t("at_least_one_product"));
      return;
    }
    setMovementItems(movementItems.filter((item) => item.id !== id));
  };

  const updateMovementItem = (id, field, value) => {
    setMovementItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "product_id") {
            const selectedProduct = productOptions.find(
              (p) => p.value === value,
            );
            updated.product_name = selectedProduct?.label || "";
            updated.unit_cost = selectedProduct?.purchase_price || 0;
            updated.available_stock = selectedProduct?.current_stock || 0;
          }
          if (field === "quantity" || field === "unit_cost") {
            updated.total = (updated.quantity || 0) * (updated.unit_cost || 0);
          }
          return updated;
        }
        return item;
      }),
    );
  };

  const checkMovementProductDuplicate = (productId, currentId) => {
    return movementItems.some(
      (item) => item.product_id === productId && item.id !== currentId,
    );
  };

  // ========== GESTION DES ITEMS MULTI-PRODUITS (TRANSFERT) ==========
  const addTransferItem = () => {
    setTransferItems([
      ...transferItems,
      {
        id: generateUniqueId(),
        product_id: null,
        quantity: 0,
        available_stock: 0,
        product_name: "",
        unit: "",
        error: "",
      },
    ]);
  };

  const removeTransferItem = (id) => {
    if (transferItems.length === 1) {
      toast.warning(t("at_least_one_product"));
      return;
    }
    setTransferItems(transferItems.filter((item) => item.id !== id));
  };

  const updateTransferItem = (id, field, value) => {
    setTransferItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "product_id") {
            const selectedProduct = productOptions.find(
              (p) => p.value === value,
            );
            updated.product_name = selectedProduct?.label || "";
            updated.unit = selectedProduct?.unit || "PIECE";
            updated.available_stock = selectedProduct?.current_stock || 0;
            updated.error = "";
          }
          if (field === "quantity") {
            const qty = parseFloat(value) || 0;
            if (qty > item.available_stock && item.available_stock > 0) {
              updated.error = t("quantity_exceeds_stock");
            } else {
              updated.error = "";
            }
          }
          return updated;
        }
        return item;
      }),
    );
  };

  const checkTransferProductDuplicate = (productId, currentId) => {
    return transferItems.some(
      (item) => item.product_id === productId && item.id !== currentId,
    );
  };

  const fetchProductStock = async (productId, warehouseId) => {
    if (!productId || !warehouseId) return 0;
    try {
      const response = await stockService.getProductStock(
        productId,
        warehouseId,
      );
      const stock = response.data?.data?.current_stock || 0;
      return stock;
    } catch (error) {
      console.error("Erreur chargement stock:", error);
      return 0;
    }
  };

  const updateTransferStock = async (productId, warehouseId, itemId) => {
    if (!productId || !warehouseId) return;
    const stock = await fetchProductStock(productId, warehouseId);
    setTransferItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, available_stock: stock };
          if (item.quantity > stock) {
            updated.error = t("quantity_exceeds_stock");
          } else {
            updated.error = "";
          }
          return updated;
        }
        return item;
      }),
    );
  };

  // ========== FILTRES ==========
  const applyFilters = () => {
    const params = {};
    if (filters.product_id) params.product_id = filters.product_id.value;
    if (filters.movement_type) params.movement_type = filters.movement_type;
    if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id.value;
    if (filters.movement_number)
      params.movement_number = filters.movement_number;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;

    loadData(params, 1);
    setFilterModalOpen(false);
    toast.success(t("filters_applied"));
  };

  const resetFilters = () => {
    setFilters({
      product_id: null,
      movement_type: "",
      warehouse_id: null,
      movement_number: "",
      date_from: "",
      date_to: "",
    });
    setSelectedWarehouse(null);
    loadData({}, 1);
    setFilterModalOpen(false);
    toast.success(t("filters_reset"));
  };

  const refreshStock = () => {
    loadData(appliedFilters, currentPage);
    toast.success(t("refresh_success"));
  };

  const hasActiveFilters = () => {
    return !!(
      appliedFilters.product_id ||
      appliedFilters.movement_type ||
      appliedFilters.warehouse_id ||
      appliedFilters.movement_number ||
      appliedFilters.date_from ||
      appliedFilters.date_to
    );
  };

  // ========== CRUD MOUVEMENTS ==========
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = movementItems.filter(
      (item) => item.product_id && item.quantity > 0,
    );
    if (validItems.length === 0) {
      toast.warning(t("at_least_one_product"));
      return;
    }

    if (!formData.warehouse_id) {
      toast.warning(t("warehouse_required"));
      return;
    }

    const productIds = validItems.map((item) => item.product_id);
    const hasDuplicates = productIds.some(
      (id, index) => productIds.indexOf(id) !== index,
    );
    if (hasDuplicates) {
      toast.warning(t("duplicate_products"));
      return;
    }

    const confirmed = await confirm.save(t("save_movement"));
    if (!confirmed) return;

    setSubmitLoading(true);
    try {
      const payload = {
        movement_type: formData.movement_type,
        warehouse_id: formData.warehouse_id.value,
        movement_date: formData.movement_date,
        description: formData.description || "",
        reference: formData.reference || "",
        reference_doc: formData.reference_doc || "",
        items: validItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      };

      const response = await stockService.addMovement(payload);
      const costingUpdates = response.data?.data?.costing_updates || [];
      if (costingUpdates.length > 0) {
        costingUpdates.forEach((u) => {
          toast.success(
            `${u.product_name}: ${t("average_cost")} ${u.previous_average_cost?.toLocaleString()} → ${u.new_average_cost?.toLocaleString()} FBu`,
            { duration: 5000 },
          );
        });
      } else {
        toast.success(t("movement_created"));
      }

      if (attachedFiles.length > 0 && response.data?.data?.movements?.[0]?.id) {
        const attachForm = new FormData();
        attachedFiles.forEach((file) =>
          attachForm.append("attachments[]", file.file),
        );
        await stockService.addMovementAttachments(
          response.data.data.movements[0].id,
          attachForm,
        );
      }
      loadData(appliedFilters, currentPage);
      closeModal();
      resetForm();
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("error_creating_movement"),
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  // ========== TRANSFERT INTER-ENTREPÔTS ==========
  const handleTransfer = async (e) => {
    e.preventDefault();

    const validItems = transferItems.filter(
      (item) => item.product_id && item.quantity > 0,
    );
    if (validItems.length === 0) {
      toast.warning(t("at_least_one_product"));
      return;
    }

    if (!transferData.from_warehouse_id || !transferData.to_warehouse_id) {
      toast.warning(t("warehouse_required"));
      return;
    }

    const productIds = validItems.map((item) => item.product_id);
    const hasDuplicates = productIds.some(
      (id, index) => productIds.indexOf(id) !== index,
    );
    if (hasDuplicates) {
      toast.warning(t("duplicate_products"));
      return;
    }

    const hasErrors = transferItems.some((item) => item.error);
    if (hasErrors) {
      toast.warning(t("fix_errors_before_transfer"));
      return;
    }

    const confirmed = await confirm.save(t("confirm_transfer"));
    if (!confirmed) return;

    setTransferLoading(true);
    try {
      const payload = {
        ...transferData,
        from_warehouse_id: transferData.from_warehouse_id.value,
        to_warehouse_id: transferData.to_warehouse_id.value,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      await stockService.transferStock(payload);
      toast.success(t("transfer_success"));
      loadData(appliedFilters, currentPage);
      setTransferModalOpen(false);
      resetTransferForm();
    } catch (error) {
      toast.error(error.response?.data?.message || t("transfer_error"));
    } finally {
      setTransferLoading(false);
    }
  };

  // ========== PIÈCES JOINTES ==========
  const [addAttachmentModalOpen, setAddAttachmentModalOpen] = useState(false);
  const [selectedMovementForAttachment, setSelectedMovementForAttachment] =
    useState(null);
  const [newAttachments, setNewAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const openAddAttachmentModal = (movement) => {
    setSelectedMovementForAttachment(movement);
    setNewAttachments([]);
    setAddAttachmentModalOpen(true);
  };

  const handleNewAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((file) => ({
      id: generateUniqueId(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      url: URL.createObjectURL(file),
    }));
    setNewAttachments([...newAttachments, ...newFiles]);
  };

  const removeNewAttachment = (id) => {
    setNewAttachments(newAttachments.filter((f) => f.id !== id));
  };

  const uploadAttachments = async () => {
    if (newAttachments.length === 0) {
      toast.warning(t("select_files_to_upload"));
      return;
    }

    setUploadingAttachments(true);
    try {
      const formData = new FormData();
      newAttachments.forEach((att) => {
        formData.append("attachments[]", att.file);
      });

      await stockService.addMovementAttachments(
        selectedMovementForAttachment.id,
        formData,
      );
      toast.success(t("attachments_added_success"));
      setAddAttachmentModalOpen(false);
      setNewAttachments([]);
      loadData(appliedFilters, currentPage);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error.response?.data?.message || t("error_adding_attachments"),
      );
    } finally {
      setUploadingAttachments(false);
    }
  };

  const deleteAttachment = async (attachmentId) => {
    const confirmed = await confirm.delete(t("confirm_delete_attachment"));
    if (!confirmed) return;

    try {
      await stockService.deleteAttachment(attachmentId);
      toast.success(t("attachment_deleted"));
      loadData(appliedFilters, currentPage);
    } catch (error) {
      toast.error(t("error_deleting_attachment"));
    }
  };

  // ========== ACTIONS GROUPÉES ==========
  const handleBulkDelete = async () => {
    if (selectedMovements.length === 0) {
      toast.warning(t("select_movements"));
      return;
    }

    const confirmed = await confirm.delete(
      t("confirm_bulk_delete").replace("{count}", selectedMovements.length),
    );
    if (!confirmed) return;

    setBulkLoading(true);
    try {
      await stockService.bulkDelete(selectedMovements);
      toast.success(
        t("bulk_delete_success").replace("{count}", selectedMovements.length),
      );
      setSelectedMovements([]);
      loadData(appliedFilters, currentPage);
    } catch (error) {
      toast.error(t("bulk_delete_error"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedMovements.length === movements.length) {
      setSelectedMovements([]);
    } else {
      setSelectedMovements(movements.map((m) => m.id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedMovements.includes(id)) {
      setSelectedMovements(selectedMovements.filter((i) => i !== id));
    } else {
      setSelectedMovements([...selectedMovements, id]);
    }
  };

  // ========== FONCTIONS D'AFFICHAGE ==========
  const viewMovementDetail = (movement) => {
    setSelectedMovement(movement);
    setMovementDetailModalOpen(true);
  };

  const viewAttachments = (movement) => {
    setSelectedMovement(movement);
    setAttachments(movement.attachments || []);
    setAttachmentsModalOpen(true);
  };

  const generateTransferReceipt = (movement) => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>${t("transfer_receipt")}</title>
          <style>
            body { font-family: Arial; margin: 40px; background: ${isDark ? "#12121a" : "#f8fafc"}; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #667eea; }
            .info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${t("transfer_receipt")}</h1>
            <p>${t("transfer_number")}: ${movement.movement_number}</p>
          </div>
          <div class="info">
            <p><strong>${t("date")}:</strong> ${new Date(movement.movement_date).toLocaleString()}</p>
            <p><strong>${t("from_warehouse")}:</strong> ${movement.from_warehouse_name}</p>
            <p><strong>${t("to_warehouse")}:</strong> ${movement.to_warehouse_name}</p>
          </div>
          <table>
            <thead><tr><th>${t("product")}</th><th>${t("quantity")}</th><th>${t("unit")}</th></tr></thead>
            <tbody>
              ${movement.items
                ?.map(
                  (item) => `
                <tr>
                  <td>${item.product_name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit}</td>
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
  };

  const getEBMSStatus = (movement) => {
    if (movement.ebms_synced) {
      return { label: t("synced"), color: "#10b981", icon: "✅" };
    } else if (movement.ebms_error) {
      return { label: t("sync_failed"), color: "#dc2626", icon: "❌" };
    }
    return { label: t("pending"), color: "#f59e0b", icon: "⏳" };
  };

  // Graphiques
  const getChartData = () => {
    const now = new Date();
    let dates = [];
    if (chartPeriod === "week") {
      for (let i = 6; i >= 0; i--) {
        dates.push(format(subDays(now, i), "yyyy-MM-dd"));
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        dates.push(format(subMonths(now, i), "yyyy-MM"));
      }
    }
    const entriesByDate = {};
    const exitsByDate = {};
    movements.forEach((m) => {
      const dateKey =
        chartPeriod === "week"
          ? m.movement_date?.split(" ")[0]
          : m.movement_date?.slice(0, 7);
      if (movementTypes[m.movement_type]?.type === "in") {
        entriesByDate[dateKey] = (entriesByDate[dateKey] || 0) + m.quantity;
      } else {
        exitsByDate[dateKey] = (exitsByDate[dateKey] || 0) + m.quantity;
      }
    });
    return dates.map((date) => ({
      date,
      entries: entriesByDate[date] || 0,
      exits: exitsByDate[date] || 0,
    }));
  };

  const getPieChartData = () => {
    const totals = stockSummary.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) {
          acc.out += 0;
        } else if (qty <= (Number(item.min_stock_alert) || 0)) {
          acc.low += qty;
        } else {
          acc.in += qty;
        }
        return acc;
      },
      { in: 0, low: 0, out: 0 },
    );

    return [
      { name: t("in_stock"), value: totals.in, color: "#10b981" },
      { name: t("low_stock"), value: totals.low, color: "#f59e0b" },
      { name: t("out_of_stock"), value: totals.out, color: "#ef4444" },
    ].filter((item) => item.value > 0);
  };

  const getWarehouseStockData = () => {
    if (warehouseStockData && warehouseStockData.length > 0) {
      return warehouseStockData;
    }
    return [];
  };

  // ========== EXPORT ET IMPRESSION ==========
  const exportStockToCSV = async () => {
    toast(t("export_preparing"));
    try {
      const response = await stockService.getMovements({ limit: 9999 });
      const allMovements = response.data?.data || [];

      if (allMovements.length === 0) {
        toast.error(t("export_no_data"));
        return;
      }

      const headers = [
        t("code"),
        t("date"),
        t("movement_type"),
        t("product"),
        t("quantity"),
        t("unit_cost"),
        t("total_value"),
        t("warehouse"),
        t("description"),
        t("ebms_status"),
      ];
      const rows = allMovements.map((m) => [
        m.movement_number || "-",
        new Date(m.movement_date).toLocaleString(),
        movementTypes[m.movement_type]?.label || m.movement_type,
        m.product_name,
        m.quantity,
        m.unit_cost?.toLocaleString() || "0",
        m.total_cost?.toLocaleString() || "0",
        m.warehouse_name,
        m.description || "-",
        getEBMSStatus(m).label,
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
        `${t("export_filename_stock")}_${new Date().toISOString().slice(0, 19)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        t("export_success_stock").replace("{count}", allMovements.length),
      );
    } catch (error) {
      toast.error(t("export_error"));
    }
  };

  const printStock = async () => {
    toast(t("print_preparing"));
    try {
      const response = await stockService.getMovements({ limit: 9999 });
      const allMovements = response.data?.data || [];

      if (allMovements.length === 0) {
        toast.error(t("print_no_data"));
        return;
      }

      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>${t("print_title_stock")}</title>
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
            <h1>${t("print_header_stock")}</h1>
            <div class="date">${t("print_generated_on")} ${new Date().toLocaleString()}</div>
            <table>
              <thead><tr><th>${t("code")}</th><th>${t("date")}</th><th>${t("movement_type")}</th><th>${t("product")}</th><th>${t("quantity")}</th><th>${t("unit_cost")}</th><th>${t("total_value")}</th><th>${t("warehouse")}</th><th>${t("ebms_status")}</th></tr></thead>
              <tbody>
                ${allMovements
                  .map(
                    (m) => `
                  <tr>
                    <td>${m.movement_number || "-"}</td>
                    <td>${new Date(m.movement_date).toLocaleString()}</td>
                    <td>${movementTypes[m.movement_type]?.label || m.movement_type}</td>
                    <td>${m.product_name}</td>
                    <td>${m.quantity} ${m.unit}</td>
                    <td>${m.unit_cost?.toLocaleString()} FBu}</td>
                    <td>${m.total_cost?.toLocaleString()} FBu}</td>
                    <td>${m.warehouse_name}</td>
                    <td>${getEBMSStatus(m).label}</td>
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

  // ========== UTILITAIRES ==========
  const resetForm = () => {
    setFormData({
      movement_type: "EN",
      warehouse_id: null,
      description: "",
      movement_date: new Date().toISOString().slice(0, 16),
      reference: "",
      reference_doc: "",
    });
    setMovementItems([
      {
        id: generateUniqueId(),
        product_id: null,
        quantity: 0,
        unit_cost: 0,
        total: 0,
        product_name: "",
        available_stock: 0,
      },
    ]);
    setAttachedFiles([]);
  };

  const resetTransferForm = () => {
    setTransferData({
      from_warehouse_id: null,
      to_warehouse_id: null,
      transfer_date: new Date().toISOString().slice(0, 16),
      reference_doc: "",
      description: "",
    });
    setTransferItems([
      {
        id: generateUniqueId(),
        product_id: null,
        quantity: 0,
        available_stock: 0,
        product_name: "",
        unit: "",
        error: "",
      },
    ]);
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const openTransferModal = () => {
    resetTransferForm();
    setTransferModalOpen(true);
  };

  const handleModalClick = (e) => e.stopPropagation();

  const getStockStatus = (quantity, minAlert) => {
    if (quantity <= 0)
      return { label: t("out_of_stock"), color: "#dc2626", icon: "❌" };
    if (quantity <= minAlert)
      return { label: t("low_stock"), color: "#f59e0b", icon: "⚠️" };
    return { label: t("in_stock"), color: "#10b981", icon: "✅" };
  };

  // ========== RÉSERVATIONS ==========
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [reservationsListModalOpen, setReservationsListModalOpen] =
    useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationPage, setReservationPage] = useState(1);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [reservationDetailModalOpen, setReservationDetailModalOpen] =
    useState(false);
  const [completePreviewModalOpen, setCompletePreviewModalOpen] =
    useState(false);
  const [completePreviewReservation, setCompletePreviewReservation] =
    useState(null);
  const [completePreviewItems, setCompletePreviewItems] = useState([]);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [reservationItems, setReservationItems] = useState([
    {
      id: generateUniqueId(),
      product_id: null,
      quantity: 0,
      unit_price: 0,
      tax_rate: 18,
      total: 0,
      product_name: "",
      available_stock: 0,
    },
  ]);
  const [reservationFiles, setReservationFiles] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [reservationFormData, setReservationFormData] = useState({
    reservation_date: new Date().toISOString().slice(0, 16),
    expected_delivery_date: "",
    priority: "normal",
    notes: "",
  });
  const [submittingReservation, setSubmittingReservation] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState([]);

  const loadCustomers = async () => {
    try {
      const response = await customerService.getAll();
      const customersData = response.data?.data || [];
      setCustomers(customersData);
      setCustomerOptions(
        customersData.map((c) => ({
          value: c.id,
          label: `${c.last_name} ${c.first_name} (${c.customer_number})`,
        })),
      );
    } catch (error) {
      console.error("Erreur chargement clients:", error);
      toast.error(t("error_loading_customers"));
    }
  };

  const loadReservations = async () => {
    try {
      const response = await reservationService.getAll();
      setReservations(response.data?.data || []);
    } catch (error) {
      console.error("Erreur chargement réservations:", error);
      toast.error(t("error_loading_reservations"));
    }
  };

  const filteredReservations = useMemo(() => {
    const search = reservationSearch.trim().toLowerCase();
    return reservations.filter((res) => {
      if (!search) return true;
      return [
        res.reservation_number,
        res.customer_name,
        res.status,
        res.priority,
      ]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(search));
    });
  }, [reservations, reservationSearch]);

  const reservationTotalPages = Math.max(
    1,
    Math.ceil(filteredReservations.length / 10),
  );
  const paginatedReservations = useMemo(() => {
    const start = (reservationPage - 1) * 10;
    return filteredReservations.slice(start, start + 10);
  }, [filteredReservations, reservationPage]);

  useEffect(() => {
    setReservationPage(1);
  }, [reservationSearch, reservations]);

  const addReservationItem = () => {
    setReservationItems([
      ...reservationItems,
      {
        id: generateUniqueId(),
        product_id: null,
        quantity: 0,
        unit_price: 0,
        tax_rate: 18,
        total: 0,
        product_name: "",
        available_stock: 0,
      },
    ]);
  };

  const removeReservationItem = (id) => {
    if (reservationItems.length === 1) {
      toast.warning(t("at_least_one_product"));
      return;
    }
    setReservationItems(reservationItems.filter((item) => item.id !== id));
  };

  const updateReservationItem = (id, field, value) => {
    setReservationItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === "product_id") {
            const selectedProduct = productOptions.find(
              (p) => p.value === value,
            );
            if (selectedProduct) {
              updated.product_name = selectedProduct.label;
              updated.unit_price = selectedProduct.selling_price || 0;
              updated.available_stock = selectedProduct.current_stock || 0;
              updated.tax_rate = selectedProduct.tax_rate ?? 18;
            }
          }

          if (["quantity", "unit_price", "tax_rate"].includes(field)) {
            const qty = parseFloat(updated.quantity) || 0;
            const price = parseFloat(updated.unit_price) || 0;
            const tax = parseFloat(updated.tax_rate) || 0;
            updated.total = qty * price * (1 + tax / 100);
          }

          return updated;
        }
        return item;
      }),
    );
  };

  const handleReservationFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((file) => ({
      id: generateUniqueId(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      url: URL.createObjectURL(file),
    }));
    setReservationFiles([...reservationFiles, ...newFiles]);
  };

  const removeReservationFile = (id) => {
    setReservationFiles(reservationFiles.filter((f) => f.id !== id));
  };

  const resetReservationForm = () => {
    setReservationItems([
      {
        id: generateUniqueId(),
        product_id: null,
        quantity: 0,
        unit_price: 0,
        total: 0,
        product_name: "",
        available_stock: 0,
      },
    ]);
    setReservationFiles([]);
    setSelectedCustomer(null);
    setReservationFormData({
      reservation_date: new Date().toISOString().slice(0, 16),
      expected_delivery_date: "",
      priority: "normal",
      notes: "",
    });
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();

    const validItems = reservationItems.filter(
      (item) => item.product_id && item.quantity > 0,
    );
    if (validItems.length === 0) {
      toast.warning(t("at_least_one_product"));
      return;
    }

    if (!selectedCustomer) {
      toast.warning(t("customer_required"));
      return;
    }

    setSubmittingReservation(true);
    try {
      const formData = new FormData();
      formData.append("customer_id", selectedCustomer.value);
      formData.append("reservation_date", reservationFormData.reservation_date);
      if (reservationFormData.expected_delivery_date) {
        formData.append(
          "expected_delivery_date",
          reservationFormData.expected_delivery_date,
        );
      }
      formData.append("priority", reservationFormData.priority);
      if (reservationFormData.notes) {
        formData.append("notes", reservationFormData.notes);
      }

      const itemsPayload = validItems.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price) || 0,
        tax_rate: Number(item.tax_rate) || 18,
        discount_percent: Number(item.discount_percent) || 0,
      }));
      formData.append("items", JSON.stringify(itemsPayload));

      if (reservationFiles && reservationFiles.length > 0) {
        reservationFiles.forEach((file) => {
          if (file && file.file instanceof File) {
            formData.append("attachments[]", file.file);
          }
        });
      }

      const response = await reservationService.create(formData);

      if (response.data?.success) {
        toast.success(t("reservation_created"));
        setReservationModalOpen(false);
        resetReservationForm();
        loadReservations();
      } else {
        toast.error(response.data?.message || t("error_creating_reservation"));
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(
        error.response?.data?.message || t("error_creating_reservation"),
      );
    } finally {
      setSubmittingReservation(false);
    }
  };

  const openReservationModal = () => {
    resetReservationForm();
    setReservationModalOpen(true);
  };

  const viewReservationDetail = async (reservation) => {
    setReservationsListModalOpen(false);

    try {
      const response = await reservationService.getById(reservation.id);

      if (response.data?.success) {
        setSelectedReservation(response.data.data);
        setReservationDetailModalOpen(true);
      } else {
        toast.error(t("error_loading_reservation_details"));
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(
        error.response?.data?.message || t("error_loading_reservation_details"),
      );
    }
  };

  const openCompletePreview = async (reservation) => {
    if (!reservation) return;
    let res = reservation;
    try {
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
        to_release: Math.max(
          0,
          (parseFloat(item.quantity) || 0) -
            (parseFloat(item.delivered_quantity) || 0),
        ),
      }));

      setCompletePreviewReservation(res);
      setCompletePreviewItems(items);
      setCompletePreviewModalOpen(true);
    } catch (err) {
      console.error("Erreur aperçu finalisation:", err);
      toast.error(
        err.response?.data?.message || t("error_loading_reservation_details"),
      );
    }
  };

  const openDeliveryModal = (reservation) => {
    if (reservationDetailModalOpen) {
      setReservationDetailModalOpen(false);
    }
    setReservationsListModalOpen(false);

    setSelectedReservation(reservation);

    const items =
      reservation.items?.map((item) => ({
        id: item.id,
        product_name: item.product_name,
        reserved_quantity: item.reserved_quantity || item.quantity,
        delivered_quantity: item.delivered_quantity || 0,
        remaining_quantity:
          (item.reserved_quantity || item.quantity) -
          (item.delivered_quantity || 0),
        to_deliver: 0,
      })) || [];

    setDeliveryItems(items);
    setDeliveryModalOpen(true);
  };

  const updateDeliveryItem = (index, value) => {
    const newItems = [...deliveryItems];
    const maxDeliver = newItems[index].remaining_quantity;
    const deliverValue = Math.min(parseFloat(value) || 0, maxDeliver);
    newItems[index].to_deliver = Math.max(0, deliverValue);
    setDeliveryItems(newItems);
  };

  const submitDelivery = async () => {
    const itemsToDeliver = deliveryItems.filter((item) => item.to_deliver > 0);

    if (itemsToDeliver.length === 0) {
      toast.error(t("select_items_to_deliver"));
      return;
    }

    const hasError = deliveryItems.some(
      (item) => item.to_deliver > item.remaining_quantity,
    );
    if (hasError) {
      toast.error(t("quantity_exceeds_remaining"));
      return;
    }

    const confirmed = await confirm.save(t("confirm_delivery"));
    if (!confirmed) return;

    try {
      const payload = {
        items: itemsToDeliver.map((item) => ({
          item_id: item.id,
          quantity: item.to_deliver,
        })),
      };

      const response = await reservationService.deliver(
        selectedReservation.id,
        payload,
      );

      if (response.data?.success) {
        toast.success(t("delivery_recorded"));
        setDeliveryModalOpen(false);
        await loadReservations();

        if (selectedReservation) {
          const updatedRes = await reservationService.getById(
            selectedReservation.id,
          );
          if (updatedRes.data?.success) {
            setSelectedReservation(updatedRes.data.data);
          }
        }

        toast.success(
          `Livraison de ${itemsToDeliver.length} article(s) enregistrée`,
        );
      } else {
        toast.error(response.data?.message || t("error_delivery"));
      }
    } catch (error) {
      console.error("Erreur livraison:", error);
      toast.error(error.response?.data?.message || t("error_delivery"));
    }
  };

  const deleteReservation = async (reservation) => {
    const confirmed = await confirm.delete(
      `${t("confirm_delete_reservation")} ${reservation.reservation_number}`,
    );
    if (!confirmed) return;

    try {
      await reservationService.delete(reservation.id);
      toast.success(t("reservation_deleted"));
      loadReservations();
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error(t("error_deleting_reservation"));
    }
  };

  // ========== ENREGISTREMENT DES ACTIONS ==========
  useEffect(() => {
    registerAction("add", () => openModal());
    registerAction("export", () => exportStockToCSV());
    registerAction("print", () => printStock());
    registerAction("filter", () => setFilterModalOpen(true));
    registerAction("refresh", () => refreshStock());

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
    loadReferenceData();
    loadData({}, 1);
    loadCustomers();
    loadReservations();
  }, []);

  useEffect(() => {
    if (transferModalOpen && transferData.from_warehouse_id) {
      transferItems.forEach((item) => {
        if (item.product_id) {
          updateTransferStock(
            item.product_id,
            transferData.from_warehouse_id.value,
            item.id,
          );
        }
      });
    }
  }, [transferData.from_warehouse_id, transferModalOpen]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (loading) return <Loader />;

  return (
    <div className={`stock-container ${isDark ? "dark" : "light"}`}>
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
          <h2>{t("stock")}</h2>
          <p>{t("stock_desc")}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">
            🏪 {t("total_warehouses")}: {warehouses.length}
          </span>
          <span className="stat-value">
            💰 {t("total_stock_value")}:{" "}
            {stockSummary
              .reduce((sum, s) => sum + s.quantity * s.selling_price, 0)
              .toLocaleString()}{" "}
            FBu
          </span>
          {hasActiveFilters() && (
            <span className="filter-badge"> 🔍 {t("active_filters")}</span>
          )}
        </div>
      </div>

      {/* ACTIONS GROUPÉES */}
      {selectedMovements.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">
            {selectedMovements.length} {t("selected")}
          </span>
          <button
            className="bulk-delete-btn"
            onClick={handleBulkDelete}
            disabled={bulkLoading}
          >
            {bulkLoading ? <span className="btn-spinner"></span> : "🗑️"}{" "}
            {t("delete_selected")}
          </button>
          <button
            className="bulk-clear-btn"
            onClick={() => setSelectedMovements([])}
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
          {appliedFilters.product_id && (
            <span className="filter-tag">
              {t("product")}:{" "}
              {products.find((p) => p.id == appliedFilters.product_id)?.name}
            </span>
          )}
          {appliedFilters.movement_type && (
            <span className="filter-tag">
              {t("movement_type")}:{" "}
              {movementTypes[appliedFilters.movement_type]?.label}
            </span>
          )}
          {appliedFilters.warehouse_id && (
            <span className="filter-tag">
              {t("warehouse")}:{" "}
              {
                warehouses.find((w) => w.id == appliedFilters.warehouse_id)
                  ?.name
              }
            </span>
          )}
          {appliedFilters.date_from && (
            <span className="filter-tag">
              {t("from")}: {appliedFilters.date_from}
            </span>
          )}
          {appliedFilters.date_to && (
            <span className="filter-tag">
              {t("to")}: {appliedFilters.date_to}
            </span>
          )}
          <button className="clear-filters-btn" onClick={resetFilters}>
            ✕ {t("clear_filters")}
          </button>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="stock-toolbar">
        <div className="warehouse-selector">
          <label>{t("filter_by_warehouse")}</label>
          <Select
            options={warehouseOptions}
            value={selectedWarehouse}
            onChange={(val) => {
              setSelectedWarehouse(val);
              loadData({ ...appliedFilters, warehouse_id: val?.value }, 1);
            }}
            isClearable
            placeholder={t("all_warehouses")}
            className="select-filter"
            classNamePrefix="select"
            styles={{
              control: (base) => ({
                ...base,
                background: isDark ? "#1e293b" : "#ffffff",
                borderColor: isDark ? "#334155" : "#e2e8f0",
                color: isDark ? "#f1f5f9" : "#1e293b",
              }),
              menu: (base) => ({
                ...base,
                background: isDark ? "#1e293b" : "#ffffff",
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
              }),
              singleValue: (base) => ({
                ...base,
                color: isDark ? "#f1f5f9" : "#1e293b",
              }),
              input: (base) => ({
                ...base,
                color: isDark ? "#f1f5f9" : "#1e293b",
              }),
            }}
          />
          <button
            className="btn-manage-warehouses"
            onClick={() => openWarehouseModal()}
          >
            🏪 {t("manage_warehouses")}
          </button>
          <button className="btn-reservation" onClick={openReservationModal}>
            📅 {t("reservations")}
          </button>
          <button
            className="btn-reservations-list"
            onClick={() => setReservationsListModalOpen(true)}
          >
            👁️ {t("view_reservations")}
          </button>
          <button
            className="btn-inventory"
            onClick={() => setInventoryModalOpen(true)}
          >
            📋 {t("inventory")}
          </button>
        </div>
        <div className="action-buttons-group">
          <button className="btn-transfer" onClick={openTransferModal}>
            🚚 {t("internal_transfer")}
          </button>
        </div>
      </div>

      {/* TABLEAU DES MOUVEMENTS */}
      <div className="page-content">
        <div
          className="stock-movement-tabs"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {[
            { id: "all", label: t("tab_all_movements"), icon: "📋" },
            { id: "entries", label: t("tab_entries"), icon: "📥" },
            { id: "exits", label: t("tab_exits"), icon: "📤" },
            { id: "transfers", label: t("tab_transfers"), icon: "🚚" },
            { id: "summary", label: t("tab_summary"), icon: "📊" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`stock-tab-btn ${movementTab === tab.id ? "active" : ""}`}
              onClick={() => {
                setMovementTab(tab.id);
                if (tab.id === "summary") return;
                const next = { ...appliedFilters };
                delete next.direction;
                if (tab.id === "entries") next.direction = "in";
                else if (tab.id === "exits") next.direction = "out";
                else if (tab.id === "transfers") next.direction = "transfer";
                loadData(next, 1);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${movementTab === tab.id ? "#667eea" : isDark ? "#334155" : "#e2e8f0"}`,
                background:
                  movementTab === tab.id
                    ? "#667eea"
                    : isDark
                      ? "#1e293b"
                      : "#fff",
                color:
                  movementTab === tab.id
                    ? "#fff"
                    : isDark
                      ? "#f1f5f9"
                      : "#1e293b",
                cursor: "pointer",
                fontWeight: movementTab === tab.id ? 600 : 400,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {movementTab === "summary" ? (
          <div
            className={`stock-summary-panel ${isDark ? "dark" : "light"}`}
            style={{
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            }}
          >
            <h3 style={{ marginBottom: 12 }}>{t("stock_value_summary")}</h3>
            <div className="summary-search-row">
              <input
                type="text"
                value={valueSummarySearch}
                onChange={(e) => setValueSummarySearch(e.target.value)}
                placeholder={`${t("filter_name_placeholder")} / ${t("filter_code_placeholder")}`}
                className="summary-search-input"
                aria-label={t("filter_products")}
              />
            </div>
            {filteredStockValueSummary.length === 0 ? (
              <div className="empty-state">
                {t("no_products_match_filters")}
              </div>
            ) : (
              <div className="stock-summary-scroll">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 12,
                    paddingRight: 8,
                  }}
                >
                  {filteredStockValueSummary.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        background: isDark ? "#0f172a" : "#f8fafc",
                        borderRadius: 8,
                      }}
                    >
                      <strong>{row.product_name || row.name}</strong>
                      <div>
                        {t("quantity")}:{" "}
                        {Number(
                          row.total_quantity || row.quantity || 0,
                        ).toLocaleString()}
                      </div>
                      <div>
                        {t("total_value")}:{" "}
                        {Number(row.total_value || 0).toLocaleString()} FBu
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: "16px" }}>{t("stock_movements")}</h3>
            {movements.length === 0 && !hasActiveFilters() ? (
              <div className={`empty-state ${isDark ? "dark" : "light"}`}>
                <p>{t("no_movements")}</p>
                <Tippy
                  content={t("add_movement")}
                  placement="bottom"
                  animation="scale"
                >
                  <button className="btn-primary" onClick={openModal}>
                    ➕ {t("add_first_movement")}
                  </button>
                </Tippy>
              </div>
            ) : movements.length === 0 && hasActiveFilters() ? (
              <div className={`empty-state ${isDark ? "dark" : "light"}`}>
                <p>{t("no_movements_match_filters")}</p>
                <button className="btn-secondary" onClick={resetFilters}>
                  {t("reset_filters")}
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`table-responsive ${isDark ? "dark" : "light"}`}
                >
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}>
                          <input
                            type="checkbox"
                            checked={
                              selectedMovements.length === movements.length &&
                              movements.length > 0
                            }
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th>{t("code")}</th>
                        <th>{t("date")}</th>
                        <th>{t("movement_type")}</th>
                        <th>{t("product")}</th>
                        <th>{t("quantity")}</th>
                        <th>{t("unit_cost")}</th>
                        <th>{t("total_value")}</th>
                        <th>{t("warehouse")}</th>
                        <th>{t("ebms_status")}</th>
                        <th>{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => {
                        const ebmsStatus = getEBMSStatus(movement);
                        return (
                          <tr key={movement.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedMovements.includes(
                                  movement.id,
                                )}
                                onChange={() => handleSelectOne(movement.id)}
                              />
                            </td>
                            <td>{movement.movement_number || "-"}</td>
                            <td>
                              {new Date(
                                movement.movement_date,
                              ).toLocaleString()}
                            </td>
                            <td>
                              <span
                                className="movement-type-badge"
                                style={{
                                  backgroundColor:
                                    movementTypes[movement.movement_type]
                                      ?.color + "20",
                                  color:
                                    movementTypes[movement.movement_type]
                                      ?.color,
                                }}
                              >
                                {movementTypes[movement.movement_type]?.icon}{" "}
                                {movementTypes[movement.movement_type]?.label}
                              </span>
                            </td>
                            <td>
                              <strong>{movement.product_name}</strong>
                            </td>
                            <td
                              className={
                                movement.movement_type?.startsWith("S")
                                  ? "negative-quantity"
                                  : "positive-quantity"
                              }
                            >
                              {movement.quantity?.toLocaleString() || 0}{" "}
                              {movement.unit || ""}
                            </td>
                            <td>
                              {movement.unit_cost
                                ? movement.unit_cost.toLocaleString()
                                : "0"}{" "}
                              FBu
                            </td>
                            <td>
                              {movement.total_cost
                                ? movement.total_cost.toLocaleString()
                                : "0"}{" "}
                              FBu
                            </td>
                            <td>{movement.warehouse_name}</td>
                            <td>
                              <span
                                className="ebms-status"
                                style={{ color: ebmsStatus.color }}
                              >
                                {ebmsStatus.icon} {ebmsStatus.label}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons">
                                <Tippy
                                  content={t("view_details")}
                                  placement="top"
                                  animation="scale"
                                >
                                  <button
                                    className="btn-icon view"
                                    onClick={() => viewMovementDetail(movement)}
                                  >
                                    👁️
                                  </button>
                                </Tippy>
                                <Tippy
                                  content={t("attachments")}
                                  placement="top"
                                  animation="scale"
                                >
                                  <button
                                    className="btn-icon attach"
                                    onClick={() => viewAttachments(movement)}
                                  >
                                    📎
                                  </button>
                                </Tippy>
                                {(movement.movement_type === "ST" ||
                                  movement.movement_type === "ET") && (
                                  <Tippy
                                    content={t("generate_receipt")}
                                    placement="top"
                                    animation="scale"
                                  >
                                    <button
                                      className="btn-icon receipt"
                                      onClick={() =>
                                        generateTransferReceipt(movement)
                                      }
                                    >
                                      🧾
                                    </button>
                                  </Tippy>
                                )}
                                <Tippy
                                  content={t("add_attachments")}
                                  placement="top"
                                  animation="scale"
                                >
                                  <button
                                    className="btn-icon add-attach"
                                    onClick={() =>
                                      openAddAttachmentModal(movement)
                                    }
                                  >
                                    📎+
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

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="pagination" style={{ marginBottom: "16px" }}>
                    <button
                      onClick={() => loadData(appliedFilters, 1)}
                      disabled={currentPage === 1}
                    >
                      «
                    </button>
                    <button
                      onClick={() => loadData(appliedFilters, currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      ‹
                    </button>
                    <span className="page-info">
                      {t("page")} {currentPage} {t("of")} {totalPages}
                    </span>
                    <button
                      onClick={() => loadData(appliedFilters, currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      ›
                    </button>
                    <button
                      onClick={() => loadData(appliedFilters, totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      »
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* GRAPHIQUES ET ANALYTIQUES */}
      <div className="charts-section">
        <div className={`chart-card ${isDark ? "dark" : "light"}`}>
          <h3>{t("movement_type_comparison")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={getMovementTypeComparisonData()}
              layout="vertical"
              margin={{ left: 80 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "#334155" : "#e2e8f0"}
              />
              <XAxis type="number" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis
                type="category"
                dataKey="type"
                width={100}
                stroke={isDark ? "#94a3b8" : "#64748b"}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  color: isDark ? "#f1f5f9" : "#1e293b",
                }}
              />
              <Legend
                wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }}
              />
              <Bar dataKey="entries" fill="#10b981" name={t("entries")} />
              <Bar dataKey="exits" fill="#ef4444" name={t("exits")} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`chart-card ${isDark ? "dark" : "light"}`}>
          <div className="chart-header">
            <h3>{t("movement_trend")}</h3>
            <select
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value)}
              style={{
                background: isDark ? "#1e293b" : "#ffffff",
                color: isDark ? "#f1f5f9" : "#1e293b",
                borderColor: isDark ? "#334155" : "#e2e8f0",
              }}
            >
              <option value="week">{t("last_7_days")}</option>
              <option value="month">{t("last_12_months")}</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getChartData()}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "#334155" : "#e2e8f0"}
              />
              <XAxis dataKey="date" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  color: isDark ? "#f1f5f9" : "#1e293b",
                }}
              />
              <Legend
                wrapperStyle={{ color: isDark ? "#94a3b8" : "#64748b" }}
              />
              <Line
                type="monotone"
                dataKey="entries"
                stroke="#10b981"
                name={t("entries")}
              />
              <Line
                type="monotone"
                dataKey="exits"
                stroke="#ef4444"
                name={t("exits")}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`chart-card ${isDark ? "dark" : "light"}`}>
          <h3>{t("stock_distribution")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getPieChartData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {getPieChartData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  color: isDark ? "#f1f5f9" : "#1e293b",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`warehouse-stock-chart ${isDark ? "dark" : "light"}`}>
        <h3>{t("stock_by_warehouse")}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={getWarehouseStockData()}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} />
            <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
            <Tooltip
              contentStyle={{
                background: isDark ? "#1e293b" : "#ffffff",
                borderColor: isDark ? "#334155" : "#e2e8f0",
                color: isDark ? "#f1f5f9" : "#1e293b",
              }}
            />
            <Bar dataKey="stock" fill="#667eea" name={t("stock_quantity")} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* STOCK SUMMARY */}
      <div className="summary-section">
        <h3>{t("stock_summary")}</h3>
        <div className="summary-search-row">
          <input
            type="text"
            value={summarySearch}
            onChange={(e) => setSummarySearch(e.target.value)}
            placeholder={`${t("filter_name_placeholder")} / ${t("filter_code_placeholder")}`}
            className="summary-search-input"
            aria-label={t("filter_products")}
          />
        </div>
        <div className="stock-summary-scroll">
          {filteredStockSummary.length === 0 ? (
            <div className="empty-state">{t("no_products_match_filters")}</div>
          ) : (
            <div className="stock-summary-grid">
              {filteredStockSummary.map((item) => {
                const status = getStockStatus(
                  item.quantity,
                  item.min_stock_alert,
                );
                return (
                  <div
                    key={item.id}
                    className={`stock-summary-card ${isDark ? "dark" : "light"}`}
                  >
                    <div className="summary-product-name">{item.name}</div>
                    <div className="summary-quantity">
                      <span className="quantity-value">
                        {Math.round(item.quantity)}
                      </span>
                      <span className="quantity-unit">
                        {item.unit}
                        {item.quantity > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="summary-value">
                      {(item.quantity * item.selling_price).toLocaleString()}{" "}
                      FBu
                    </div>
                    <div
                      className="summary-status"
                      style={{ color: status.color }}
                    >
                      {status.icon} {status.label}
                    </div>
                    <div className="summary-warehouse">
                      {item.warehouse_name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL AJOUTER PIÈCES JOINTES */}
      {addAttachmentModalOpen && selectedMovementForAttachment && (
        <div
          className="modal-overlay"
          onClick={() => setAddAttachmentModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📎</span>
              <h3>
                {t("add_attachments_to")}:{" "}
                {selectedMovementForAttachment.movement_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setAddAttachmentModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="attachments-section">
                <label>{t("select_files")}</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    onChange={handleNewAttachmentUpload}
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
                    📎 {t("choose_files")}
                  </button>
                  <div className="file-list">
                    {newAttachments.map((file) => (
                      <div key={file.id} className="file-item">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                          {(file.size / 1024).toFixed(2)} KB
                        </span>
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={() => removeNewAttachment(file.id)}
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
                className="btn-secondary"
                onClick={() => setAddAttachmentModalOpen(false)}
                disabled={uploadingAttachments}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={uploadAttachments}
                disabled={uploadingAttachments || newAttachments.length === 0}
              >
                {uploadingAttachments ? (
                  <span className="btn-spinner"></span>
                ) : (
                  t("upload")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOUVEMENT DE STOCK */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📦</span>
              <h3>{t("new_movement")}</h3>
              <button className="modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required">{t("movement_type")}</label>
                    <select
                      value={formData.movement_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          movement_type: e.target.value,
                        })
                      }
                      required
                    >
                      <optgroup label={t("entries")}>
                        <option value="EN">📥 {t("entry_normal")}</option>
                        <option value="ER">🔄 {t("entry_return")}</option>
                        <option value="EI">📋 {t("entry_inventory")}</option>
                        <option value="EAJ">⚙️ {t("entry_adjustment")}</option>
                        <option value="ET">🚚 {t("entry_transfer")}</option>
                        <option value="EAU">📦 {t("entry_other")}</option>
                      </optgroup>
                      <optgroup label={t("exits")}>
                        <option value="SN">📤 {t("exit_normal")}</option>
                        <option value="SP">⚠️ {t("exit_loss")}</option>
                        <option value="SV">🚨 {t("exit_theft")}</option>
                        <option value="SD">⏰ {t("exit_obsolete")}</option>
                        <option value="SC">💔 {t("exit_damage")}</option>
                        <option value="SAJ">⚙️ {t("exit_adjustment")}</option>
                        <option value="ST">🚚 {t("exit_transfer")}</option>
                        <option value="SAU">📤 {t("exit_other")}</option>
                      </optgroup>
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
                      required
                      className="select-filter"
                      classNamePrefix="select"
                      placeholder={t("select_warehouse")}
                      styles={{
                        control: (base) => ({
                          ...base,
                          background: isDark ? "#1e293b" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                        }),
                        menu: (base) => ({
                          ...base,
                          background: isDark ? "#1e293b" : "#ffffff",
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
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: isDark ? "#f1f5f9" : "#1e293b",
                        }),
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("date")}</label>
                    <input
                      type="datetime-local"
                      value={formData.movement_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          movement_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("reference")}</label>
                    <input
                      type="text"
                      value={formData.reference}
                      onChange={(e) =>
                        setFormData({ ...formData, reference: e.target.value })
                      }
                      placeholder={t("reference_placeholder")}
                    />
                  </div>
                </div>

                <div className="items-section">
                  <div className="items-header">
                    <h4>{t("products_list")}</h4>
                    <button
                      type="button"
                      className="btn-add-item"
                      onClick={addMovementItem}
                    >
                      ➕ {t("add_product")}
                    </button>
                  </div>
                  <div className="items-table">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th className="required">{t("product")}</th>
                          <th className="quantity-col required">
                            {t("quantity")}{" "}
                          </th>
                          <th className="cost-col">{t("unit_cost")} (FBu)</th>
                          <th className="total-col">{t("total")} (FBu)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementItems.map((item) => {
                          const isDuplicate =
                            item.product_id &&
                            checkMovementProductDuplicate(
                              item.product_id,
                              item.id,
                            );
                          return (
                            <tr
                              key={item.id}
                              className={isDuplicate ? "duplicate-row" : ""}
                            >
                              <td>
                                <Select
                                  options={productOptions}
                                  value={productOptions.find(
                                    (p) => p.value === item.product_id,
                                  )}
                                  onChange={(val) =>
                                    updateMovementItem(
                                      item.id,
                                      "product_id",
                                      val?.value,
                                    )
                                  }
                                  className="select-product"
                                  classNamePrefix="select"
                                  placeholder={t("select_product")}
                                  menuPortalTarget={document.body} // ← AJOUTER CETTE LIGNE
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      background: isDark
                                        ? "#1e293b"
                                        : "#ffffff",
                                      borderColor: isDark
                                        ? "#334155"
                                        : "#e2e8f0",
                                      minWidth: "200px",
                                    }),
                                    menu: (base) => ({
                                      ...base,
                                      background: isDark
                                        ? "#1e293b"
                                        : "#ffffff",
                                      zIndex: 9999, // ← AJOUTER
                                    }),
                                    menuPortal: (base) => ({
                                      // ← AJOUTER
                                      ...base,
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
                                    }),
                                    singleValue: (base) => ({
                                      ...base,
                                      color: isDark ? "#f1f5f9" : "#1e293b",
                                    }),
                                  }}
                                />

                                {isDuplicate && (
                                  <div className="error-hint">
                                    {t("product_already_added")}
                                  </div>
                                )}
                                {item.available_stock > 0 && (
                                  <div className="stock-hint">
                                    📦 {t("available_stock")}:{" "}
                                    {item.available_stock}
                                  </div>
                                )}
                              </td>
                              <td className="quantity-cell">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateMovementItem(
                                      item.id,
                                      "quantity",
                                      parseFloat(e.target.value),
                                    )
                                  }
                                  className={
                                    item.quantity <= 0 ? "error-input" : ""
                                  }
                                  required
                                />
                              </td>
                              <td className="cost-cell">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_cost}
                                  onChange={(e) =>
                                    updateMovementItem(
                                      item.id,
                                      "unit_cost",
                                      parseFloat(e.target.value),
                                    )
                                  }
                                />
                              </td>
                              <td className="total-cell">
                                {item.total.toLocaleString()}{" "}
                              </td>
                              <td>
                                {movementItems.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn-remove-item"
                                    onClick={() => removeMovementItem(item.id)}
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3" className="total-label">
                            {t("grand_total")}{" "}
                          </td>
                          <td className="grand-total">
                            {movementItems
                              .reduce((sum, item) => sum + item.total, 0)
                              .toLocaleString()}{" "}
                            FBu{" "}
                          </td>
                          <td> </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* SECTION PIÈCES JOINTES */}
                <div className="attachments-section">
                  <label>{t("attachments")}</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      className="file-input"
                    />
                    <button
                      type="button"
                      className="btn-upload"
                      onClick={() => fileInputRef.current.click()}
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
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>{t("description")}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows="3"
                    placeholder={t("description_placeholder")}
                    className="notes-textarea"
                  />
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
                  ) : (
                    t("save")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRANSFERT MULTI-PRODUITS */}
      {transferModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setTransferModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">🚚</span>
              <h3>{t("internal_transfer")}</h3>
              <button
                className="modal-close"
                onClick={() => setTransferModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required">{t("from_warehouse")} </label>
                    <Select
                      options={warehouseOptions}
                      value={transferData.from_warehouse_id}
                      onChange={(val) =>
                        setTransferData({
                          ...transferData,
                          from_warehouse_id: val,
                        })
                      }
                      required
                      className="select-filter"
                      classNamePrefix="select"
                      placeholder={t("select_warehouse")}
                      styles={{
                        control: (base) => ({
                          ...base,
                          background: isDark ? "#1e293b" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                        }),
                        menu: (base) => ({
                          ...base,
                          background: isDark ? "#1e293b" : "#ffffff",
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
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: isDark ? "#f1f5f9" : "#1e293b",
                        }),
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="required">{t("to_warehouse")} </label>
                    <Select
                      options={warehouseOptions}
                      value={transferData.to_warehouse_id}
                      onChange={(val) =>
                        setTransferData({
                          ...transferData,
                          to_warehouse_id: val,
                        })
                      }
                      required
                      className="select-filter"
                      classNamePrefix="select"
                      placeholder={t("select_warehouse")}
                      styles={{
                        control: (base) => ({
                          ...base,
                          background: isDark ? "#1e293b" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                        }),
                        menu: (base) => ({
                          ...base,
                          background: isDark ? "#1e293b" : "#ffffff",
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
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: isDark ? "#f1f5f9" : "#1e293b",
                        }),
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("transfer_date")}</label>
                    <input
                      type="datetime-local"
                      value={transferData.transfer_date}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          transfer_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("reference_doc")}</label>
                    <input
                      type="text"
                      value={transferData.reference_doc}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          reference_doc: e.target.value,
                        })
                      }
                      placeholder={t("reference_placeholder")}
                    />
                  </div>
                </div>

                <div className="items-section">
                  <div className="items-header">
                    <h4>{t("products_to_transfer")}</h4>
                    <button
                      type="button"
                      className="btn-add-item"
                      onClick={addTransferItem}
                    >
                      ➕ {t("add_product")}
                    </button>
                  </div>
                  <div className="items-table">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th className="required">{t("product")} </th>
                          <th className="quantity-col required">
                            {t("quantity")}{" "}
                          </th>
                          <th>{t("available_stock")}</th>
                          <th>{t("status")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferItems.map((item) => {
                          const selectedProduct = productOptions.find(
                            (p) => p.value === item.product_id,
                          );
                          const isDuplicate = checkTransferProductDuplicate(
                            item.product_id,
                            item.id,
                          );
                          return (
                            <tr
                              key={item.id}
                              className={
                                item.error
                                  ? "error-row"
                                  : isDuplicate
                                    ? "duplicate-row"
                                    : ""
                              }
                            >
                              <td>
                                <Select
                                  options={productOptions}
                                  value={productOptions.find(
                                    (p) => p.value === item.product_id,
                                  )}
                                  onChange={async (val) => {
                                    updateTransferItem(
                                      item.id,
                                      "product_id",
                                      val?.value,
                                    );
                                    if (
                                      val?.value &&
                                      transferData.from_warehouse_id
                                    ) {
                                      await updateTransferStock(
                                        val.value,
                                        transferData.from_warehouse_id.value,
                                        item.id,
                                      );
                                    }
                                  }}
                                  className="select-product"
                                  classNamePrefix="select"
                                  placeholder={t("select_product")}
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      background: isDark
                                        ? "#1e293b"
                                        : "#ffffff",
                                      borderColor: isDark
                                        ? "#334155"
                                        : "#e2e8f0",
                                      minWidth: "200px",
                                    }),
                                    menu: (base) => ({
                                      ...base,
                                      background: isDark
                                        ? "#1e293b"
                                        : "#ffffff",
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
                                    }),
                                    singleValue: (base) => ({
                                      ...base,
                                      color: isDark ? "#f1f5f9" : "#1e293b",
                                    }),
                                  }}
                                />
                                {isDuplicate && (
                                  <div className="error-hint">
                                    {t("product_already_added")}
                                  </div>
                                )}
                              </td>
                              <td className="quantity-cell">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateTransferItem(
                                      item.id,
                                      "quantity",
                                      parseFloat(e.target.value),
                                    )
                                  }
                                  className={item.error ? "error-input" : ""}
                                  required
                                  disabled={!item.product_id}
                                />
                              </td>
                              <td>
                                <span className="available-stock">
                                  {item.available_stock} {selectedProduct?.unit}
                                </span>
                              </td>
                              <td>
                                {item.error ? (
                                  <span className="status-error">
                                    ❌ {item.error}
                                  </span>
                                ) : item.quantity > 0 ? (
                                  <span className="status-success">
                                    ✅ {t("available")}
                                  </span>
                                ) : (
                                  <span className="status-pending">
                                    ⏳ {t("select_quantity")}
                                  </span>
                                )}
                              </td>
                              <td>
                                {transferItems.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn-remove-item"
                                    onClick={() => removeTransferItem(item.id)}
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4" className="total-label">
                            {t("total_items")}{" "}
                          </td>
                          <td className="grand-total">
                            {transferItems.length}{" "}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>{t("description")}</label>
                  <textarea
                    value={transferData.description}
                    onChange={(e) =>
                      setTransferData({
                        ...transferData,
                        description: e.target.value,
                      })
                    }
                    rows="3"
                    placeholder={t("transfer_description")}
                    className="notes-textarea"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setTransferModalOpen(false)}
                  disabled={transferLoading}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    transferLoading || transferItems.some((i) => i.error)
                  }
                >
                  {transferLoading ? (
                    <span className="btn-spinner"></span>
                  ) : (
                    t("confirm_transfer")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL DÉTAILS MOUVEMENT */}
      {movementDetailModalOpen && selectedMovement && (
        <div
          className="modal-overlay"
          onClick={() => setMovementDetailModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📄</span>
              <h3>{t("movement_details")}</h3>
              <button
                className="modal-close"
                onClick={() => setMovementDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">{t("movement_number")}:</span>
                  <span className="detail-value">
                    {selectedMovement.movement_number}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("date")}:</span>
                  <span className="detail-value">
                    {new Date(selectedMovement.movement_date).toLocaleString()}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("movement_type")}:</span>
                  <span className="detail-value">
                    {movementTypes[selectedMovement.movement_type]?.icon}{" "}
                    {movementTypes[selectedMovement.movement_type]?.label}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("product")}:</span>
                  <span className="detail-value">
                    {selectedMovement.product_name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("quantity")}:</span>
                  <span className="detail-value">
                    {selectedMovement.quantity} {selectedMovement.unit}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("unit_cost")}:</span>
                  <span className="detail-value">
                    {selectedMovement.unit_cost?.toLocaleString()} FBu
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("total_value")}:</span>
                  <span className="detail-value">
                    {selectedMovement.total_cost?.toLocaleString()} FBu
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("warehouse")}:</span>
                  <span className="detail-value">
                    {selectedMovement.warehouse_name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("created_by")}:</span>
                  <span className="detail-value">
                    {selectedMovement.user_name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("reference")}:</span>
                  <span className="detail-value">
                    {selectedMovement.reference || "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("description")}:</span>
                  <span className="detail-value">
                    {selectedMovement.description || "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("ebms_status")}:</span>
                  <span className="detail-value">
                    {getEBMSStatus(selectedMovement).label}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setMovementDetailModalOpen(false)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PIÈCES JOINTES */}
      {attachmentsModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setAttachmentsModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📎</span>
              <h3>{t("attachments")}</h3>
              <button
                className="modal-close"
                onClick={() => setAttachmentsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {attachments.length === 0 ? (
                <p className="no-attachments">{t("no_attachments")}</p>
              ) : (
                <div className="attachments-list">
                  {attachments.map((att, idx) => (
                    <div key={att.id || idx} className="attachment-item">
                      <div className="attachment-info">
                        <span className="attachment-name">
                          {att.original_name}
                        </span>
                        <span className="attachment-size">
                          {(att.file_size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                      {att.mime_type?.startsWith("image/") && (
                        <iframe
                          src={att.download_url}
                          className="attachment-preview"
                          title={att.original_name}
                        />
                      )}
                      <div className="attachment-actions">
                        <a
                          href={att.download_url}
                          download
                          className="btn-download"
                        >
                          {t("download")}
                        </a>
                        <button
                          className="btn-delete-attachment"
                          onClick={() => deleteAttachment(att.id)}
                        >
                          🗑️ {t("delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setAttachmentsModalOpen(false)}
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
              <span className="modal-icon">🔍</span>
              <h3>{t("filter_movements")}</h3>
              <button
                className="modal-close"
                onClick={() => setFilterModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("code")}</label>
                <input
                  type="text"
                  value={filters.movement_number}
                  onChange={(e) =>
                    setFilters({ ...filters, movement_number: e.target.value })
                  }
                  placeholder={t("movement_code")}
                />
              </div>
              <div className="form-group">
                <label>{t("product")}</label>
                <Select
                  options={productOptions}
                  value={filters.product_id}
                  onChange={(val) =>
                    setFilters({ ...filters, product_id: val })
                  }
                  isClearable
                  className="select-filter"
                  classNamePrefix="select"
                  placeholder={t("all_products")}
                  styles={{
                    control: (base) => ({
                      ...base,
                      background: isDark ? "#1e293b" : "#ffffff",
                      borderColor: isDark ? "#334155" : "#e2e8f0",
                    }),
                    menu: (base) => ({
                      ...base,
                      background: isDark ? "#1e293b" : "#ffffff",
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
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: isDark ? "#f1f5f9" : "#1e293b",
                    }),
                  }}
                />
              </div>
              <div className="form-group">
                <label>{t("movement_type")}</label>
                <select
                  value={filters.movement_type}
                  onChange={(e) =>
                    setFilters({ ...filters, movement_type: e.target.value })
                  }
                >
                  <option value="">{t("all_types")}</option>
                  {Object.entries(movementTypes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.icon} {value.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t("warehouse")}</label>
                <Select
                  options={warehouseOptions}
                  value={filters.warehouse_id}
                  onChange={(val) =>
                    setFilters({ ...filters, warehouse_id: val })
                  }
                  isClearable
                  className="select-filter"
                  classNamePrefix="select"
                  placeholder={t("all_warehouses")}
                  styles={{
                    control: (base) => ({
                      ...base,
                      background: isDark ? "#1e293b" : "#ffffff",
                      borderColor: isDark ? "#334155" : "#e2e8f0",
                    }),
                    menu: (base) => ({
                      ...base,
                      background: isDark ? "#1e293b" : "#ffffff",
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
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: isDark ? "#f1f5f9" : "#1e293b",
                    }),
                  }}
                />
              </div>
              <div className="form-group">
                <label>{t("date_from")}</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) =>
                    setFilters({ ...filters, date_from: e.target.value })
                  }
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
                />
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

      {/* MODAL GESTION DES ENTREPÔTS */}
      {warehouseModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setWarehouseModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">🏪</span>
              <h3>
                {editingWarehouse ? t("edit_warehouse") : t("new_warehouse")}
              </h3>
              <button
                className="modal-close"
                onClick={() => setWarehouseModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleWarehouseSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required">{t("name")} </label>
                    <input
                      type="text"
                      value={warehouseFormData.name}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("location")}</label>
                    <input
                      type="text"
                      value={warehouseFormData.location}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          location: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("manager_name")}</label>
                    <input
                      type="text"
                      value={warehouseFormData.manager_name}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          manager_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("phone")}</label>
                    <input
                      type="tel"
                      value={warehouseFormData.phone}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("email")}</label>
                    <input
                      type="email"
                      value={warehouseFormData.email}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("status")}</label>
                    <select
                      value={warehouseFormData.is_active}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          is_active: e.target.value === "true",
                        })
                      }
                    >
                      <option value="true">{t("active")}</option>
                      <option value="false">{t("inactive")}</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>{t("description")}</label>
                    <textarea
                      value={warehouseFormData.description}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          description: e.target.value,
                        })
                      }
                      rows="2"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setWarehouseModalOpen(false)}
                  disabled={warehouseLoading}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={warehouseLoading}
                >
                  {warehouseLoading ? (
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

      {/* MODAL CRÉATION DE RÉSERVATION */}
      {reservationModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setReservationModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📅</span>
              <h3>{t("new_reservation")}</h3>
              <button
                className="modal-close"
                onClick={() => setReservationModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleReservationSubmit}>
              <div className="modal-body">
                <div className="form-section">
                  <h4>{t("general_info")}</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">{t("customer")} </label>
                      <Select
                        options={customerOptions}
                        value={selectedCustomer}
                        onChange={setSelectedCustomer}
                        className="select-filter"
                        classNamePrefix="select"
                        placeholder={t("select_customer")}
                        isClearable
                        styles={{
                          control: (base) => ({
                            ...base,
                            background: isDark ? "#1e293b" : "#ffffff",
                            borderColor: isDark ? "#334155" : "#e2e8f0",
                          }),
                          menu: (base) => ({
                            ...base,
                            background: isDark ? "#1e293b" : "#ffffff",
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
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: isDark ? "#f1f5f9" : "#1e293b",
                          }),
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("priority")}</label>
                      <select
                        value={reservationFormData.priority}
                        onChange={(e) =>
                          setReservationFormData({
                            ...reservationFormData,
                            priority: e.target.value,
                          })
                        }
                      >
                        <option value="low">🟢 {t("priority_low")}</option>
                        <option value="normal">
                          🟡 {t("priority_normal")}
                        </option>
                        <option value="high">🟠 {t("priority_high")}</option>
                        <option value="urgent">
                          🔴 {t("priority_urgent")}
                        </option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t("reservation_date")}</label>
                      <input
                        type="datetime-local"
                        value={reservationFormData.reservation_date}
                        onChange={(e) =>
                          setReservationFormData({
                            ...reservationFormData,
                            reservation_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("expected_delivery_date")}</label>
                      <input
                        type="datetime-local"
                        value={reservationFormData.expected_delivery_date}
                        onChange={(e) =>
                          setReservationFormData({
                            ...reservationFormData,
                            expected_delivery_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>{t("products_to_reserve")}</h4>
                  <div className="items-header">
                    <button
                      type="button"
                      className="btn-add-item"
                      onClick={addReservationItem}
                    >
                      ➕ {t("add_product")}
                    </button>
                  </div>
                  <div className="items-table">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th className="required">{t("product")} </th>
                          <th className="quantity-col required">
                            {t("quantity")}{" "}
                          </th>
                          <th className="price-col">{t("unit_price")} (FBu)</th>
                          <th className="tax-col">VAT %</th>
                          <th className="total-col">{t("total")} (FBu)</th>
                          <th>{t("available_stock")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservationItems.map((item) => {
                          const selectedProduct = productOptions.find(
                            (p) => p.value === item.product_id,
                          );
                          const isStockInsufficient =
                            item.quantity >
                            (selectedProduct?.current_stock || 0);
                          return (
                            <tr
                              key={item.id}
                              className={
                                isStockInsufficient ? "warning-row" : ""
                              }
                            >
                              <td className="product-cell">
                                <Select
                                  options={productOptions}
                                  value={productOptions.find(
                                    (p) => p.value === item.product_id,
                                  )}
                                  onChange={(val) =>
                                    updateReservationItem(
                                      item.id,
                                      "product_id",
                                      val?.value,
                                    )
                                  }
                                  className="select-product"
                                  classNamePrefix="select"
                                  placeholder={t("select_product")}
                                  isClearable
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      background: isDark
                                        ? "#1e293b"
                                        : "#ffffff",
                                      borderColor: isDark
                                        ? "#334155"
                                        : "#e2e8f0",
                                      minWidth: "200px",
                                    }),
                                    menu: (base) => ({
                                      ...base,
                                      background: isDark
                                        ? "#1e293b"
                                        : "#ffffff",
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
                                    }),
                                    singleValue: (base) => ({
                                      ...base,
                                      color: isDark ? "#f1f5f9" : "#1e293b",
                                    }),
                                    menuPortal: (base) => ({
                                      ...base,
                                      zIndex: 10001,
                                    }),
                                  }}
                                  menuPortalTarget={document.body}
                                  menuPosition="fixed"
                                />
                              </td>
                              <td className="quantity-cell">
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={item.quantity || ""}
                                  onChange={(e) => {
                                    const val =
                                      e.target.value === ""
                                        ? ""
                                        : parseInt(e.target.value, 10);
                                    if (val === 0) return;
                                    updateReservationItem(
                                      item.id,
                                      "quantity",
                                      val,
                                    );
                                  }}
                                  className={
                                    isStockInsufficient ? "error-input" : ""
                                  }
                                  required
                                />
                              </td>
                              <td className="price-cell">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_price || 0}
                                  onChange={(e) =>
                                    updateReservationItem(
                                      item.id,
                                      "unit_price",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </td>
                              <td className="tax-cell">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={item.tax_rate || 0}
                                  onChange={(e) =>
                                    updateReservationItem(
                                      item.id,
                                      "tax_rate",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </td>
                              <td className="total-cell">
                                {item.total.toLocaleString()} FBu
                              </td>
                              <td className="stock-cell">
                                <span
                                  className={`available-stock ${isStockInsufficient ? "stock-warning" : ""}`}
                                >
                                  {selectedProduct?.current_stock || 0}{" "}
                                  {selectedProduct?.unit}
                                </span>
                              </td>
                              <td className="action-cell">
                                {reservationItems.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn-remove-item"
                                    onClick={() =>
                                      removeReservationItem(item.id)
                                    }
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3" className="total-label">
                            {t("grand_total")}{" "}
                          </td>
                          <td className="grand-total">
                            {reservationItems
                              .reduce((sum, item) => sum + (item.total || 0), 0)
                              .toLocaleString()}{" "}
                            FBu
                          </td>
                          <td colSpan="2"> </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="form-section">
                  <h4>{t("attachments")}</h4>
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

                <div className="form-section">
                  <h4>{t("notes")}</h4>
                  <textarea
                    value={reservationFormData.notes}
                    onChange={(e) =>
                      setReservationFormData({
                        ...reservationFormData,
                        notes: e.target.value,
                      })
                    }
                    rows="3"
                    placeholder={t("reservation_notes")}
                    className="notes-textarea"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReservationModalOpen(false)}
                  disabled={submittingReservation}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    submittingReservation ||
                    !selectedCustomer ||
                    reservationItems.every((i) => !i.product_id)
                  }
                >
                  {submittingReservation ? (
                    <span className="btn-spinner"></span>
                  ) : (
                    t("create_reservation")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DÉTAIL RÉSERVATION */}
      {reservationDetailModalOpen && selectedReservation && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={() => setReservationDetailModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">📄</span>
              <h3>
                {t("reservation_details")} -{" "}
                {selectedReservation.reservation_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setReservationDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>{t("general_info")}</h4>
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">{t("customer")}:</span>
                    <span className="detail-value">
                      {selectedReservation.customer_name}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">
                      {t("reservation_date")}:
                    </span>
                    <span className="detail-value">
                      {new Date(
                        selectedReservation.reservation_date,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">
                      {t("expected_delivery_date")}:
                    </span>
                    <span className="detail-value">
                      {selectedReservation.expected_delivery_date
                        ? new Date(
                            selectedReservation.expected_delivery_date,
                          ).toLocaleString()
                        : "-"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t("status")}:</span>
                    <span
                      className={`status-badge status-${selectedReservation.status}`}
                    >
                      {selectedReservation.status}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t("priority")}:</span>
                    <span
                      className={`priority-badge priority-${selectedReservation.priority}`}
                    >
                      {selectedReservation.priority}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t("notes")}:</span>
                    <span className="detail-value">
                      {selectedReservation.notes || "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>{t("products_list")}</h4>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("product")}</th>
                        <th>{t("quantity")}</th>
                        <th>{t("delivered")}</th>
                        <th>{t("remaining")}</th>
                        <th>{t("unit_price")}</th>
                        <th>{t("total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReservation.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.product_name}</td>
                          <td>
                            {item.quantity} {item.unit}
                          </td>
                          <td>
                            {item.delivered_quantity || 0} {item.unit}
                          </td>
                          <td className="remaining">
                            {item.quantity - (item.delivered_quantity || 0)}{" "}
                            {item.unit}
                          </td>
                          <td>{item.unit_price?.toLocaleString()} FBu</td>
                          <td>
                            {(item.unit_price * item.quantity).toLocaleString()}{" "}
                            FBu
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="5" className="total-label">
                          {t("grand_total")}{" "}
                        </td>
                        <td className="grand-total">
                          {selectedReservation.items
                            ?.reduce(
                              (sum, i) => sum + i.unit_price * i.quantity,
                              0,
                            )
                            .toLocaleString()}{" "}
                          FBu
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedReservation.attachments?.length > 0 && (
                <div className="detail-section">
                  <h4>{t("attachments")}</h4>
                  <div className="attachments-list">
                    {selectedReservation.attachments.map((att, idx) => (
                      <div key={idx} className="attachment-item">
                        <span className="attachment-name">
                          {att.original_name}
                        </span>
                        <a
                          href={att.download_url}
                          download
                          className="btn-download"
                        >
                          {t("download")}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setReservationDetailModalOpen(false)}
              >
                {t("close")}
              </button>
              {selectedReservation?.status === "partially_delivered" && (
                <button
                  className="btn-secondary"
                  onClick={() => openCompletePreview(selectedReservation)}
                >
                  🔎 {t("preview_complete_by_delivered")}
                </button>
              )}
              {selectedReservation?.status === "partially_delivered" && (
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    const confirmed = await confirm.save(
                      t("confirm_complete_by_delivered"),
                    );
                    if (!confirmed) return;
                    try {
                      await reservationService.completeByDelivered(
                        selectedReservation.id,
                      );
                      toast.success(t("reservation_finalized_by_delivered"));
                      await loadReservations();
                      setReservationDetailModalOpen(false);
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
              )}
              <button
                className="btn-primary"
                onClick={() => {
                  setReservationDetailModalOpen(false);
                  setTimeout(() => openDeliveryModal(selectedReservation), 100);
                }}
              >
                🚚 {t("deliver")}
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
                    await reservationService.completeByDelivered(
                      completePreviewReservation.id,
                    );
                    toast.success(t("reservation_finalized_by_delivered"));
                    await loadReservations();
                    setCompletePreviewModalOpen(false);
                    setReservationDetailModalOpen(false);
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

      {/* MODAL LIVRAISON */}
      {deliveryModalOpen && selectedReservation && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1200 }}
          onClick={() => setDeliveryModalOpen(false)}
        >
          <div
            className={`modal-container ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">🚚</span>
              <h3>
                {t("delivery")} - {selectedReservation.reservation_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setDeliveryModalOpen(false)}
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
                      <th>{t("reserved")}</th>
                      <th>{t("already_delivered")}</th>
                      <th>{t("remaining")}</th>
                      <th>{t("to_deliver")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryItems.map((item, index) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td>{item.reserved_quantity}</td>
                        <td>{item.delivered_quantity}</td>
                        <td>{item.remaining_quantity}</td>
                        <td>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={item.remaining_quantity}
                            value={item.to_deliver}
                            onChange={(e) =>
                              updateDeliveryItem(
                                index,
                                parseFloat(e.target.value) || 0,
                              )
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
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDeliveryModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="btn-primary"
                onClick={submitDelivery}
                disabled={deliveryItems.every((item) => item.to_deliver === 0)}
              >
                🚚 {t("confirm_delivery")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LISTE DES RÉSERVATIONS */}
      {reservationsListModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setReservationsListModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon">📋</span>
              <h3>{t("reservations_list")}</h3>
              <button
                className="modal-close"
                onClick={() => setReservationsListModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-search-bar">
                <input
                  type="text"
                  value={reservationSearch}
                  onChange={(e) => setReservationSearch(e.target.value)}
                  placeholder={t("search_reservations")}
                  className="search-input"
                />
              </div>
              {filteredReservations.length === 0 ? (
                <p className="no-data">{t("no_reservations")}</p>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("reservation_number")}</th>
                          <th>{t("customer")}</th>
                          <th>{t("date")}</th>
                          <th>{t("status")}</th>
                          <th>{t("priority")}</th>
                          <th>{t("total")}</th>
                          <th>{t("actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReservations.map((res) => {
                          const total =
                            res.items?.reduce(
                              (sum, i) => sum + (i.total_price || 0),
                              0,
                            ) || 0;
                          return (
                            <tr key={res.id}>
                              <td className="res-number">
                                {res.reservation_number}
                              </td>
                              <td>{res.customer_name}</td>
                              <td>
                                {new Date(
                                  res.reservation_date,
                                ).toLocaleDateString()}
                              </td>
                              <td>
                                <span
                                  className={`status-badge status-${res.status}`}
                                >
                                  {res.status}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`priority-badge priority-${res.priority}`}
                                >
                                  {res.priority}
                                </span>
                              </td>
                              <td>{total.toLocaleString()} FBu</td>
                              <td>
                                <div className="action-buttons">
                                  <button
                                    className="btn-icon view"
                                    onClick={() => viewReservationDetail(res)}
                                    title={t("view_details")}
                                  >
                                    👁️
                                  </button>
                                  <button
                                    className="btn-icon edit"
                                    onClick={() => openDeliveryModal(res)}
                                    title={t("deliver")}
                                  >
                                    🚚
                                  </button>
                                  {res.status === "partially_delivered" && (
                                    <>
                                      <button
                                        className="btn-action preview"
                                        onClick={() => openCompletePreview(res)}
                                        title={t(
                                          "preview_complete_by_delivered",
                                        )}
                                      >
                                        {t("preview_complete_by_delivered")}
                                      </button>
                                      <button
                                        className="btn-icon secondary"
                                        onClick={async () => {
                                          const confirmed = await confirm.save(
                                            t("confirm_complete_by_delivered"),
                                          );
                                          if (!confirmed) return;
                                          try {
                                            await reservationService.completeByDelivered(
                                              res.id,
                                            );
                                            toast.success(
                                              t(
                                                "reservation_finalized_by_delivered",
                                              ),
                                            );
                                            await loadReservations();
                                          } catch (err) {
                                            toast.error(
                                              err.response?.data?.message ||
                                                t(
                                                  "error_finalizing_reservation",
                                                ),
                                            );
                                          }
                                        }}
                                        title={t("complete_by_delivered")}
                                      >
                                        ✅
                                      </button>
                                    </>
                                  )}
                                  <button
                                    className="btn-icon delete"
                                    onClick={() => deleteReservation(res)}
                                    title={t("delete")}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        setReservationPage((page) => Math.max(1, page - 1))
                      }
                      disabled={reservationPage === 1}
                    >
                      {t("previous")}
                    </button>
                    <span>
                      {t("page")} {reservationPage} {t("of")}{" "}
                      {reservationTotalPages}
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        setReservationPage((page) =>
                          Math.min(reservationTotalPages, page + 1),
                        )
                      }
                      disabled={reservationPage === reservationTotalPages}
                    >
                      {t("next")}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setReservationsListModalOpen(false)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INVENTAIRE */}
      {inventoryModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setInventoryModalOpen(false)}
        >
          <div
            className={`modal-container-large ${isDark ? "dark" : "light"}`}
            onClick={handleModalClick}
          >
            <div className="modal-header">
              <span className="modal-icon">📋</span>
              <h3>{t("inventory")}</h3>
              <button
                className="modal-close"
                onClick={() => setInventoryModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleInventory}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t("warehouse")}</label>
                  <Select
                    options={warehouseOptions}
                    value={inventoryWarehouse}
                    onChange={setInventoryWarehouse}
                    isClearable
                    className="select-filter"
                    classNamePrefix="select"
                    placeholder={t("all_warehouses")}
                    styles={{
                      control: (base) => ({
                        ...base,
                        background: isDark ? "#1e293b" : "#ffffff",
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                      }),
                      menu: (base) => ({
                        ...base,
                        background: isDark ? "#1e293b" : "#ffffff",
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
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: isDark ? "#f1f5f9" : "#1e293b",
                      }),
                    }}
                  />
                  <p className="form-hint">{t("inventory_hint")}</p>
                </div>

                <div className="inventory-table-container">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>{t("product")}</th>
                        <th>{t("unit")}</th>
                        <th>{t("system_stock")}</th>
                        <th>{t("physical_stock")}</th>
                        <th>{t("difference")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryProductList.map((item, index) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.unit}</td>
                          <td className="system-stock">{item.system_stock}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={item.physical_stock}
                              onChange={(e) =>
                                updateInventoryDifference(
                                  index,
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="inventory-input"
                            />
                          </td>
                          <td
                            className={`diff-cell ${item.difference !== 0 ? (item.difference > 0 ? "positive-diff" : "negative-diff") : ""}`}
                          >
                            {item.difference !== 0
                              ? item.difference > 0
                                ? `+${item.difference}`
                                : item.difference
                              : "0"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="5" className="inventory-total">
                          {t("total_difference")}:{" "}
                          {inventoryProductList
                            .reduce((sum, i) => sum + i.difference, 0)
                            .toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setInventoryModalOpen(false)}
                >
                  {t("cancel")}
                </button>
                <button type="submit" className="btn-primary">
                  {t("validate_inventory")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STYLES CSS */}
      <style>{`
        .stock-container {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .stock-container.light {
          background: var(--bg-main);
        }
        
        .stock-container.dark {
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
          font-size: 14px;
          font-weight: 500;
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
        
        .required {
          color: #dc2626;
        }
        
        .required::after {
          content: " *";
          color: #dc2626;
        }
        
        /* Styles des colonnes */
        .quantity-col, .quantity-cell { width: 120px; }
        .cost-col, .cost-cell { width: 150px; }
        .price-col { width: 130px; }
        .total-col, .total-cell { width: 130px; }
        
        /* Styles des champs */
        .quantity-cell input {
          width: 100px;
          text-align: center;
          font-weight: 600;
          background: var(--bg-card);
          border: 2px solid var(--border);
          border-radius: 8px;
          padding: 8px 6px;
          transition: all 0.2s;
          color: var(--text-primary);
        }
        
        .quantity-cell input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
          outline: none;
        }
        
        .quantity-cell input.error-input {
          border-color: #dc2626;
          background: rgba(220,38,38,0.1);
        }
        
        .cost-cell input, .price-cell input {
          width: 130px;
          text-align: right;
          font-weight: 500;
          background: rgba(245,158,11,0.1);
          border: 2px solid rgba(245,158,11,0.3);
          border-radius: 8px;
          padding: 8px 10px;
          transition: all 0.2s;
          color: var(--text-primary);
        }
        
        .cost-cell input:focus, .price-cell input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
          outline: none;
        }
        
        .notes-textarea {
          background: rgba(16,185,129,0.1);
          border: 2px solid rgba(16,185,129,0.3);
          border-radius: 12px;
          padding: 12px 16px;
          font-family: inherit;
          transition: all 0.2s;
          color: var(--text-primary);
          width: 100%;
        }
        
        .notes-textarea:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
          outline: none;
        }
        
        .delivery-input {
          width: 100px;
          padding: 8px;
          text-align: center;
          border: 2px solid var(--border);
          border-radius: 8px;
          font-weight: 500;
          background: var(--bg-card);
          color: var(--text-primary);
        }
        
        .delivery-input:focus {
          border-color: #667eea;
          outline: none;
        }
        
        .inventory-input {
          width: 120px;
          padding: 8px;
          text-align: right;
          border: 2px solid var(--border);
          border-radius: 8px;
          font-weight: 500;
          background: var(--bg-card);
          color: var(--text-primary);
        }
        
        .inventory-input:focus {
          border-color: #667eea;
          outline: none;
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
        
        .bulk-delete-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
        
        .stock-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .warehouse-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        
        .warehouse-selector label {
          color: var(--text-primary);
          font-weight: 500;
        }
        
        .select-filter {
          width: 250px;
        }
        
        .btn-manage-warehouses, .btn-reservation, .btn-inventory, .btn-reservations-list {
          padding: 8px 16px;
          background: #64748b;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin-left: 8px;
          transition: all 0.2s;
        }
        
        .btn-manage-warehouses:hover, .btn-reservation:hover, .btn-inventory:hover, .btn-reservations-list:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        
        .btn-reservation { background: #8b5cf6; }
        .btn-inventory { background: #10b981; }
        .btn-reservations-list { background: #f59e0b; }
        
        .btn-transfer {
          padding: 10px 20px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-transfer:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245,158,11,0.3);
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
        
        .btn-secondary:disabled {
          opacity: 0.6;
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
        
        .btn-add-item {
          padding: 6px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        
        .btn-add-item:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        
        .btn-remove-item {
          padding: 4px 8px;
          background: rgba(220,38,38,0.1);
          color: #dc2626;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-remove-item:hover {
          background: rgba(220,38,38,0.2);
        }
        
        .movement-type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .positive-quantity {
          color: #10b981;
          font-weight: 600;
        }
        
        .negative-quantity {
          color: #ef4444;
          font-weight: 600;
        }
        
        .ebms-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
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
        .btn-icon.attach { background: rgba(245,158,11,0.1); color: #d97706; }
        .btn-icon.receipt { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-icon.add-attach { background: rgba(102,126,234,0.1); color: #667eea; }
        
        .btn-icon:hover {
          transform: scale(1.05);
        }
        
        .items-section {
          margin-top: 20px;
          border-top: 1px solid var(--border);
          padding-top: 20px;
        }
        
        .items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .items-header h4 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }
        
        .items-table {
          width: 100%;
          overflow-x: auto;
        }
        
        .items-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .items-table th, .items-table td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .items-table th {
          font-weight: 600;
          color: var(--text-primary);
          background: var(--bg-header);
        }
        
        .select-product {
          min-width: 200px;
        }
        
        .total-cell {
          font-weight: 600;
          color: #667eea;
        }
        
        .total-label {
          text-align: right;
          font-weight: 600;
        }
        
        .grand-total {
          font-weight: 700;
          font-size: 16px;
          color: #667eea;
        }
        
        .available-stock {
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .status-error {
          color: #dc2626;
          font-size: 12px;
        }
        
        .status-success {
          color: #10b981;
          font-size: 12px;
        }
        
        .status-pending {
          color: #f59e0b;
          font-size: 12px;
        }
        
        .error-input {
          border-color: #dc2626 !important;
          background-color: rgba(220,38,38,0.1) !important;
        }
        
        .error-row {
          background-color: rgba(220,38,38,0.1);
        }
        
        .duplicate-row {
          background-color: rgba(245,158,11,0.1);
        }
        
        .error-hint {
          font-size: 11px;
          color: #dc2626;
          margin-top: 2px;
        }
        
        .stock-hint {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 2px;
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
        
        .attachment-item {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .attachment-preview {
          width: 100%;
          height: 200px;
          border: none;
          border-radius: 8px;
          margin: 12px 0;
        }
        
        .btn-download {
          display: inline-block;
          padding: 6px 12px;
          background: #667eea;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          font-size: 12px;
          transition: all 0.2s;
        }
        
        .btn-download:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        
        .attachment-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        
        .btn-delete-attachment {
          padding: 4px 8px;
          background: rgba(220,38,38,0.1);
          color: #dc2626;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .no-attachments {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
        }
        
        .charts-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .chart-card {
          border-radius: 20px;
          padding: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .chart-card h3 {
          font-size: 16px;
          margin-bottom: 16px;
          color: var(--text-primary);
        }
        
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .chart-header h3 {
          font-size: 16px;
          margin: 0;
        }
        
        .chart-header select {
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
        }
        
        .warehouse-stock-chart {
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .warehouse-stock-chart h3 {
          font-size: 16px;
          margin-bottom: 16px;
          color: var(--text-primary);
        }
        
        .summary-section {
          margin-bottom: 24px;
        }
        
        .summary-section h3 {
          font-size: 16px;
          margin-bottom: 16px;
          color: var(--text-primary);
        }
        
        .stock-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }
        
        .stock-summary-card {
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .summary-search-row {
          margin-bottom: 16px;
          display: flex;
          justify-content: flex-end;
        }

        .summary-search-input {
          width: 100%;
          max-width: 420px;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg-sec);
          color: var(--text-primary);
          outline: none;
        }

        .summary-search-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
        }

        .stock-summary-scroll {
          max-height: 520px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .stock-summary-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .stock-summary-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.5);
          border-radius: 999px;
        }

        .empty-state {
          padding: 28px 16px;
          color: var(--text-secondary);
          text-align: center;
          background: var(--bg-card);
          border: 1px dashed var(--border);
          border-radius: 12px;
          margin: 0 16px;
        }
        
        .summary-product-name {
          font-weight: 600;
          color: var(--text-primary);
          flex: 1;
        }
        
        .summary-quantity {
          text-align: center;
        }
        
        .quantity-value {
          font-size: 20px;
          font-weight: bold;
          color: #667eea;
        }
        
        .quantity-unit {
          font-size: 12px;
          color: var(--text-secondary);
          margin-left: 4px;
        }
        
        .summary-value {
          font-size: 14px;
          font-weight: 600;
          color: #10b981;
        }
        
        .summary-status {
          font-size: 12px;
          font-weight: 500;
        }
        
        .summary-warehouse {
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .table-responsive {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          margin-bottom: 24px;
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
          max-width: 1000px;
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
        
        .inventory-table-container {
          overflow-x: auto;
          margin-top: 16px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .inventory-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .inventory-table th, .inventory-table td {
          padding: 10px;
          border: 1px solid var(--border);
          text-align: left;
          color: var(--text-primary);
        }
        
        .inventory-table th {
          background: var(--bg-header);
          font-weight: 600;
        }
        
        .system-stock {
          text-align: center;
        }
        
        .diff-cell {
          font-weight: 600;
          text-align: center;
        }
        
        .positive-diff {
          color: #10b981;
        }
        
        .negative-diff {
          color: #dc2626;
        }
        
        .inventory-total {
          font-weight: 700;
          font-size: 14px;
          text-align: right;
          padding: 12px;
          color: var(--text-primary);
        }
        
        .form-hint {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-pending { background: rgba(245,158,11,0.1); color: #d97706; }
        .status-confirmed { background: rgba(59,130,246,0.1); color: #2563eb; }
        .status-partially_delivered { background: rgba(245,158,11,0.1); color: #d97706; }
        .status-completed { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-cancelled { background: rgba(220,38,38,0.1); color: #dc2626; }
        
        .priority-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .priority-low { background: rgba(100,116,139,0.1); color: #64748b; }
        .priority-normal { background: rgba(59,130,246,0.1); color: #2563eb; }
        .priority-high { background: rgba(245,158,11,0.1); color: #d97706; }
        .priority-urgent { background: rgba(220,38,38,0.1); color: #dc2626; }
        
        .res-number {
          font-family: monospace;
          font-weight: 600;
          color: #667eea;
        }
        
        .warning-row {
          background-color: rgba(245,158,11,0.1);
        }
        
        .stock-warning {
          color: #dc2626;
          font-weight: 600;
        }
        
        .no-data {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
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
          color: var(--text-primary);
        }
        
        @media (max-width: 768px) {
          .stock-container {
            padding: 16px;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .form-group.full-width {
            grid-column: span 1;
          }
          
          .stock-summary-grid {
            grid-template-columns: 1fr;
          }
          
          .select-filter {
            width: 100%;
          }
          
          .charts-section {
            grid-template-columns: 1fr;
          }
          
          .stats-badge {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .warehouse-selector {
            flex-direction: column;
            align-items: stretch;
          }
          
          .btn-manage-warehouses, .btn-reservation, .btn-inventory, .btn-reservations-list {
            margin-left: 0;
            margin-top: 8px;
          }
          
          .modal-container, .modal-container-large, .modal-container-small {
            width: 95%;
          }
          
          .quantity-col, .cost-col, .price-col, .total-col {
            width: auto;
          }
          
          .quantity-cell input, .cost-cell input, .price-cell input {
            width: 80px;
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
        }
      `}</style>
    </div>
  );
};

export default Stock;
