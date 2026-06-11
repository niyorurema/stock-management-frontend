// frontend/src/pages/PurchaseOrders.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import Select from 'react-select';
import { useLanguage } from '../contexts/LanguageContext';
import { useAction } from '../contexts/ActionContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Loader from '../components/common/Loader';
import Swal from 'sweetalert2';
//import { settingsService } from '../services/apiService';
import DropdownMenu from '../components/common/DropdownMenu';

import { 
  settingsService, 
  purchaseOrderService,
  receptionService,
  exchangeRateService,
  productService,
  attachmentService, 
  getApiErrorMessage,
  supplierService
} from '../services/apiService';
import { publicAssetUrl } from '../utils/authFetch';
import { getFileIcon, formatFileSize, isImageFile } from '../utils/assetHelper';

//import { authFetch, authFetchJson, publicAssetUrl } from '../utils/authFetch';

// ==================== CONSTANTES ====================
const getOrderStatuses = (t) => [
  { value: 'draft', label: t('status_draft'), color: '#64748b', icon: '📝' },
  { value: 'pending', label: t('status_pending'), color: '#f59e0b', icon: '⏳' },
  { value: 'approved', label: t('status_confirmed'), color: '#3b82f6', icon: '✅' },
  { value: 'processing', label: t('status_processing'), color: '#8b5cf6', icon: '🔄' },
  { value: 'partial', label: t('status_partial'), color: '#f97316', icon: '⚠️' },
  { value: 'completed', label: t('status_completed'), color: '#10b981', icon: '🎉' },
  { value: 'cancelled', label: t('status_cancelled'), color: '#ef4444', icon: '❌' }
];

const getPriorities = (t) => [
  { value: 'low', label: t('priority_low'), color: '#10b981', icon: '🟢' },
  { value: 'normal', label: t('priority_normal'), color: '#3b82f6', icon: '🔵' },
  { value: 'high', label: t('priority_high'), color: '#f59e0b', icon: '🟡' },
  { value: 'urgent', label: t('priority_urgent'), color: '#ef4444', icon: '🔴' }
];

const CURRENCIES = [
  { value: 'AED', label: 'Dirham', symbol: 'AED', rate: 1 },
  { value: 'USD', label: 'Dollar US', symbol: '$', rate: 3.6725 },
  { value: 'BIF', label: 'Franc Burundais', symbol: 'FBu', rate: 2830 }
];

// ==================== COMPOSANTS ====================
const StatusBadge = ({ status, t }) => {
  const statuses = getOrderStatuses(t);
  const statusInfo = statuses.find(s => s.value === status) || statuses[0];
  return (
    <span className="status-badge" style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}>
      {statusInfo.icon} {statusInfo.label}
    </span>
  );
};

const PriorityBadge = ({ priority, t }) => {
  const priorities = getPriorities(t);
  const priorityInfo = priorities.find(p => p.value === priority) || priorities[1];
  return (
    <span className="priority-badge" style={{ backgroundColor: priorityInfo.color + '20', color: priorityInfo.color }}>
      {priorityInfo.icon}{priorityInfo.label}
    </span>
  );
};


const getClientIP = async () => {
  try {
    // Essayez plusieurs services en cas d'échec
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.my-ip.io/ip.json',
      'https://ipapi.co/json/'
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service);
        const data = await response.json();
        const ip = data.ip || data.ipAddress || null;
        if (ip) return ip;
      } catch (e) {
        continue;
      }
    }
    return 'unknown';
  } catch (error) {
    console.error('Erreur récupération IP:', error);
    return 'unknown';
  }
};

// ==================== COMPOSANT PRINCIPAL ====================
const PurchaseOrders = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  // ==================== ÉTATS PRINCIPAUX ====================
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({
    AED_to_USD: 3.6725,
    USD_to_BIF: 2830
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(7);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ==================== ÉTATS DES MODAUX ====================
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [receptionModalOpen, setReceptionModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [exchangeRateModalOpen, setExchangeRateModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [receptionFiles, setReceptionFiles] = useState([]);
  const fileInputRef = useRef(null);

  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [currentAttachments, setCurrentAttachments] = useState([]);
  const [currentReception, setCurrentReception] = useState(null);


  // Modal d'édition de réception
const [editReceptionModalOpen, setEditReceptionModalOpen] = useState(false);
const [editReceptionData, setEditReceptionData] = useState(null);
const [editingReceptionItems, setEditingReceptionItems] = useState([]);

  // États pour les bons de réception déjà générés
const [generatedReceptions, setGeneratedReceptions] = useState({});
const [viewerModalOpen, setViewerModalOpen] = useState(false);
const [viewerFile, setViewerFile] = useState(null);
const [printPreviewModalOpen, setPrintPreviewModalOpen] = useState(false);
const [printPreviewContent, setPrintPreviewContent] = useState('');
const [viewerLoading, setViewerLoading] = useState(false); 

const [signedReceptionsModalOpen, setSignedReceptionsModalOpen] = useState(false);
const [signedReceptions, setSignedReceptions] = useState([]);
const [selectedSignedReception, setSelectedSignedReception] = useState(null);


// États pour les bons de réception déjà générés
const [currentPrintReception, setCurrentPrintReception] = useState(null); // ← AJOUTER CETTE LIGNE


  // ==================== ÉTATS DES FILTRES ====================
  const [filters, setFilters] = useState({
    order_number: '',
    supplier_id: null,
    status: '',
    date_from: '',
    date_to: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({});

  // ==================== ÉTATS DU FORMULAIRE ====================
  const [formData, setFormData] = useState({
    supplier_id: null,
    order_date: new Date().toISOString().slice(0, 16),
    expected_delivery_date: '',
    priority: 'normal',
    currency: 'AED',
    exchange_rate_aed_to_usd: 3.6725,
    exchange_rate_usd_to_bif: 2830,
    notes: ''
  });

  const [loadingDetails, setLoadingDetails] = useState(false);

  // ==================== ÉTATS DES PRODUITS DE LA COMMANDE ====================
  const [orderItems, setOrderItems] = useState([
    {
      id: Date.now(),
      product_id: null,
      quantity: 0,
      unit_cost_aed: 0,
      unit_cost_usd: 0,
      unit_cost_bif: 0,
      total_cost_aed: 0,
      total_cost_usd: 0,
      total_cost_bif: 0,
      received_quantity: 0,
      product_name: '',
      product_code: '',
      unit: '',
      selling_price: 0,
      purchase_price: 0,
      expected_profit: 0,
      profit_margin: 0
    }
  ]);

  // ==================== ÉTATS POUR LES PRIX EN DIRECT ====================
  const [priceSource, setPriceSource] = useState('database');
  const [livePrices, setLivePrices] = useState({
    unit_cost_aed: 0,
    unit_cost_usd: 0,
    unit_cost_bif: 0,
    selling_price: 0
  });
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [isManualUsdInput, setIsManualUsdInput] = useState(false);
  const [isManualBifInput, setIsManualBifInput] = useState(false);

  // ==================== ÉTATS POUR LA RÉCEPTION ====================
  const [receptionItems, setReceptionItems] = useState([]);
  const [receptionData, setReceptionData] = useState({
    reception_date: new Date().toISOString().slice(0, 16),
    notes: ''
  });

  // ==================== ÉTATS POUR LES TAUX DE CHANGE ====================
  const [rateFormData, setRateFormData] = useState({
    from_currency: 'USD',
    to_currency: 'BIF',
    rate: 2830,
    effective_date: new Date().toISOString().split('T')[0]
  });

  // ==================== ÉTATS POUR LE PARTAGE ====================
  const [shareData, setShareData] = useState({
    email: '',
    whatsapp_number: '',
    share_link: ''
  });

  // ==================== LOADERS ====================
  const [submitLoading, setSubmitLoading] = useState(false);
  const [receptionLoading, setReceptionLoading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(null);
  const [printLoading, setPrintLoading] = useState(null);

  const isMounted = useRef(true);

  // ==================== FONCTIONS UTILITAIRES ====================
  const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-BI', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num || 0);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('fr-BI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);
  };

  // ==================== CHARGEMENT DES DONNÉES ====================
  /*const loadOrders = useCallback(async (params = {}, page = 1) => {
    setLoading(true);
    try {
      const cleanParams = {};
      if (params.order_number) cleanParams.order_number = params.order_number;
      if (params.supplier_id) cleanParams.supplier_id = params.supplier_id;
      if (params.status) cleanParams.status = params.status;
      if (params.date_from) cleanParams.date_from = params.date_from;
      if (params.date_to) cleanParams.date_to = params.date_to;

      cleanParams.page = page;
      cleanParams.limit = itemsPerPage;

      const queryString = new URLSearchParams(cleanParams).toString();
      const response = await authFetch(`/api/purchase-orders?${queryString}`);
      const result = await response.json();

      if (result.success) {
        setOrders(result.data || []);
        setTotalItems(result.pagination?.total || 0);
        setCurrentPage(page);
        setAppliedFilters(cleanParams);
      } else {
        toast.error(result.message || t('error_loading_orders'));
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('error_loading_orders'));
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, t]);*/

  const loadOrders = useCallback(async (params = {}, page = 1) => {
  setLoading(true);
  try {
    const cleanParams = { ...params, page, limit: itemsPerPage };
    const response = await purchaseOrderService.getAll(cleanParams);
    
    if (response.data?.success) {
      setOrders(response.data.data || []);
      setTotalItems(response.data.pagination?.total || 0);
      setCurrentPage(page);
      setAppliedFilters(cleanParams);
    } else {
      toast.error(response.data?.message || t('error_loading_orders'));
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(getApiErrorMessage(error, t('error_loading_orders')));
  } finally {
    setLoading(false);
  }
}, [itemsPerPage, t]);

const loadReferenceData = useCallback(async () => {
  try {
    setLoadingSuppliers(true);
    console.log('Chargement des données de référence...');

    // Charger les fournisseurs, produits et taux de change en parallèle
    const [suppliersRes, productsRes, ratesRes] = await Promise.all([
      supplierService.getAll(),
      productService.getAllActive(),
      exchangeRateService.getLatest()
    ]);

    console.log('Fournisseurs reçus:', suppliersRes.data);

    // Traitement des fournisseurs
    if (suppliersRes.data?.success) {
      const suppliersData = suppliersRes.data.data || [];
      setSuppliers(suppliersData);
      
      const options = suppliersData.map(s => ({
        value: s.id,
        label: s.code ? `${s.name} (${s.code})` : s.name,
        payment_terms: s.payment_terms || 30
      }));

      console.log('Options fournisseurs générées:', options);
      setSupplierOptions(options);
    } else {
      console.error('Erreur chargement fournisseurs:', suppliersRes.data?.message);
    }

    // Traitement des produits
    if (productsRes.data?.success) {
      const productsData = productsRes.data.data || [];
      setProducts(productsData);
      
      setProductOptions(productsData.map(p => ({
        value: p.id,
        label: `${p.name} (${p.code})`,
        unit: p.unit,
        selling_price: p.selling_price || 0,
        purchase_price: p.purchase_price || 0,
        purchase_price_aed: p.purchase_price_aed || p.purchase_price || 0,
        purchase_price_usd: p.purchase_price_usd || 0,
        purchase_price_bif: p.purchase_price_bif || 0,
        code: p.code,
        name: p.name,
        current_stock: p.current_stock || 0
      })));
    }

    // Traitement des taux de change
    if (ratesRes.data?.success) {
      const ratesData = ratesRes.data.data || {};
      
      setExchangeRates({
        AED_to_USD: ratesData.AED_to_USD || 3.6725,
        USD_to_BIF: ratesData.USD_to_BIF || 2830
      });
      
      setFormData(prev => ({
        ...prev,
        exchange_rate_aed_to_usd: ratesData.AED_to_USD || 3.6725,
        exchange_rate_usd_to_bif: ratesData.USD_to_BIF || 2830
      }));
    } else {
      // Valeurs par défaut si l'API ne retourne pas de données
      setExchangeRates({ AED_to_USD: 3.6725, USD_to_BIF: 2830 });
      setFormData(prev => ({
        ...prev,
        exchange_rate_aed_to_usd: 3.6725,
        exchange_rate_usd_to_bif: 2830
      }));
    }
  } catch (error) {
    console.error('Erreur chargement références:', error);
    toast.error(t('error_loading_reference_data'));
    
    // Valeurs par défaut en cas d'erreur
    setExchangeRates({ AED_to_USD: 3.6725, USD_to_BIF: 2830 });
    setFormData(prev => ({
      ...prev,
      exchange_rate_aed_to_usd: 3.6725,
      exchange_rate_usd_to_bif: 2830
    }));
  } finally {
    setLoadingSuppliers(false);
  }
}, [t]);

  const loadExchangeRates = useCallback(async () => {
    try {
      const response = await exchangeRateService.getAll();
     // const result = await response.json();
      if (response.data?.success) {
        const ratesMap = {};
        if (Array.isArray(response.data)) {
          response.data.forEach(rate => {
            ratesMap[`${rate.from_currency}_to_${rate.to_currency}`] = rate.rate;
          });
        } else {
          Object.assign(ratesMap, response.data);
        }
        setExchangeRates(ratesMap);
        setFormData(prev => ({
          ...prev,
          exchange_rate_aed_to_usd: ratesMap.AED_to_USD || 3.6725,
          exchange_rate_usd_to_bif: ratesMap.USD_to_BIF || 2830
        }));
      }
    } catch (error) {
      console.error('Erreur chargement taux:', error);
    }
  }, []);


// Modifiez la fonction loadSignedReceptions pour voir les données
/*const loadSignedReceptions = async (orderId) => {
  try {
    const response = await authFetch(`/api/purchase-orders/${orderId}/signatures`);
    const result = await response.json();
    console.log('Données reçues:', result); // Debug
    
    if (result.success) {
      console.log('Signatures:', result.data); // Debug
      setSignedReceptions(result.data);
      setSignedReceptionsModalOpen(true);
    } else {
      toast.error(result.message);
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(t('error_loading_signatures'));
  }
};*/

  const loadSignedReceptions = async (orderId) => {
  try {
    const response = await purchaseOrderService.getSignatures(orderId);
    console.log('Données reçues:', response.data); // Debug
    
    if (response.data?.success) {
      console.log('Signatures:', response.data.data); // Debug
      setSignedReceptions(response.data.data);
      setSignedReceptionsModalOpen(true);
    } else {
      toast.error(response.data?.message || t('error_loading_signatures'));
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(getApiErrorMessage(error, t('error_loading_signatures')));
  }
};

// Visualiser un bon signé
const viewSignedReception = (signature) => {
  setSelectedSignedReception(signature);
  // Ouvrir le PDF signé
  window.open(publicAssetUrl(signature.signed_pdf_path), '_blank');
};

  // ==================== GESTION DES PRODUITS ====================
  const isProductAlreadyAdded = (productId, currentItemId) => {
    return orderItems.some(item => item.product_id === productId && item.id !== currentItemId);
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      id: Date.now(),
      product_id: null,
      quantity: 1,
      unit_cost_aed: 0,
      unit_cost_usd: 0,
      unit_cost_bif: 0,
      total_cost_aed: 0,
      total_cost_usd: 0,
      total_cost_bif: 0,
      received_quantity: 0,
      product_name: '',
      product_code: '',
      unit: '',
      selling_price: 0,
      purchase_price: 0,
      expected_profit: 0,
      profit_margin: 0
    }]);
  };

  const removeOrderItem = (id) => {
    if (orderItems.length === 1) {
      toast.error(t('at_least_one_product'));
      return;
    }
    setOrderItems(prev => prev.filter(item => item.id !== id));
  };

  const updateOrderItem = (id, field, value) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        const rateAedToUsd = formData.exchange_rate_aed_to_usd || 3.6725;
        const rateUsdToBif = formData.exchange_rate_usd_to_bif || 2830;

        if (field === 'product_id') {
          const selectedProduct = productOptions.find(p => p.value === value);
          if (selectedProduct) {
            updated.product_name = selectedProduct.name;
            updated.product_code = selectedProduct.code;
            updated.unit = selectedProduct.unit;

            if (priceSource === 'database') {
              updated.selling_price = selectedProduct.selling_price || 0;
              updated.unit_cost_aed = selectedProduct.purchase_price_aed || selectedProduct.purchase_price || 0;
              updated.unit_cost_usd = selectedProduct.purchase_price_usd || 0;
              updated.unit_cost_bif = selectedProduct.purchase_price_bif || 0;
            } else {
              updated.selling_price = 0;
              updated.unit_cost_aed = 0;
              updated.unit_cost_usd = 0;
              updated.unit_cost_bif = 0;
            }
          }
        }

        const qty = parseFloat(updated.quantity) || 0;
        updated.total_cost_aed = qty * updated.unit_cost_aed;
        updated.total_cost_usd = qty * updated.unit_cost_usd;
        updated.total_cost_bif = qty * updated.unit_cost_bif;

        const sellingPrice = updated.selling_price || 0;
        const costPrice = updated.unit_cost_bif;
        updated.expected_profit = (sellingPrice - costPrice) * qty;
        updated.profit_margin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100) : 0;

        return updated;
      }
      return item;
    }));
  };

  // ==================== GESTION DES PRIX EN DIRECT ====================
  const handlePriceSourceChange = (source) => {
    setPriceSource(source);
    setShowPriceSettings(source === 'live');
    if (source === 'database') {
      refreshPricesFromDatabase();
    }
  };

  const refreshPricesFromDatabase = async () => {
    for (const item of orderItems) {
      if (item.product_id) {
        const selectedProduct = productOptions.find(p => p.value === item.product_id);
        if (selectedProduct) {
          updateOrderItem(item.id, 'product_id', item.product_id);
        }
      }
    }
  };

// Appliquer les prix live à tous les produits
const applyLivePricesToAll = () => {
  setOrderItems(prev => prev.map(item => {
    if (item.product_id) {
      const qty = item.quantity || 0;
      return {
        ...item,
        unit_cost_aed: livePrices.unit_cost_aed,
        unit_cost_usd: livePrices.unit_cost_usd,
        unit_cost_bif: livePrices.unit_cost_bif,
        selling_price: livePrices.selling_price,
        total_cost_aed: qty * livePrices.unit_cost_aed,
        total_cost_usd: qty * livePrices.unit_cost_usd,
        total_cost_bif: qty * livePrices.unit_cost_bif,
        expected_profit: (livePrices.selling_price - livePrices.unit_cost_bif) * qty,
        profit_margin: livePrices.unit_cost_bif > 0 
          ? ((livePrices.selling_price - livePrices.unit_cost_bif) / livePrices.unit_cost_bif * 100) 
          : 0
      };
    }
    return item;
  }));
  toast.success(t('live_prices_applied_to_all'));
};


const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState(false);

    const [settings, setSettings] = useState({
      company_name: '',
      company_nif: '',
      company_rc: '',
      company_center: '',
      company_activity: '',
      company_legal_form: '',
      company_phone: '',
      company_commune: '',
      company_address: '',
      company_email: '',
      company_logo: '',
      invoice_footer_text: '',
      invoice_validity_days: '30',
      company_is_subject_to_vat: true
    });


      useEffect(() => {
        loadSettings();
      }, []);
    
      const loadSettings = async () => {
        setLoading(true);
        try {
          const response = await settingsService.getAll();
          if (response.data?.success) {
            setSettings(prev => ({ ...prev, ...response.data.data }));
            if (response.data.data.company_logo) {
              setLogoPreview(response.data.data.company_logo);
              setLogoError(false);
            }
          }
        } catch (error) {
          console.error('Erreur chargement:', error);
          toast.error(t('error_loading_settings'));
        } finally {
          setLoading(false);
        }
      };

// Mettre à jour les prix en direct
const updateLivePrices = (field, value) => {
  const rateAedToUsd = formData.exchange_rate_aed_to_usd || 3.6725;
  const rateUsdToBif = formData.exchange_rate_usd_to_bif || 2830;
  
  let newLivePrices = { ...livePrices };
  const numValue = parseFloat(value) || 0;
  
  switch (field) {
    case 'unit_cost_aed':
      newLivePrices.unit_cost_aed = numValue;
      newLivePrices.unit_cost_usd = numValue * rateAedToUsd;
      newLivePrices.unit_cost_bif = newLivePrices.unit_cost_usd * rateUsdToBif;
      break;
    case 'unit_cost_usd':
      newLivePrices.unit_cost_usd = numValue;
      newLivePrices.unit_cost_aed = numValue / rateAedToUsd;
      newLivePrices.unit_cost_bif = numValue * rateUsdToBif;
      break;
    case 'unit_cost_bif':
      newLivePrices.unit_cost_bif = numValue;
      newLivePrices.unit_cost_usd = numValue / rateUsdToBif;
      newLivePrices.unit_cost_aed = newLivePrices.unit_cost_usd / rateAedToUsd;
      break;
    case 'selling_price':
      newLivePrices.selling_price = numValue;
      break;
    default:
      newLivePrices[field] = numValue;
  }
  
  newLivePrices.unit_cost_aed = Math.round(newLivePrices.unit_cost_aed * 100) / 100;
  newLivePrices.unit_cost_usd = Math.round(newLivePrices.unit_cost_usd * 100) / 100;
  newLivePrices.unit_cost_bif = Math.round(newLivePrices.unit_cost_bif);
  
  setLivePrices(newLivePrices);
  
  // Appliquer immédiatement aux produits existants
  if (priceSource === 'live') {
    setOrderItems(prev => prev.map(item => {
      if (item.product_id) {
        const qty = item.quantity || 0;
        return {
          ...item,
          unit_cost_aed: newLivePrices.unit_cost_aed,
          unit_cost_usd: newLivePrices.unit_cost_usd,
          unit_cost_bif: newLivePrices.unit_cost_bif,
          selling_price: newLivePrices.selling_price || item.selling_price,
          total_cost_aed: qty * newLivePrices.unit_cost_aed,
          total_cost_usd: qty * newLivePrices.unit_cost_usd,
          total_cost_bif: qty * newLivePrices.unit_cost_bif,
          expected_profit: ((newLivePrices.selling_price || item.selling_price) - newLivePrices.unit_cost_bif) * qty,
          profit_margin: newLivePrices.unit_cost_bif > 0 
            ? (((newLivePrices.selling_price || item.selling_price) - newLivePrices.unit_cost_bif) / newLivePrices.unit_cost_bif * 100) 
            : 0
        };
      }
      return item;
    }));
  }
};

  const resetLivePrices = () => {
    setLivePrices({
      unit_cost_aed: 0,
      unit_cost_usd: 0,
      unit_cost_bif: 0,
      selling_price: 0
    });
    toast(t('live_prices_reset'), { icon: '🔄' });
  };

  // ==================== CALCULS DES TOTAUX ====================
  const getSubtotalAed = () => {
    return orderItems.reduce((sum, item) => sum + (item.total_cost_aed || 0), 0);
  };

  const getSubtotalUsd = () => {
    return orderItems.reduce((sum, item) => sum + (item.total_cost_usd || 0), 0);
  };

  const getSubtotalBif = () => {
    return orderItems.reduce((sum, item) => sum + (item.total_cost_bif || 0), 0);
  };

  const getTotalExpectedProfit = () => {
    return orderItems.reduce((sum, item) => sum + (item.expected_profit || 0), 0);
  };

  // ==================== GESTION DES TAUX DE CHANGE ====================
  const handleCurrencyChange = (field, value) => {
    const newRate = parseFloat(value) || 0;
    setFormData(prev => ({ ...prev, [field]: newRate }));

    const rateAedToUsd = field === 'exchange_rate_aed_to_usd' ? newRate : formData.exchange_rate_aed_to_usd;
    const rateUsdToBif = field === 'exchange_rate_usd_to_bif' ? newRate : formData.exchange_rate_usd_to_bif;

    setOrderItems(prev => prev.map(item => {
      if (item.product_id) {
        const qty = item.quantity || 0;
        const unitCostAed = item.unit_cost_aed;
        const unitCostUsd = unitCostAed / rateAedToUsd;
        const unitCostBif = unitCostUsd * rateUsdToBif;

        const sellingPrice = item.selling_price || 0;
        const expectedProfit = (sellingPrice - unitCostBif) * qty;
        const margin = unitCostBif > 0 ? ((sellingPrice - unitCostBif) / unitCostBif * 100) : 0;

        return {
          ...item,
          unit_cost_usd: unitCostUsd,
          unit_cost_bif: unitCostBif,
          total_cost_aed: qty * unitCostAed,
          total_cost_usd: qty * unitCostUsd,
          total_cost_bif: qty * unitCostBif,
          expected_profit: expectedProfit,
          profit_margin: Number(margin.toFixed(2))
        };
      }
      return item;
    }));
  };

  // const handleSaveExchangeRate = async () => {
  //   setRateLoading(true);
  //   try {
  //     const response = await authFetch(`/api/exchange-rates`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(rateFormData)
  //     });
  //     const result = await response.json();

  //     if (result.success) {
  //       toast.success(t('exchange_rate_saved'));
  //       await loadExchangeRates();
  //       setExchangeRateModalOpen(false);
  //       resetRateForm();
  //     } else {
  //       toast.error(result.message);
  //     }
  //   } catch (error) {
  //     console.error('Erreur:', error);
  //     toast.error(t('error_saving_exchange_rate'));
  //   } finally {
  //     setRateLoading(false);
  //   }
  // };

  const handleSaveExchangeRate = async () => {
  setRateLoading(true);
  try {
    const response = await exchangeRateService.create(rateFormData);

    if (response.data?.success) {
      toast.success(t('exchange_rate_saved'));
      await loadExchangeRates();
      setExchangeRateModalOpen(false);
      resetRateForm();
    } else {
      toast.error(response.data?.message || t('error_saving_exchange_rate'));
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(getApiErrorMessage(error, t('error_saving_exchange_rate')));
  } finally {
    setRateLoading(false);
  }
};

  const resetRateForm = () => {
    setRateFormData({
      from_currency: 'USD',
      to_currency: 'BIF',
      rate: 2830,
      effective_date: new Date().toISOString().split('T')[0]
    });
  };

  const openExchangeRateModal = () => {
    resetRateForm();
    setExchangeRateModalOpen(true);
  };

  // ==================== APPROBATION DE COMMANDE ====================
  const handleApprove = async (order) => {
    const confirmed = await Swal.fire({
      title: t('confirm_approve'),
      text: t('approve_confirmation'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f1f5f9' : '#1e293b'
    });

    if (!confirmed.isConfirmed) return;

    setApproveLoading(order.id);
    try {
      const response = await purchaseOrderService.approve(order.id, { approved_by: user?.id });
     // const result = await response.json();

      if (response.data?.success) {
          toast.success(t('order_approved'));
        loadOrders(appliedFilters, currentPage);
      } else {
        toast.error(response.data?.message);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('error_approving_order'));
    } finally {
      setApproveLoading(null);
    }
  };

  // ==================== PARTAGE DE COMMANDE ====================
  const openShareModal = (order) => {
    setSelectedOrder(order);
    setShareData({
      email: '',
      whatsapp_number: '',
      share_link: `${window.location.origin}/purchase-orders/${order.id}`
    });
    setShareModalOpen(true);
  };

  // const handleShareByEmail = async () => {
  //   if (!shareData.email) {
  //     toast.error(t('email_required'));
  //     return;
  //   }

  //   setShareLoading(true);
  //   try {
  //     const response = await authFetch(`/api/purchase-orders/${selectedOrder.id}/share-email`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ email: shareData.email })
  //     });
  //     const result = await response.json();

  //     if (result.success) {
  //       toast.success(t('email_sent_success'));
  //       setShareModalOpen(false);
  //     } else {
  //       toast.error(result.message);
  //     }
  //   } catch (error) {
  //     console.error('Erreur:', error);
  //     toast.error(t('error_sending_email'));
  //   } finally {
  //     setShareLoading(false);
  //   }
  // };

  const handleShareByEmail = async () => {
  // Validation de l'email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!shareData.email) {
    toast.error(t('email_required'));
    return;
  }
  
  if (!emailRegex.test(shareData.email)) {
    toast.error(t('email_invalid'));
    return;
  }

  setShareLoading(true);
  try {
    const response = await purchaseOrderService.shareByEmail(selectedOrder.id, shareData.email);

    if (response.data?.success) {
      toast.success(t('email_sent_success'));
      setShareModalOpen(false);
      // Optionnel : réinitialiser l'email
      setShareData(prev => ({ ...prev, email: '' }));
    } else {
      const errorMsg = response.data?.message || t('error_sending_email');
      toast.error(errorMsg);
    }
  } catch (error) {
    console.error('Erreur envoi email:', error);
    
    // Gestion des erreurs spécifiques
    if (error.response?.status === 404) {
      toast.error(t('order_not_found'));
    } else if (error.response?.status === 400) {
      toast.error(error.response.data?.message || t('invalid_email'));
    } else {
      toast.error(getApiErrorMessage(error, t('error_sending_email')));
    }
  } finally {
    setShareLoading(false);
  }
};

  const handleShareByWhatsApp = () => {
    if (!shareData.whatsapp_number) {
      toast.error(t('whatsapp_number_required'));
      return;
    }

    const message = encodeURIComponent(
      `📦 *${t('purchase_order')}* ${selectedOrder.order_number}\n` +
      `🏭 ${t('supplier')}: ${selectedOrder.supplier_name}\n` +
      `💰 ${t('total_amount')}: ${formatCurrency(selectedOrder.total_amount)} ${selectedOrder.currency}\n` +
      `🔗 ${t('view_details')}: ${shareData.share_link}`
    );
    const whatsappUrl = `https://wa.me/${shareData.whatsapp_number.replace(/[^0-9]/g, '')}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    toast.success(t('whatsapp_redirect'));
    setShareModalOpen(false);
  };



// const printSignedReception = async (sig) => {
//   setPrintLoading(sig.id);
//   try {
//     const response = await authFetch(`/api/receptions/${sig.reception_id}/print-signed`);
//     const result = await response.json();
    
//     if (result.success) {
//       const printWindow = window.open('', '_blank');
//       const htmlContent = generateSignedReceptionPrintHtml(result.data);
//       printWindow.document.write(htmlContent);
//       printWindow.document.close();
//       printWindow.print();
//     } else {
//       toast.error(result.message);
//     }
//   } catch (error) {
//     console.error('Erreur impression:', error);
//     toast.error(t('print_error'));
//   } finally {
//     setPrintLoading(null);
//   }
// };

  const printSignedReception = async (sig) => {
  // Vérifier que sig et sig.reception_id existent
  if (!sig?.reception_id) {
    toast.error(t('invalid_reception_data'));
    return;
  }
  
  setPrintLoading(sig.id);
  try {
    const response = await receptionService.printSigned(sig.reception_id);

    if (response.data?.success) {
      const receptionData = response.data.data;
      
      // Vérifier que les données sont complètes
      if (!receptionData) {
        toast.error(t('no_print_data'));
        return;
      }
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error(t('popup_blocked'));
        return;
      }
      
      const htmlContent = generateSignedReceptionPrintHtml(receptionData);
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    } else {
      const errorMsg = response.data?.message || t('print_error');
      toast.error(errorMsg);
    }
  } catch (error) {
    console.error('Erreur impression bon signé:', error);
    
    // Gestion des erreurs spécifiques
    if (error.response?.status === 404) {
      toast.error(t('reception_not_found'));
    } else if (error.response?.status === 401) {
      toast.error(t('unauthorized'));
    } else {
      toast.error(getApiErrorMessage(error, t('print_error')));
    }
  } finally {
    setPrintLoading(null);
  }
};
const generateSignedReceptionPrintHtml = (data) => {
  const { reception, signature, order } = data;
  const qrCodeUrl = signature?.qrcode_path ? publicAssetUrl(signature.qrcode_path) : '';
  const signatureQrUrl = signature?.signed_qrcode_path ? publicAssetUrl(signature.signed_qrcode_path) : '';
  const totalQuantity = reception.items?.reduce((sum, item) => sum + (item.received_quantity || 0), 0) || 0;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>BON DE RECEPTION SIGNE - ${reception.reception_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 10pt; line-height: 1.3; background: white; color: #1e293b; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
          .header h1 { color: #667eea; font-size: 18pt; text-transform: uppercase; }
          .company-info { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 14pt; font-weight: bold; }
          .info-section { margin-bottom: 20px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .info-table td { padding: 6px; border: 1px solid #cbd5e1; }
          .info-label { font-weight: bold; width: 140px; background: #f1f5f9; }
          .qr-section { display: flex; justify-content: space-between; margin: 20px 0; page-break-inside: avoid; }
          .qr-box { text-align: center; width: 45%; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; }
          .qr-box img { width: 120px; height: 120px; object-fit: contain; }
          .qr-label { font-size: 9pt; color: #64748b; margin-top: 8px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th { background: #667eea; color: white; padding: 10px; text-align: center; border: 1px solid #cbd5e1; }
          .items-table td { padding: 8px; border: 1px solid #cbd5e1; text-align: center; }
          .items-table td.text-left { text-align: left; }
          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .signature-box { text-align: center; width: 45%; }
          .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 8px; }
          .verification-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 10pt; margin-left: 10px; }
          .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BON DE RECEPTION SIGNE</h1>
          <p>N° ${reception.reception_number}</p>
        </div>
        
        <div class="company-info">
          <div class="company-name">${settings?.company_name || 'MUHIZI BLESSED COMPANY'}</div>
          <div>NIF: ${settings?.company_nif || '4002141416'} | RC: ${settings?.company_rc || '0041847/23'}</div>
          <div>${settings?.company_address || 'ROHERO'}, ${settings?.company_commune || 'MUKAZA'}</div>
          <div>Tél: ${settings?.company_phone || '69377364'}</div>
        </div>
        
        <div class="info-section">
          <table class="info-table">
            <tr><td class="info-label">N° Commande</td><td>${order?.order_number}</td><td class="info-label">Date Réception</td><td>${new Date(reception.reception_date).toLocaleString()}</td></tr>
            <tr><td class="info-label">Fournisseur</td><td>${order?.supplier_name}</td><td class="info-label">NIF Fournisseur</td><td>${order?.supplier_tin || '-'}</td></tr>
            <tr><td class="info-label">Signé par</td><td>${signature?.signed_by}</td><td class="info-label">Date Signature</td><td>${new Date(signature?.signed_at).toLocaleString()}</td></tr>
          </table>
        </div>
        
        <div class="qr-section">
          <div class="qr-box">
            <img src="${qrCodeUrl}" alt="QR Code du bon" onerror="this.style.display='none'">
            <div class="qr-label">📱 Scanner pour vérifier le bon</div>
          </div>
          <div class="qr-box">
            <img src="${signatureQrUrl}" alt="QR Code de signature" onerror="this.style.display='none'">
            <div class="qr-label">✍️ Scanner pour vérifier la signature</div>
          </div>
        </div>
        
        <h3>📦 Produits reçus</h3>
        <table class="items-table">
          <thead>
            <tr><th>#</th><th class="text-left">Produit</th><th>Quantité reçue</th><th>Unité</th></tr>
          </thead>
          <tbody>
            ${reception.items?.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${item.product_name}</td>
                <td class="text-center">${item.received_quantity}</td>
                <td class="text-center">${item.unit || 'PIECE'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9;">
              <td colspan="2" class="text-right"><strong>TOTAL</strong></td>
              <td class="text-center"><strong>${totalQuantity}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        
        ${reception.notes ? `
          <div class="notes-section">
            <strong>📝 Notes:</strong>
            <p>${reception.notes}</p>
          </div>
        ` : ''}
        
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">Signature du fournisseur</div>
            <div style="font-size: 8pt; margin-top: 5px;">Date: ${new Date(signature?.signed_at).toLocaleDateString()}</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Cachet et signature</div>
            <div style="font-size: 8pt; margin-top: 5px;">${settings?.company_name || ''}</div>
          </div>
        </div>
        
        <div class="footer">
          <p>Document signé électroniquement - Fait foi</p>
          <p>ID Signature: ${signature?.id} | Vérifiable sur: ${window.location.origin}/verify/${signature?.id}</p>
          <p>Généré le: ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `;
};

  // ==================== IMPRESSION ====================
// ==================== IMPRESSION ====================
/*const printOrder = async (order) => {
  setPrintLoading(order.id);
  try {
    const response = await authFetch(`/api/purchase-orders/${order.id}`);
    const result = await response.json();

    if (!result.success) {
      toast.error(t('error_loading_order'));
      setPrintLoading(null);
      return;
    }

    const orderData = result.data;
    const printWindow = window.open('', '_blank');
    const htmlContent = generateOrderPrintHtml(orderData);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  } catch (error) {
    console.error('Erreur impression:', error);
    toast.error(t('error_printing'));
  } finally {
    setPrintLoading(null);
  }
};*/

  const printOrder = async (order) => {
  setPrintLoading(order.id);
  try {
    const response = await purchaseOrderService.getById(order.id);

    if (!response.data?.success) {
      toast.error(response.data?.message || t('error_loading_order'));
      return;
    }

    const orderData = response.data.data;
    const htmlContent = generateOrderPrintHtml(orderData);
    
    // Option 1 : Ouvrir dans un nouvel onglet pour prévisualisation
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    } else {
      // Option 2 : Créer un iframe caché si popup bloqué
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      iframe.contentWindow.print();
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }
    
  } catch (error) {
    console.error('Erreur impression:', error);
    toast.error(getApiErrorMessage(error, t('error_printing')));
  } finally {
    setPrintLoading(null);
  }
};

const generateOrderPrintHtml = (order) => {
  // Calcul des totaux
  const subtotalAed = order.subtotal_aed || order.subtotal || 0;
  const subtotalUsd = order.subtotal_usd || 0;
  const subtotalBif = order.subtotal_bif || 0;
  const totalAed = order.total_amount_aed || order.total_amount || 0;
  const totalUsd = order.total_amount_usd || 0;
  const totalBif = order.total_amount_bif || 0;
  const totalProfit = order.total_expected_profit || 0;
  
  // Taux de change
  const rateAedToUsd = order.exchange_rate_aed_to_usd || 3.6725;
  const rateUsdToBif = order.exchange_rate_usd_to_bif || 2830;
    const supplierName = order.supplier_name 
    || order.supplier?.name 
    || order.supplierName 
    || order.vendor_name 
    || order.vendor?.name 
    || '-';
  
  const supplierPhone = order.supplier_phone 
    || order.supplier?.phone 
    || order.supplierPhone 
    || '-';
  
  const supplierEmail = order.supplier_email 
    || order.supplier?.email 
    || order.supplierEmail 
    || '-';
  
  const supplierCode = order.supplier_code 
    || order.supplier?.code 
    || order.supplierCode 
    || '-';
  
  const supplierContact = order.contact_person 
    || order.supplier?.contact_person 
    || order.supplierContact 
    || '-';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>COMMANDE FOURNISSEUR ${order.order_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { 
            size: A4; 
            margin: 15mm;
            @top-center {
              content: "Document officiel";
              font-size: 8pt;
              color: #666;
            }
          }
          body { 
            font-family: 'Times New Roman', Arial, sans-serif; 
            font-size: 10pt; 
            line-height: 1.3; 
            background: white; 
            color: #1e293b;
          }
          
          /* En-tête */
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 3px solid #667eea; 
            padding-bottom: 15px;
          }
          .header h1 { 
            color: #667eea; 
            font-size: 22pt;
            letter-spacing: 2px;
            margin-bottom: 5px;
          }
          .header .subtitle {
            font-size: 10pt;
            color: #64748b;
          }
          
          /* Informations société */
          .company-info {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8fafc;
            border-radius: 8px;
          }
          .company-name {
            font-size: 14pt;
            font-weight: bold;
            color: #1e293b;
          }
          .company-details {
            font-size: 9pt;
            color: #64748b;
            margin-top: 5px;
          }
          
          /* Grille d'informations */
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 25px;
          }
          .info-box {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
          }
          .info-box-title {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid #667eea;
            color: #1e293b;
          }
          .info-row {
            display: flex;
            padding: 5px 0;
            border-bottom: 1px dashed #e2e8f0;
          }
          .info-label {
            width: 130px;
            font-weight: 600;
            color: #475569;
          }
          .info-value {
            flex: 1;
            color: #1e293b;
          }
          
          /* Taux de change */
          .rates-box {
            margin-bottom: 25px;
            padding: 12px;
            background: linear-gradient(135deg, #f0fdf4, #dcfce7);
            border-radius: 8px;
            border-left: 4px solid #10b981;
          }
          .rates-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: #065f46;
          }
          .rates-list {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
          }
          .rate-item {
            background: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 9pt;
            font-family: monospace;
            border: 1px solid #a7f3d0;
          }
          
          /* Tableau des produits */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 9pt;
          }
          .items-table th {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 10px 8px;
            text-align: center;
            border: 1px solid #cbd5e1;
            font-weight: 600;
          }
          .items-table td {
            padding: 8px;
            border: 1px solid #cbd5e1;
            text-align: center;
          }
          .items-table td.text-left {
            text-align: left;
          }
          .items-table td.text-right {
            text-align: right;
          }
          
          /* Totaux */
          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .totals-table {
            width: 380px;
            border-collapse: collapse;
            background: #f8fafc;
            border-radius: 8px;
            overflow: hidden;
          }
          .totals-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          .totals-table tr:last-child td {
            border-bottom: none;
          }
          .totals-table .label {
            font-weight: 600;
            text-align: right;
          }
          .totals-table .value {
            text-align: right;
            font-weight: 500;
          }
          .grand-total {
            background: #e0e7ff;
            font-weight: bold;
          }
          .grand-total td {
            border-top: 2px solid #667eea;
            padding: 10px 12px;
          }
          
          /* Profit */
          .profit-box {
            margin-top: 20px;
            padding: 12px;
            background: #fef3c7;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            text-align: right;
          }
          .profit-label {
            font-weight: 600;
            color: #92400e;
          }
          .profit-value {
            font-size: 14pt;
            font-weight: bold;
            color: #d97706;
          }
          
          /* Notes */
          .notes-section {
            margin-top: 25px;
            padding: 12px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #64748b;
          }
          .notes-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #475569;
          }
          
          /* Signatures */
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 1px solid #1e293b;
            margin-top: 40px;
            padding-top: 8px;
            font-size: 9pt;
          }
          
          /* Footer */
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 8pt;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
          
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        <!-- En-tête -->
        <div class="header">
          <h1>BON DE COMMANDE</h1>
        </div>
        
        <!-- Informations société -->
        <div class="company-info">
          <div class="company-name">${settings?.company_name || ''}</div>
          <div class="company-details">
            NIF: ${settings?.company_nif || ''} | RC: ${settings?.company_rc || ''}| Centre: ${settings?.company_center || ''}<br>
            ${settings?.company_address || ''}, ${settings?.company_commune || ''}| Tél: ${settings?.company_phone || ''}
          </div>
        </div>

        
        <!-- Grille d'informations -->
        <div class="info-grid">
          <div class="info-box">
            <div class="info-box-title">📋 INFORMATIONS COMMANDE</div>
            <div class="info-row">
              <span class="info-label">N° Commande:</span>
              <span class="info-value">${order.order_number}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date commande:</span>
              <span class="info-value">${new Date(order.order_date).toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Livraison prévue:</span>
              <span class="info-value">${order.expected_delivery_date || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Priorité:</span>
              <span class="info-value">${order.priority}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Statut:</span>
              <span class="info-value">${order.status}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Devise:</span>
              <span class="info-value">AED (Dirham)</span>
            </div>
          </div>
          
          <div class="info-box">
            <div class="info-box-title">🏭 INFORMATIONS FOURNISSEUR</div>
            <div class="info-row">
              <span class="info-label">Fournisseur:</span>
              <span class="info-value">${order.supplier_name || order.supplier?.name || '-'}</span>
            </div>
            
              <div class="info-row">
    <span class="info-label">Code:</span>
    <span class="info-value">${supplierCode}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Contact:</span>
    <span class="info-value">${supplierContact}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Téléphone:</span>
    <span class="info-value">${supplierPhone}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Email:</span>
    <span class="info-value">${supplierEmail || '-'}</span>
  </div>
          </div>
        </div>
        
        <!-- Taux de change -->
        <div class="rates-box">
          <div class="rates-title">💱 TAUX DE CHANGE APPLIQUES</div>
          <div class="rates-list">
            <span class="rate-item">1 AED = ${rateAedToUsd} USD</span>
            <span class="rate-item">1 USD = ${rateUsdToBif} BIF</span>
            <span class="rate-item">1 AED = ${(rateAedToUsd * rateUsdToBif).toFixed(2)} BIF</span>
          </div>
        </div>
        
        <!-- Tableau des produits -->
        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="text-left">Produit</th>
              <th>Quantité</th>
              <th>Prix unitaire (AED)</th>
              <th>Prix unitaire (USD)</th>
              <th>Prix unitaire (BIF)</th>
              <th>Total (AED)</th>
              <th>Total (USD)</th>
              <th>Total (BIF)</th>
             
            </tr>
          </thead>
          <tbody>
            ${order.items?.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">
                  <strong>${item.product_name}</strong><br>
                  <small>${item.product_code}</small>
                </td>
                <td class="text-center">${item.quantity} ${item.unit || ''}</td>
                <td class="text-right">${formatNumber(item.unit_cost_aed)}</td>
                <td class="text-right">${formatNumber(item.unit_cost_usd)}</td>
                <td class="text-right">${formatNumber(item.unit_cost_bif)}</td>
                <td class="text-right">${formatNumber(item.total_cost_aed)}</td>
                <td class="text-right">${formatNumber(item.total_cost_usd)}</td>
                <td class="text-right">${formatNumber(item.total_cost_bif)}</td>
               
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Totaux -->
        <div class="totals-container">
          <table class="totals-table">
            <tr>
              <td class="label">Sous-total (AED):</td>
              <td class="value">${formatNumber(subtotalAed)} AED</td>
              <td class="label">Sous-total (USD):</td>
              <td class="value">${formatNumber(subtotalUsd)} USD</td>
            </tr>
            <tr>
              <td class="label">Sous-total (BIF):</td>
              <td class="value" colspan="3">${formatNumber(subtotalBif)} BIF</td>
            </tr>
            <tr class="grand-total">
              <td class="label"><strong>TOTAL (AED):</strong></td>
              <td class="value"><strong>${formatNumber(totalAed)} AED</strong></td>
              <td class="label"><strong>TOTAL (USD):</strong></td>
              <td class="value"><strong>${formatNumber(totalUsd)} USD</strong></td>
            </tr>
            <tr class="grand-total">
              <td class="label"><strong>TOTAL (BIF):</strong></td>
              <td class="value" colspan="3"><strong>${formatNumber(totalBif)} BIF</strong></td>
            </tr>
          </table>
        </div>
        
        <!-- Profit attendu -->
       
        
        <!-- Notes -->
        ${order.notes ? `
          <div class="notes-section">
            <div class="notes-title">📝 NOTES</div>
            <div>${order.notes}</div>
          </div>
        ` : ''}
        
        <!-- Signatures -->
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">Signature du fournisseur</div>
            <div style="font-size: 8pt; margin-top: 5px;">Lu et approuvé</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Signature et cachet</div>
            <div style="font-size: 8pt; margin-top: 5px;">${settings?.company_name || ''}</div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p>${t('print_footer')} | ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `;
};

  const printOrdersList = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = generateOrdersListHtml();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  
  const generateOrdersListHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${t('purchase_orders_list')}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 9pt; background: white; }
            h1 { text-align: center; color: #667eea; margin-bottom: 10px; }
            .filters-info { margin-bottom: 15px; font-size: 8pt; color: #64748b; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #667eea; color: white; padding: 8px; text-align: left; }
            td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
            .footer { margin-top: 20px; text-align: center; font-size: 7pt; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>${t('purchase_orders_list')}</h1>
          <div class="filters-info">${t('generated_on')}: ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>${t('order_number')}</th><th>${t('supplier')}</th><th>${t('order_date')}</th><th>${t('total_amount')}</th><th>${t('status')}</th><th>${t('priority')}</th></tr></thead>
            <tbody>
              ${orders.map(order => `
                <tr>
                  <td>${order.order_number}</td>
                  <td>${order.supplier_name}</td>
                  <td>${new Date(order.order_date).toLocaleDateString()}</td>
                  <td>${formatNumber(order.total_amount)} ${order.currency}</td>
                  <td>${order.status}</td>
                  <td>${order.priority}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">${t('print_footer')} | ${t('total_orders')}: ${orders.length}</div>
        </body>
      </html>
    `;
  };

  // ==================== CRÉATION/MODIFICATION DE COMMANDE ====================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = orderItems.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error(t('at_least_one_product'));
      return;
    }

    if (!formData.supplier_id) {
      toast.error(t('supplier_required'));
      return;
    }

    const confirmed = await Swal.fire({
      title: editingOrder ? t('confirm_update_order') : t('confirm_create_order'),
      text: editingOrder ? t('update_order_confirmation') : t('create_order_confirmation'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f1f5f9' : '#1e293b'
    });

    if (!confirmed.isConfirmed) return;

    setSubmitLoading(true);
    try {
      const payload = {
        supplier_id: formData.supplier_id.value,
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date,
        priority: formData.priority,
        currency: 'AED',
        exchange_rate_aed_to_usd: formData.exchange_rate_aed_to_usd,
        exchange_rate_usd_to_bif: formData.exchange_rate_usd_to_bif,
        notes: formData.notes,
        subtotal_aed: getSubtotalAed(),
        subtotal_usd: getSubtotalUsd(),
        subtotal_bif: getSubtotalBif(),
        total_amount_aed: getSubtotalAed(),
        total_amount_usd: getSubtotalUsd(),
        total_amount_bif: getSubtotalBif(),
        items: validItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost_aed: item.unit_cost_aed,
          unit_cost_usd: item.unit_cost_usd,
          unit_cost_bif: item.unit_cost_bif,
          total_cost_aed: item.total_cost_aed,
          total_cost_usd: item.total_cost_usd,
          total_cost_bif: item.total_cost_bif,
          expected_profit: item.expected_profit
        }))
      };

      let response;
      /*if (editingOrder) {
        response = await authFetch(`/api/purchase-orders/${editingOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await authFetch(`/api/purchase-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }*/

      if (editingOrder) {
          response = await purchaseOrderService.update(editingOrder.id, payload);
        } else {
          response = await purchaseOrderService.create(payload);
        }

     // const result = await response.json();

      if (response.data?.success) {
        toast.success(editingOrder ? t('order_updated') : t('order_created'));
        loadOrders(appliedFilters, currentPage);
        closeModal();
        resetForm();
      } else {
        toast.error(response.data?.message);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('error_saving_order'));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ==================== RÉCEPTION DE COMMANDE ====================
const handleReceptionFileUpload = (e) => {
  const files = Array.from(e.target.files);
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  const newFiles = files.map(file => {
    // Vérifier la taille
    if (file.size > maxSize) {
      toast.error(`${file.name} ${t('file_too_large')}`);
      return null;
    }
    
    return {
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    };
  }).filter(f => f !== null);
  
  setReceptionFiles(prev => [...prev, ...newFiles]);
  e.target.value = '';
};

const removeReceptionFile = (id) => {
  const file = receptionFiles.find(f => f.id === id);
  if (file?.preview) URL.revokeObjectURL(file.preview);
  setReceptionFiles(prev => prev.filter(f => f.id !== id));
};

  // const openReceptionModal = async (order) => {
  //   setSelectedOrder(order);

  //   const response = await authFetch(`/api/purchase-orders/${order.id}`);
  //   const result = await response.json();

  //   if (result.success) {
  //     const orderDetails = result.data;
  //     const items = (orderDetails.items || []).map(item => ({
  //       id: item.id,
  //       product_id: item.product_id,
  //       product_name: item.product_name,
  //       ordered_quantity: item.quantity,
  //       received_quantity: item.received_quantity || 0,
  //       remaining_quantity: item.quantity - (item.received_quantity || 0),
  //       to_receive: 0,
  //       unit: item.unit
  //     }));
  //     setReceptionItems(items);
  //   }

  //   setReceptionModalOpen(true);
  // };
const openReceptionModal = async (order) => {
  setSelectedOrder(order);

  try {
    const response = await purchaseOrderService.getById(order.id);

    if (response.data?.success) {
      const orderDetails = response.data.data;
      const items = (orderDetails.items || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        ordered_quantity: item.quantity,
        received_quantity: item.received_quantity || 0,
        remaining_quantity: item.quantity - (item.received_quantity || 0),
        to_receive: 0,
        unit: item.unit
      }));
      setReceptionItems(items);
    } else {
      toast.error(response.data?.message || t('error_loading_order_details'));
    }
  } catch (error) {
    console.error('Erreur chargement détails commande:', error);
    toast.error(getApiErrorMessage(error, t('error_loading_order_details')));
  }

  setReceptionModalOpen(true);
};
  /*const openAttachmentsModal = (reception) => {
  setCurrentReception(reception);
  setCurrentAttachments(reception.attachments || []);
  setAttachmentsModalOpen(true);
};*/
const openAttachmentsModal = async (reception) => {
  setCurrentReception(reception);
  setCurrentAttachments(reception.attachments || []);
  setAttachmentsModalOpen(true);
};

// Télécharger une pièce jointe
/*const downloadAttachment = async (attachment) => {
  try {
    const response = await authFetch(publicAssetUrl(attachment.file_path));
    const response = await purchaseOrderService.receive(selectedOrder.id, formData);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success(t('download_success'));
  } catch (error) {
    console.error('Erreur téléchargement:', error);
    toast.error(t('download_error'));
  }
};*/

  const downloadAttachment = async (attachment) => {
  try {
    await attachmentService.download(attachment.file_path, attachment.file_name);
    toast.success(t('download_success'));
  } catch (error) {
    console.error('Erreur téléchargement:', error);
    toast.error(getApiErrorMessage(error, t('download_error')));
  }
};

// Composant Modal des pièces jointes
/*const AttachmentsModal = () => (
  <div className="modal-overlay" onClick={() => setAttachmentsModalOpen(false)}>
    <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">📎</span>
        <h3>{t('attachments')} - {currentReception?.reception_number}</h3>
        <button className="modal-close" onClick={() => setAttachmentsModalOpen(false)}>✕</button>
      </div>
      <div className="modal-body">
        {currentAttachments.length === 0 ? (
          <div className="empty-state">
            <p>{t('no_attachments')}</p>
          </div>
        ) : (
          <div className="attachments-grid">
            {currentAttachments.map((att, idx) => (
              <div key={idx} className="attachment-card">
                <div className="attachment-preview">
                  {att.file_type?.startsWith('image/') ? (
                    <img 
                      src={publicAssetUrl(att.file_path)} 
                      alt={att.file_name}
                      className="preview-image"
                    />
                  ) : (
                    <div className="preview-icon">📄</div>
                  )}
                </div>
                <div className="attachment-info">
                  <div className="attachment-name" title={att.file_name}>
                    {att.file_name.length > 30 ? att.file_name.substring(0, 27) + '...' : att.file_name}
                  </div>
                  <div className="attachment-meta">
                    <span className="attachment-size">{(att.file_size / 1024).toFixed(2)} KB</span>
                    <button 
                      className="btn-download" 
                      onClick={() => downloadAttachment(att)}
                    >
                      📥
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setAttachmentsModalOpen(false)}>
          {t('close')}
        </button>
      </div>
    </div>
  </div>
);*/

  const AttachmentsModalContent = () => (
  <div className="modal-body">
    {currentAttachments.length === 0 ? (
      <div className="empty-state">
        <p>{t('no_attachments')}</p>
      </div>
    ) : (
      <div className="attachments-grid">
        {currentAttachments.map((att, idx) => (
          <div key={idx} className="attachment-card">
            <div className="attachment-preview">
              {isImageFile(att.file_name) ? (
                <img 
                  src={publicAssetUrl(att.file_path)} 
                  alt={att.file_name}
                  className="preview-image"
                  loading="lazy"
                  onClick={() => openFileViewer(att)}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <div className="preview-icon">{getFileIcon(att.file_name, att.file_type)}</div>
              )}
            </div>
            <div className="attachment-info">
              <div className="attachment-name" title={att.file_name}>
                {att.file_name.length > 30 ? att.file_name.substring(0, 27) + '...' : att.file_name}
              </div>
              <div className="attachment-meta">
                <span className="attachment-size">{formatFileSize(att.file_size)}</span>
                <button 
                  className="btn-download" 
                  onClick={() => downloadAttachment(att)}
                  title={t('download')}
                >
                  📥
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Imprimer le bon de réception (avec vérification si déjà généré)
/*const printReception = async (reception, order) => {
  // Vérifier si le bon de réception a déjà été généré
  if (generatedReceptions[reception.id]) {
    // Ouvrir l'aperçu du bon déjà généré
    setPrintPreviewContent(generatedReceptions[reception.id]);
    setCurrentPrintReception(reception);
    setPrintPreviewModalOpen(true);
    return;
  }
  
  setPrintLoading(reception.id);
  try {
    const response = await authFetch(`/api/purchase-orders/receptions/${reception.id}/print`);
    const result = await response.json();
    
    if (result.success) {
      const receptionData = result.data;
      const htmlContent = generateReceptionPrintHtml(receptionData, order);
      
      // Sauvegarder le HTML généré
      setGeneratedReceptions(prev => ({
        ...prev,
        [reception.id]: htmlContent
      }));
      
      setPrintPreviewContent(htmlContent);
      setCurrentPrintReception(reception);
      setPrintPreviewModalOpen(true);
    } else {
      toast.error(result.message);
    }
  } catch (error) {
    console.error('Erreur impression:', error);
    toast.error(t('print_error'));
  } finally {
    setPrintLoading(null);
  }
};*/

  const printReception = async (reception, order) => {
  // Vérifier si le bon de réception a déjà été généré
  if (generatedReceptions[reception.id]) {
    // Ouvrir l'aperçu du bon déjà généré
    setPrintPreviewContent(generatedReceptions[reception.id]);
    setCurrentPrintReception(reception);
    setPrintPreviewModalOpen(true);
    return;
  }
  
  setPrintLoading(reception.id);
  try {
    const response = await receptionService.print(reception.id);
    
    if (response.data?.success) {
      const receptionData = response.data.data;
      const htmlContent = generateReceptionPrintHtml(receptionData, order);
      
      // Sauvegarder le HTML généré
      setGeneratedReceptions(prev => ({
        ...prev,
        [reception.id]: htmlContent
      }));
      
      setPrintPreviewContent(htmlContent);
      setCurrentPrintReception(reception);
      setPrintPreviewModalOpen(true);
    } else {
      toast.error(response.data?.message || t('print_error'));
    }
  } catch (error) {
    console.error('Erreur impression:', error);
    toast.error(getApiErrorMessage(error, t('print_error')));
  } finally {
    setPrintLoading(null);
  }
};

// Confirmer l'impression du bon de réception
const confirmPrintReception = () => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printPreviewContent);
  printWindow.document.close();
  printWindow.print();
  setPrintPreviewModalOpen(false);
};

/*const openFileViewer = async (attachment) => {
  setViewerLoading(true);
  try {
    const response = await authFetch(publicAssetUrl(attachment.file_path));
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const fileInfo = {
      ...attachment,
      blobUrl: blobUrl,
      blob: blob
    };
    
    setViewerFile(fileInfo);
    setViewerModalOpen(true);
  } catch (error) {
    console.error('Erreur:', error);
    toast.error('Impossible de charger le fichier');
  } finally {
    setViewerLoading(false);
  }
};*/

  const openFileViewer = async (attachment) => {
  setViewerLoading(true);
  try {
    if (isImageFile(attachment.file_name)) {
      // Pour les images, utiliser l'URL directe
      const imageUrl = publicAssetUrl(attachment.file_path);
      setViewerFile({
        ...attachment,
        blobUrl: imageUrl,
        isImage: true
      });
    } else {
      // Pour les PDF et autres, utiliser le service
      await attachmentService.view(attachment.file_path);
      setViewerModalOpen(false);
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(getApiErrorMessage(error, t('error_viewing_file')));
  } finally {
    setViewerLoading(false);
  }
};

// Fermer et nettoyer l'URL
const closeFileViewer = () => {
  if (viewerFile?.blobUrl) {
    URL.revokeObjectURL(viewerFile.blobUrl);
  }
  setViewerFile(null);
  setViewerModalOpen(false);
};

const openEditReception = (reception) => {
  setEditReceptionData(reception);
  setEditingReceptionItems(reception.items || []);
  setEditReceptionModalOpen(true);
};

// const handleEditReceptionSubmit = async (e) => {
//   e.preventDefault();
//   setSubmitLoading(true);
  
//   try {
//     const response = await authFetch(`/api/receptions/${editReceptionData.id}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         reception_date: editReceptionData.reception_date,
//         notes: editReceptionData.notes,
//         items: editingReceptionItems
//       })
//     });
    
//     const result = await response.json();
    
//     if (result.success) {
//       toast.success(t('reception_updated'));
//       setEditReceptionModalOpen(false);
//       loadOrders(appliedFilters, currentPage);
//     } else {
//       toast.error(result.message);
//     }
//   } catch (error) {
//     toast.error(t('error_updating_reception'));
//   } finally {
//     setSubmitLoading(false);
//   }
// };

  const handleEditReceptionSubmit = async (e) => {
  e.preventDefault();
  setSubmitLoading(true);
  
  try {
    const response = await receptionService.update(editReceptionData.id, {
      reception_date: editReceptionData.reception_date,
      notes: editReceptionData.notes,
      items: editingReceptionItems
    });
    
    if (response.data?.success) {
      toast.success(t('reception_updated'));
      setEditReceptionModalOpen(false);
      loadOrders(appliedFilters, currentPage);
    } else {
      toast.error(response.data?.message || t('error_updating_reception'));
    }
  } catch (error) {
    console.error('Erreur mise à jour réception:', error);
    toast.error(getApiErrorMessage(error, t('error_updating_reception')));
  } finally {
    setSubmitLoading(false);
  }
};

// Modal de signature
const [signatureModalOpen, setSignatureModalOpen] = useState(false);
const [signatureData, setSignatureData] = useState({ signed_by: '', accept_terms: false });

const openSignatureModal = (reception) => {
  setEditReceptionData(reception);
  setSignatureModalOpen(true);
};

/*const handleSignReception = async () => {
  if (!signatureData.signed_by) {
    toast.error(t('signature_name_required'));
    return;
  }
  
  if (!signatureData.accept_terms) {
    toast.error(t('accept_terms_required'));
    return;
  }
  
  setSubmitLoading(true);
  
  try {
    const response = await authFetch(`/api/receptions/${editReceptionData.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signed_by: signatureData.signed_by,
        total_quantity: editingReceptionItems.reduce((sum, item) => sum + item.received_quantity, 0),
        signature_data: {
          signed_at: new Date().toISOString(),
          ip_address: await fetch('https://api.ipify.org?format=json').then(res => res.json()).then(data => data.ip)
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      toast.success(t('reception_signed_success'));
      setSignatureModalOpen(false);
      loadOrders(appliedFilters, currentPage);
    } else {
      toast.error(result.message);
    }
  } catch (error) {
    toast.error(t('error_signing_reception'));
  } finally {
    setSubmitLoading(false);
  }
};*/

  const handleSignReception = async () => {
  if (!signatureData.signed_by) {
    toast.error(t('signature_name_required'));
    return;
  }
  
  if (!signatureData.accept_terms) {
    toast.error(t('accept_terms_required'));
    return;
  }
  
  // Vérifier que des articles ont été reçus
  const totalQty = editingReceptionItems.reduce((sum, item) => sum + (parseFloat(item.received_quantity) || 0), 0);
  if (totalQty === 0) {
    toast.error(t('no_items_received'));
    return;
  }
  
  setSubmitLoading(true);
  
  try {
    const ipAddress = await getClientIP();
    
    const payload = {
      signed_by: signatureData.signed_by,
      total_quantity: totalQty,
      signature_data: {
        signed_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: navigator.userAgent
      }
    };
    
    const response = await receptionService.sign(editReceptionData.id, payload);
    
    if (response.data?.success) {
      toast.success(t('reception_signed_success'));
      setSignatureModalOpen(false);
      
      // Réinitialiser les données de signature
      setSignatureData({ signed_by: '', accept_terms: false });
      
      // Recharger les commandes
      loadOrders(appliedFilters, currentPage);
    } else {
      toast.error(response.data?.message || t('error_signing_reception'));
    }
  } catch (error) {
    console.error('Erreur signature réception:', error);
    
    let errorMessage = t('error_signing_reception');
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    toast.error(errorMessage);
  } finally {
    setSubmitLoading(false);
  }
};
// Générer le HTML du bon de réception (version complète)
const generateReceptionPrintHtml = (reception, order) => {
  const totalQuantity = reception.items?.reduce((sum, item) => sum + item.received_quantity, 0) || 0;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>BON DE RÉCEPTION ${reception.reception_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 10pt; line-height: 1.3; background: white; color: #1e293b; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
          .header h1 { color: #667eea; font-size: 18pt; }
          .company-info { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 14pt; font-weight: bold; }
          .info-section { margin-bottom: 20px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .info-table td { padding: 6px; border: 1px solid #cbd5e1; }
          .info-label { font-weight: bold; width: 140px; background: #f1f5f9; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th { background: #667eea; color: white; padding: 10px; text-align: center; border: 1px solid #cbd5e1; }
          .items-table td { padding: 8px; border: 1px solid #cbd5e1; text-align: center; }
          .items-table td.text-left { text-align: left; }
          .totals { width: 300px; margin-left: auto; margin-top: 20px; border-collapse: collapse; }
          .totals td { padding: 6px; }
          .totals .total-label { text-align: right; font-weight: bold; }
          .totals .total-value { text-align: right; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature-box { text-align: center; width: 200px; }
          .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 8px; }
          .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BON DE RÉCEPTION</h1>
          <p>N° ${reception.reception_number}</p>
        </div>
        
        <div class="company-info">
          <div class="company-name">${order.company_name || 'ENISA BUSINESS COMPANY'}</div>
          <div>NIF: ${order.company_nif || '4002141416'} | RC: ${order.company_rc || '0041847/23'}</div>
          <div>${order.company_address || 'ROHERO'}, ${order.company_commune || 'MUKAZA'}</div>
          <div>Tél: ${order.company_phone || '00 000 000'}</div>
        </div>
        
        <div class="info-section">
          <table class="info-table">
            <tr>
              <td class="info-label">${t('order_number')}:</td>
              <td>${order.order_number}</td>
              <td class="info-label">${t('supplier')}:</td>
              <td>${order.supplier_name}</td>
            </tr>
            <tr>
              <td class="info-label">${t('reception_date')}:</td>
              <td>${new Date(reception.reception_date).toLocaleString()}</td>
              <td class="info-label">${t('received_by')}:</td>
              <td>${reception.received_by_name || '-'}</td>
            </tr>
            <tr>
              <td class="info-label">${t('order_date')}:</td>
              <td>${new Date(order.order_date).toLocaleString()}</td>
              <td class="info-label">${t('expected_delivery')}:</td>
              <td>${order.expected_delivery_date || '-'}</td>
            </tr>
          </table>
        </div>
        
        <h3>📦 ${t('products_received')}</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="text-left">${t('product')}</th>
              <th>${t('quantity')}</th>
              <th>${t('unit')}</th>
            </tr>
          </thead>
          <tbody>
            ${reception.items?.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="text-left">${item.product_name}</td>
                <td>${item.received_quantity}</td>
                <td>${item.unit || 'PIECE'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9;">
              <td colspan="2" class="text-right"><strong>${t('total')}:</strong></td>
              <td><strong>${totalQuantity}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        
        ${reception.notes ? `
          <div class="notes-section">
            <strong>📝 ${t('notes')}:</strong>
            <p>${reception.notes}</p>
          </div>
        ` : ''}
        
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">${t('signature_supplier')}</div>
            <div style="font-size: 8pt; margin-top: 5px;">${t('date')}: ________</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">${t('signature_receiver')}</div>
            <div style="font-size: 8pt; margin-top: 5px;">${t('date')}: ${new Date().toLocaleDateString()}</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">${t('company_stamp')}</div>
            <div style="font-size: 8pt; margin-top: 5px;">${order.company_name || 'MUHIZI BLESSED COMPANY'}</div>
          </div>
        </div>
        
        <div class="footer">
          <p>${t('document_generated_automatically')}</p>
          <p>${t('generated_on')}: ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `;
};


const handleReceptionSubmit = async (e) => {
  e.preventDefault();
  
  const itemsToReceive = receptionItems.filter(item => item.to_receive > 0);
  
  if (itemsToReceive.length === 0) {
    toast.error(t('no_items_to_receive'));
    return;
  }
  
  const confirmed = await Swal.fire({
    title: t('confirm_reception'),
    text: t('reception_confirmation'),
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#ef4444',
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b'
  });
  
  if (!confirmed.isConfirmed) return;
  
  setReceptionLoading(true);
  
  const formData = new FormData();
  formData.append('reception_date', receptionData.reception_date);
  formData.append('notes', receptionData.notes || '');
  formData.append('items', JSON.stringify(itemsToReceive.map(item => ({
    order_item_id: item.id,
    product_id: item.product_id,
    received_quantity: item.to_receive
  }))));
  
  // Ajouter les fichiers
  receptionFiles.forEach(file => {
    formData.append('attachments[]', file.file);
  });
  
  try {
   // const response = await authFetch(`/api/purchase-orders/${selectedOrder.id}/receive`, {
   const response = await purchaseOrderService.receive(selectedOrder.id, formData);
    
    //const result = await response.json();
    
    if (response.data?.success) {
      toast.success(t('reception_success'));
      setReceptionModalOpen(false);
      // Nettoyer les fichiers
      receptionFiles.forEach(file => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
      setReceptionFiles([]);
      resetReceptionForm();
      loadOrders(appliedFilters, currentPage);
    } else {
       toast.error(getApiErrorMessage(response, t('error_operation_failed')));
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(t('error_reception'));
  } finally {
    setReceptionLoading(false);
  }
};

  const updateReceptionItem = (id, field, value) => {
    setReceptionItems(prev => prev.map(item => {
      if (item.id === id) {
        const maxReceive = item.remaining_quantity;
        const receiveValue = Math.min(parseFloat(value) || 0, maxReceive);
        return { ...item, [field]: receiveValue };
      }
      return item;
    }));
  };

  // ==================== RÉINITIALISATION DES FORMULAIRES ====================
  const resetForm = () => {
    setFormData({
      supplier_id: null,
      order_date: new Date().toISOString().slice(0, 16),
      expected_delivery_date: '',
      priority: 'normal',
      currency: 'AED',
      exchange_rate_aed_to_usd: 3.6725,
      exchange_rate_usd_to_bif: 2830,
      notes: ''
    });
    setOrderItems([{
      id: Date.now(),
      product_id: null,
      quantity: 1,
      unit_cost_aed: 0,
      unit_cost_usd: 0,
      unit_cost_bif: 0,
      total_cost_aed: 0,
      total_cost_usd: 0,
      total_cost_bif: 0,
      received_quantity: 0,
      product_name: '',
      product_code: '',
      unit: '',
      selling_price: 0,
      purchase_price: 0,
      expected_profit: 0,
      profit_margin: 0
    }]);
    setEditingOrder(null);
  };

  const resetReceptionForm = () => {
    setReceptionData({
      reception_date: new Date().toISOString().slice(0, 16),
      notes: ''
    });
    setReceptionItems([]);
  };

  // ==================== OUVERTURE/FERMETURE DES MODAUX ====================
const openModal = async (order = null) => {
  if (order) {
    // Validation des données de base
    if (!order.id || !order.supplier_id) {
      toast.error(t('invalid_order_data'));
      return;
    }
    
    setEditingOrder(order);
    setFormData({
      supplier_id: { value: order.supplier_id, label: order.supplier_name },
      order_date: order.order_date?.slice(0, 16) || new Date().toISOString().slice(0, 16),
      expected_delivery_date: order.expected_delivery_date || '',
      priority: order.priority || 'normal',
      currency: order.currency || 'AED',
      exchange_rate_aed_to_usd: order.exchange_rate_aed_to_usd || 3.6725,
      exchange_rate_usd_to_bif: order.exchange_rate_usd_to_bif || 2830,
      notes: order.notes || ''
    });
    
    setLoadingDetails(true);
    
    try {
      const response = await purchaseOrderService.getById(order.id);
      
      if (response.data?.success && response.data.data) {
        const orderData = response.data.data;
        const items = (orderData.items || []).map(item => {
          // Validation des valeurs numériques
          const quantity = parseFloat(item.quantity);
          const receivedQty = parseFloat(item.received_quantity) || 0;
          const unitCostAed = parseFloat(item.unit_cost_aed);
          const unitCostUsd = parseFloat(item.unit_cost_usd);
          const unitCostBif = parseFloat(item.unit_cost_bif);
          
          return {
            id: item.id || Date.now(),
            product_id: item.product_id,
            quantity: isNaN(quantity) ? 1 : quantity,
            received_quantity: receivedQty,
            remaining_quantity: quantity - receivedQty,
            unit_cost_aed: isNaN(unitCostAed) ? 0 : unitCostAed,
            unit_cost_usd: isNaN(unitCostUsd) ? 0 : unitCostUsd,
            unit_cost_bif: isNaN(unitCostBif) ? 0 : unitCostBif,
            total_cost_aed: quantity * (isNaN(unitCostAed) ? 0 : unitCostAed),
            total_cost_usd: quantity * (isNaN(unitCostUsd) ? 0 : unitCostUsd),
            total_cost_bif: quantity * (isNaN(unitCostBif) ? 0 : unitCostBif),
            product_name: item.product_name || '',
            product_code: item.product_code || '',
            unit: item.unit || 'PIECE',
            selling_price: parseFloat(item.selling_price) || 0,
            purchase_price: parseFloat(item.purchase_price) || 0,
            expected_profit: parseFloat(item.expected_profit) || 0,
            profit_margin: parseFloat(item.profit_margin) || 0
          };
        });
        
        setOrderItems(items);
        
        // Vérifier la source des prix
        const productMap = new Map(productOptions.map(p => [p.value, p]));
        const customPricesCount = items.filter(item => {
          const product = productMap.get(item.product_id);
          return product && Math.abs(item.unit_cost_aed - (product.purchase_price_aed || 0)) > 0.01;
        }).length;
        
        const hasCustomPrices = customPricesCount > 0;
        setPriceSource(hasCustomPrices ? 'live' : 'database');
        setShowPriceSettings(hasCustomPrices);
        
        // Afficher un message si des prix personnalisés sont chargés
        if (hasCustomPrices) {
          toast.info(t('custom_prices_loaded'));
        }
      } else {
        toast.warning(t('partial_order_data'));
        // Utiliser les données existantes de l'ordre
        if (order.items && order.items.length > 0) {
          setOrderItems(order.items);
        }
      }
    } catch (error) {
      console.error('Erreur chargement détails commande:', error);
      toast.error(getApiErrorMessage(error, t('error_loading_order_details')));
      
      // Fallback : utiliser les données existantes
      if (order.items && order.items.length > 0) {
        setOrderItems(order.items);
      }
    } finally {
      setLoadingDetails(false);
    }
  } else {
    // Mode création
    resetForm();
    setPriceSource('database');
    setShowPriceSettings(false);
    setOrderItems([{
      id: Date.now(),
      product_id: null,
      quantity: 1,
      unit_cost_aed: 0,
      unit_cost_usd: 0,
      unit_cost_bif: 0,
      total_cost_aed: 0,
      total_cost_usd: 0,
      total_cost_bif: 0,
      received_quantity: 0,
      product_name: '',
      product_code: '',
      unit: '',
      selling_price: 0,
      purchase_price: 0,
      expected_profit: 0,
      profit_margin: 0
    }]);
  }
  setModalOpen(true);
};

const closeModal = () => {
    setModalOpen(false);
    setEditingOrder(null);
};

// Fonction sécurisée pour formater la marge
const formatMargin = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.0';
  return num.toFixed(1);
};

/*const viewOrderDetail = async (order) => {
  console.log('Order sélectionné:', order);
  
  try {
    const response = await authFetch(`/api/purchase-orders/${order.id}`);
    const result = await response.json();
    
    if (result.success) {
      // Nettoyer les données des items pour s'assurer que profit_margin est un nombre
      const cleanOrder = {
        ...result.data,
        items: result.data.items?.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          received_quantity: parseFloat(item.received_quantity) || 0,
          unit_cost_aed: parseFloat(item.unit_cost_aed) || 0,
          unit_cost_usd: parseFloat(item.unit_cost_usd) || 0,
          unit_cost_bif: parseFloat(item.unit_cost_bif) || 0,
          total_cost_aed: parseFloat(item.total_cost_aed) || 0,
          total_cost_bif: parseFloat(item.total_cost_bif) || 0,
          expected_profit: parseFloat(item.expected_profit) || 0,
          profit_margin: parseFloat(item.profit_margin) || 0
        })) || []
      };
      console.log('Détails complets nettoyés:', cleanOrder);
      setSelectedOrder(cleanOrder);
    } else {
      console.warn('Impossible de charger les détails, utilisation des données existantes');
      setSelectedOrder(order);
    }
    setDetailModalOpen(true);
  } catch (error) {
    console.error('Erreur chargement détails:', error);
    setSelectedOrder(order);
    setDetailModalOpen(true);
  }
};*/

  const viewOrderDetail = async (order) => {
  console.log('Order sélectionné:', order);
  
  try {
    const response = await purchaseOrderService.getById(order.id);
    
    if (response.data?.success) {
      // Nettoyer les données des items pour s'assurer que profit_margin est un nombre
      const cleanOrder = {
        ...response.data.data,
        items: response.data.data.items?.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          received_quantity: parseFloat(item.received_quantity) || 0,
          unit_cost_aed: parseFloat(item.unit_cost_aed) || 0,
          unit_cost_usd: parseFloat(item.unit_cost_usd) || 0,
          unit_cost_bif: parseFloat(item.unit_cost_bif) || 0,
          total_cost_aed: parseFloat(item.total_cost_aed) || 0,
          total_cost_bif: parseFloat(item.total_cost_bif) || 0,
          expected_profit: parseFloat(item.expected_profit) || 0,
          profit_margin: parseFloat(item.profit_margin) || 0
        })) || []
      };
      console.log('Détails complets nettoyés:', cleanOrder);
      setSelectedOrder(cleanOrder);
    } else {
      console.warn('Impossible de charger les détails, utilisation des données existantes');
      setSelectedOrder(order);
    }
    setDetailModalOpen(true);
  } catch (error) {
    console.error('Erreur chargement détails:', error);
    setSelectedOrder(order);
    setDetailModalOpen(true);
  }
};

// Changer le statut des commandes sélectionnées
const handleBulkStatusChange = async () => {
  if (selectedOrders.length === 0) {
    toast.error(t('select_orders'));
    return;
  }

  const result = await Swal.fire({
    title: t('confirm_bulk_status_change'),
    text: t('confirm_bulk_status_change_desc').replace('{count}', selectedOrders.length),
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#64748b',
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b'
  });

  if (!result.isConfirmed) return;

  setBulkLoading(true);
  
  try {
    // Exécuter toutes les requêtes en parallèle
    const promises = selectedOrders.map(id => 
      purchaseOrderService.updateStatus(id, 'pending')
        .then(response => ({ id, success: response.data?.success }))
        .catch(error => ({ id, success: false, error }))
    );
    
    const results = await Promise.all(promises);
    
    const updated = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (failed > 0) {
      toast(t('bulk_status_change_partial').replace('{updated}', updated).replace('{failed}', failed), { icon: '⚠️' });
    } else {
      toast.success(t('bulk_status_change_success').replace('{count}', updated));
    }
    
    setSelectedOrders([]);
    loadOrders(appliedFilters, currentPage);
  } catch (error) {
    console.error('Erreur lors du changement de statut groupé:', error);
    toast.error(t('error_bulk_status_change'));
  } finally {
    setBulkLoading(false);
  }
};

// Suppression groupée des commandes
const handleBulkDelete = async () => {
  if (selectedOrders.length === 0) {
    toast.error(t('select_orders'));
    return;
  }

  const result = await Swal.fire({
    title: t('confirm_bulk_delete'),
    text: t('confirm_bulk_delete_desc').replace('{count}', selectedOrders.length),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: t('delete'),
    cancelButtonText: t('cancel'),
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b'
  });

  if (!result.isConfirmed) return;

  setBulkLoading(true);
  
  try {
    // Exécuter toutes les suppressions en parallèle
    const promises = selectedOrders.map(id => 
      purchaseOrderService.delete(id)
        .then(response => ({ id, success: response.data?.success }))
        .catch(error => ({ id, success: false, error }))
    );
    
    const results = await Promise.all(promises);
    
    const deleted = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (failed > 0) {
      toast(t('bulk_delete_partial').replace('{deleted}', deleted).replace('{failed}', failed), { icon: '⚠️' });
    } else {
      toast.success(t('bulk_delete_success').replace('{count}', deleted));
    }
    
    setSelectedOrders([]);
    loadOrders(appliedFilters, currentPage);
  } catch (error) {
    console.error('Erreur lors de la suppression groupée:', error);
    toast.error(t('error_bulk_delete'));
  } finally {
    setBulkLoading(false);
  }
};

  // ==================== FILTRES ====================
  const applyFilters = () => {
    const params = {};
    if (filters.order_number) params.order_number = filters.order_number;
    if (filters.supplier_id) params.supplier_id = filters.supplier_id.value;
    if (filters.status) params.status = filters.status;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;

    loadOrders(params, 1);
    setFilterModalOpen(false);
    toast.success(t('filters_applied'));
  };

  const resetFilters = () => {
    setFilters({
      order_number: '',
      supplier_id: null,
      status: '',
      date_from: '',
      date_to: ''
    });
    loadOrders({}, 1);
    setFilterModalOpen(false);
    toast.success(t('filters_reset'));
  };

  const refreshOrders = () => {
    loadOrders(appliedFilters, currentPage);
    toast.success(t('refresh_success'));
  };

  // ==================== ACTIONS GROUPÉES ====================
  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // ==================== EXPORT CSV ====================
const exportOrdersToCSV = async () => {
  toast(t('export_preparing'));
  try {
    // Récupérer toutes les commandes (avec pagination automatique)
    let allOrders = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await purchaseOrderService.getAll({ page, limit: 1000 });
      const orders = response.data?.data || [];
      allOrders = [...allOrders, ...orders];
      
      hasMore = orders.length === 1000;
      page++;
    }

    if (allOrders.length === 0) {
      toast.error(t('export_no_data'));
      return;
    }

    // Traitement par lots pour éviter de bloquer l'interface
    const BATCH_SIZE = 500;
    let csvRows = [];
    
    for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
      const batch = allOrders.slice(i, i + BATCH_SIZE);
      const batchRows = batch.map(o => [
        o.order_number,
        o.supplier_name,
        new Date(o.order_date).toLocaleDateString(),
        o.expected_delivery_date || '-',
        o.total_amount,
        o.currency,
        o.status,
        o.priority
      ]);
      csvRows.push(...batchRows);
      
      // Mettre à jour la progression
      toast.loading(t('export_progress').replace('{current}', Math.min(i + BATCH_SIZE, allOrders.length)).replace('{total}', allOrders.length), {
        id: 'export-progress'
      });
    }
    
    const headers = [
      t('order_number'), t('supplier'), t('order_date'), t('expected_delivery'),
      t('total_amount'), t('currency'), t('status'), t('priority')
    ];

    const csvContent = [headers, ...csvRows].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `purchase_orders_${new Date().toISOString().slice(0, 19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('export_success_orders').replace('{count}', allOrders.length), { id: 'export-progress' });
  } catch (error) {
    console.error('Erreur export CSV:', error);
    toast.error(getApiErrorMessage(error, t('export_error')));
  }
};

  // ==================== STYLES POUR REACT-SELECT ====================
  const selectStyles = {
    control: (base) => ({
      ...base,
      background: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      minHeight: '38px',
    }),
    menu: (base) => ({
      ...base,
      background: isDark ? '#1e293b' : '#ffffff',
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? (isDark ? '#334155' : '#f1f5f9') : (isDark ? '#1e293b' : '#ffffff'),
      color: isDark ? '#f1f5f9' : '#1e293b',
    }),
    singleValue: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#1e293b',
    }),
    input: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#1e293b',
    }),
    placeholder: (base) => ({
      ...base,
      color: isDark ? '#94a3b8' : '#64748b',
    }),
  };

  useEffect(() => {
  console.log('orderItems mis à jour:', orderItems);
}, [orderItems]);

useEffect(() => {
  if (signedReceptions.length > 0) {
    console.log('signedReceptions data:', signedReceptions);
  }
}, [signedReceptions]);

  // ==================== ENREGISTREMENT DES ACTIONS ====================
  useEffect(() => {
    registerAction('add', () => openModal());
    registerAction('export', () => exportOrdersToCSV());
    registerAction('print', () => printOrdersList());
    registerAction('filter', () => setFilterModalOpen(true));
    registerAction('refresh', () => refreshOrders());

    return () => {
      unregisterAction('add');
      unregisterAction('export');
      unregisterAction('print');
      unregisterAction('filter');
      unregisterAction('refresh');
    };
  }, []);
 

 
  // Synchroniser les prix live avec les items existants
useEffect(() => {
  if (priceSource === 'live' && livePrices.unit_cost_aed > 0) {
    setOrderItems(prev => prev.map(item => {
      if (item.product_id) {
        const qty = item.quantity || 0;
        return {
          ...item,
          unit_cost_aed: livePrices.unit_cost_aed,
          unit_cost_usd: livePrices.unit_cost_usd,
          unit_cost_bif: livePrices.unit_cost_bif,
          selling_price: livePrices.selling_price || item.selling_price,
          total_cost_aed: qty * livePrices.unit_cost_aed,
          total_cost_usd: qty * livePrices.unit_cost_usd,
          total_cost_bif: qty * livePrices.unit_cost_bif,
          expected_profit: ((livePrices.selling_price || item.selling_price) - livePrices.unit_cost_bif) * qty,
          profit_margin: livePrices.unit_cost_bif > 0 
            ? (((livePrices.selling_price || item.selling_price) - livePrices.unit_cost_bif) / livePrices.unit_cost_bif * 100) 
            : 0
        };
      }
      return item;
    }));
  }
}, [livePrices, priceSource]);

  // ==================== CHARGEMENT INITIAL ====================
  useEffect(() => {
    isMounted.current = true;
    loadReferenceData();
    loadOrders({}, 1);
    loadExchangeRates();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const totalExpectedProfit = getTotalExpectedProfit();

  if (loading) return <Loader fullScreen text={t('loading_orders')} transparent={true} />;

  const ORDER_STATUSES = getOrderStatuses(t);
  const PRIORITIES = getPriorities(t);

  // ==================== RENDU JSX ====================
  return (
    <div className={`purchase-orders-page ${isDark ? 'dark' : 'light'}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#1e293b',
          },
        }}
      />

      {/* Header */}
      <div className="page-header">
        <div>
          <h2>📦 {t('purchase_orders')}</h2>
          <p>{t('purchase_orders_desc')}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">📋 {t('total_orders')}: {totalItems}</span>
          <span className="stat-value">
  💰 {t('total_value')} (BIF): {formatCurrency(orders.reduce((sum, o) => sum + (parseFloat(o.total_amount_bif) || 0), 0))}
    </span>


    <span className="stat-profit">
      📈 {t('expected_profit')}: {formatCurrency(orders.reduce((sum, o) => sum + (parseFloat(o.total_expected_profit) || 0), 0))}&nbsp;BIF
    </span>
        <button className="btn-exchange-rate" onClick={openExchangeRateModal}>
            💱 {t('manage_exchange_rates')}
          </button>
        </div>
      </div>

      {/* Actions groupées */}
      {selectedOrders.length > 0 && (
        <div className="bulk-actions-bar">
            <span className="bulk-count">{selectedOrders.length} {t('selected')}</span>
            <button 
            className="bulk-status-btn" 
            onClick={handleBulkStatusChange}
            disabled={bulkLoading}
            >
            {bulkLoading ? <span className="btn-spinner-small"></span> : '📋'} {t('change_status_to_pending')}
            </button>
            <button 
            className="bulk-delete-btn" 
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            >
            {bulkLoading ? <span className="btn-spinner-small"></span> : '🗑️'} {t('delete_selected')}
            </button>
            <button 
            className="bulk-print-btn" 
            onClick={printOrdersList}
            disabled={bulkLoading}
            >
            🖨️ {t('print_list')}
            </button>
            <button 
            className="bulk-clear-btn" 
            onClick={() => setSelectedOrders([])}
            disabled={bulkLoading}
            >
            ✕
            </button>
        </div>
        )}

      {/* Filtres actifs */}
      {Object.keys(appliedFilters).length > 0 && Object.values(appliedFilters).some(v => v) && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">{t('active_filters')}:</span>
          {appliedFilters.order_number && <span className="filter-tag">{t('order_number')}: {appliedFilters.order_number}</span>}
          {appliedFilters.supplier_id && <span className="filter-tag">{t('supplier')}: {suppliers.find(s => s.id == appliedFilters.supplier_id)?.name}</span>}
          {appliedFilters.status && <span className="filter-tag">{t('status')}: {ORDER_STATUSES.find(s => s.value === appliedFilters.status)?.label}</span>}
          {appliedFilters.date_from && <span className="filter-tag">{t('from')}: {appliedFilters.date_from}</span>}
          {appliedFilters.date_to && <span className="filter-tag">{t('to')}: {appliedFilters.date_to}</span>}
          <button className="clear-filters-btn" onClick={resetFilters}>✕ {t('clear_filters')}</button>
        </div>
      )}

      {/* Tableau des commandes */}
      <div className={`table-container ${isDark ? 'dark' : 'light'}`}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={selectedOrders.length === orders.length && orders.length > 0} onChange={handleSelectAll} />
                </th>
                <th>{t('order_number')}</th>
                <th>{t('supplier')}</th>
                <th>{t('order_date')}</th>
                <th>{t('expected_delivery')}</th>
                <th>{t('total_amount')} (AED)</th>
                <th>{t('total_amount')} (USD)</th>
                <th>{t('total_amount')} (BIF)</th>
                <th>{t('received')}</th>
                <th>{t('status')}</th>
                <th>{t('priority')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => handleSelectOne(order.id)} /></td>
                  <td><span className="order-number">{order.order_number}</span></td>
                  <td>{order.supplier_name}</td>
                  <td>{new Date(order.order_date).toLocaleDateString()} </td>
                  <td>{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : '-'} </td>
                  <td><strong>{formatNumber(order.total_amount_aed)} AED</strong></td>
                  <td>{order.total_amount_usd ? formatNumber(order.total_amount_usd) : '-'} USD</td>
                  <td>{order.total_amount_bif ? formatNumber(order.total_amount_bif) : '-'} BIF</td>
                  <td>
                    <div className="reception-progress">
                      <span>{formatNumber(order.total_received || 0)} / {formatNumber(order.total_quantity || 0)}</span>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${order.reception_rate || 0}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={order.status} t={t} /></td>
                  <td><PriorityBadge priority={order.priority} t={t} /></td>
                  <td className="actions-cell">
                    <DropdownMenu
                      isOpen={activeDropdown === order.id}
                      onClose={() => setActiveDropdown(null)}
                      trigger={
                        <button
                          className="dropdown-trigger"
                          onClick={() => setActiveDropdown(activeDropdown === order.id ? null : order.id)}
                        >
                          ⋯
                        </button>
                      }
                      items={[
                        { icon: '👁️', label: t('view_details'), onClick: () => viewOrderDetail(order) },
                        ...(order.status !== 'approved' && order.status !== 'completed' && order.status !== 'cancelled'
                          ? [{ icon: '✏️', label: t('edit'), onClick: () => openModal(order) }]
                          : []),
                        ...(order.status === 'pending'
                          ? [{ icon: approveLoading === order.id ? <span className="btn-spinner-small"></span> : '✅', label: t('approve'), onClick: () => handleApprove(order), disabled: approveLoading === order.id }]
                          : []),
                        ...(order.status === 'approved' || order.status === 'partial'
                          ? [{ icon: '📥', label: t('receive'), onClick: () => openReceptionModal(order) }]
                          : []),
                        { divider: true },
                        { icon: printLoading === order.id ? <span className="btn-spinner-small"></span> : '🖨️', label: t('print'), onClick: () => printOrder(order), disabled: printLoading === order.id },
                        { icon: '📤', label: t('share'), onClick: () => openShareModal(order) }
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr className="empty-row">
                  <td colSpan="12">{t('no_orders')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => loadOrders(appliedFilters, 1)} disabled={currentPage === 1}>«</button>
            <button onClick={() => loadOrders(appliedFilters, currentPage - 1)} disabled={currentPage === 1}>‹</button>
            <span className="page-info">{t('page')} {currentPage} {t('of')} {totalPages}</span>
            <button onClick={() => loadOrders(appliedFilters, currentPage + 1)} disabled={currentPage === totalPages}>›</button>
            <button onClick={() => loadOrders(appliedFilters, totalPages)} disabled={currentPage === totalPages}>»</button>
          </div>
        )}
      </div>

{/* MODAL CRÉATION/MODIFICATION COMMANDE */}
{modalOpen && (
  <div className="modal-overlay" onClick={closeModal}>
    <div className={`modal-container-large ${isDark ? 'dark' :'light'}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">📦</span>
          <div>
    <h3>
      {editingOrder ? t('edit_order') : t('new_order')}
    </h3>
    {editingOrder && (
      <p className="order-subtitle">
        {t('order_number')}: <strong>{editingOrder.order_number}</strong>
      </p>
    )}
  </div>
        <button className="modal-close" onClick={closeModal}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {/* Section des informations générales */}
          <div className="form-section">
            <h4>📋 {t('general_information')}</h4>
            <div className="form-grid">
             <div className="form-group">
                <label className="required">{t('supplier')} </label>
                <Select
                options={supplierOptions}
                value={formData.supplier_id}
                onChange={val => setFormData({...formData, supplier_id: val})}
                className="select-filter"
                classNamePrefix="select"
                placeholder={t('select_supplier')}
                isClearable
                styles={selectStyles}
                />
            </div>

              <div className="form-group">
                <label>📅 {t('order_date')}</label>
                <input type="datetime-local" value={formData.order_date} onChange={e => setFormData({ ...formData, order_date: e.target.value })} />
              </div>

              <div className="form-group">
                <label>🚚 {t('expected_delivery_date')}</label>
                <input type="date" value={formData.expected_delivery_date} onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>⚡ {t('priority')}</label>
                <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section des taux de change */}
          <div className="form-section">
            <h4>💱 {t('exchange_rates')}</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('exchange_rate_aed_to_usd')}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.exchange_rate_aed_to_usd}
                  onChange={e => handleCurrencyChange('exchange_rate_aed_to_usd', parseFloat(e.target.value))}
                />
                <small>1 AED = ? USD</small>
              </div>

              <div className="form-group">
                <label>{t('exchange_rate_usd_to_bif')}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.exchange_rate_usd_to_bif}
                  onChange={e => handleCurrencyChange('exchange_rate_usd_to_bif', parseFloat(e.target.value))}
                />
                <small>1 USD = ? BIF</small>
              </div>
            </div>
          </div>

          {/* Section de sélection de la source des prix */}
          <div className="form-section">
            <h4>💰 {t('price_source')}</h4>
            <div className="price-source-selector">
              <label className={`price-source-option ${priceSource === 'database' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="priceSource"
                  value="database"
                  checked={priceSource === 'database'}
                  onChange={() => handlePriceSourceChange('database')}
                />
                <span className="price-source-label">
                  <span className="icon">💾</span>
                  {t('use_database_prices')}
                </span>
                <small>{t('database_prices_desc')}</small>
              </label>

              <label className={`price-source-option ${priceSource === 'live' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="priceSource"
                  value="live"
                  checked={priceSource === 'live'}
                  onChange={() => handlePriceSourceChange('live')}
                />
                <span className="price-source-label">
                  <span className="icon">⚡</span>
                  {t('use_live_prices')}
                </span>
                <small>{t('live_prices_desc')}</small>
              </label>
            </div>
          </div>

          {/* Liste des produits */}
          <div className="form-section">
           <div className="items-header">
  <h4>📦 {t('products_list')}</h4>
  <div className="items-header-buttons">
     {priceSource === 'live' && orderItems.length > 0 && (
      <button type="button" className="btn-apply-live-prices" onClick={applyLivePricesToAll}>
        ⚡ {t('apply_live_prices_to_all')}
      </button>
    )}
    &nbsp;&nbsp;<button type="button" className="btn-add-item" onClick={addOrderItem}>➕ {t('add_product')}</button>
   
  </div>
</div>

            <div className="items-table-wrapper">
              <div className="items-table">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th className="required" style={{ minWidth: '220px' }}>{t('product')}</th>
                      <th className="required" style={{ width: '100px' }}>{t('quantity')}</th>
                      <th style={{ width: '130px' }}>{t('unit_cost')} (AED)</th>
                      <th style={{ width: '130px' }}>{t('unit_cost')} (USD)</th>
                      <th style={{ width: '130px' }}>{t('unit_cost')} (BIF)</th>
                      <th style={{ width: '130px' }}>{t('total_cost')} (AED)</th>
                      <th style={{ width: '130px' }}>{t('total_cost')} (USD)</th>
                      <th style={{ width: '130px' }}>{t('total_cost')} (BIF)</th>
                      <th style={{ width: '140px' }}>{t('selling_price')} (BIF)</th>
                      <th style={{ width: '140px' }}>{t('expected_profit')} (BIF)</th>
                      <th style={{ width: '80px' }}>{t('margin')}</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => {
                      const selectedProduct = productOptions.find(p => p.value === item.product_id);
                      const isDuplicate = isProductAlreadyAdded(item.product_id, item.id);
                      const rateAedToUsd = formData.exchange_rate_aed_to_usd || 3.6725;
                      const rateUsdToBif = formData.exchange_rate_usd_to_bif || 2830;

                      return (
                        <tr key={item.id} className={isDuplicate ? 'duplicate-row' : ''}>
                          <td className="product-cell">
                            <Select
                              options={productOptions}
                              value={productOptions.find(p => p.value === item.product_id)}
                              onChange={val => {
                                if (val && isProductAlreadyAdded(val.value, item.id)) {
                                  toast(t('product_already_added'), { icon: '⚠️' });
                                  return;
                                }
                                updateOrderItem(item.id, 'product_id', val?.value);
                                // Appliquer les prix live si nécessaire
                                if (priceSource === 'live' && val) {
                                  setTimeout(() => {
                                    updateOrderItem(item.id, 'unit_cost_aed', livePrices.unit_cost_aed);
                                    updateOrderItem(item.id, 'selling_price', livePrices.selling_price);
                                  }, 50);
                                }
                              }}
                              className="select-product"
                              classNamePrefix="select"
                              placeholder={t('select_product')}
                              isClearable
                              styles={{
                                ...selectStyles,
                                menuPortal: (base) => ({ ...base, zIndex: 9999 })
                              }}
                              menuPortalTarget={document.body}
                              menuPosition="fixed"
                            />
                            {isDuplicate && <div className="error-hint">{t('product_already_added')}</div>}
                            {selectedProduct && priceSource === 'database' && (
                              <div className="stock-hint">
                                📦 {t('current_stock')}: {selectedProduct.current_stock} {selectedProduct.unit}
                                <br />
                                💰 {t('purchase_price')}: {selectedProduct.purchase_price_aed} AED / {selectedProduct.purchase_price_bif} BIF
                              </div>
                            )}
                            {priceSource === 'live' && (
                              <div className="live-price-hint">⚡ {t('live_price_mode')}</div>
                            )}
                          </td>
                          <td className="quantity-cell">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={item.quantity}
                              onChange={e => updateOrderItem(item.id, 'quantity', parseFloat(e.target.value))}
                              required
                              className="quantity-input"
                            />
                            {item.unit && <small className="unit-hint">{item.unit}</small>}
                          </td>
                            <td className="cost-cell">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_cost_aed === undefined || item.unit_cost_aed === null ? 0 : item.unit_cost_aed}
                                onChange={(e) => {
                                const aedValue = parseFloat(e.target.value) || 0;
                                const rateAedToUsd = formData.exchange_rate_aed_to_usd || 3.6725;
                                const rateUsdToBif = formData.exchange_rate_usd_to_bif || 2830;
                                const usdValue = (aedValue / rateAedToUsd);
                                const bifValue = usdValue * rateUsdToBif;
                                
                                updateOrderItem(item.id, 'unit_cost_aed', aedValue);
                                updateOrderItem(item.id, 'unit_cost_usd', usdValue);
                                updateOrderItem(item.id, 'unit_cost_bif', bifValue);
                                }}
                                className={priceSource === 'live' ? "cost-input-editable" : "cost-input"}
                                readOnly={priceSource !== 'live'}
                                placeholder="0.00"
                            />
                            </td>
                          <td className="cost-cell">
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={(() => {
                            const val = item.unit_cost_usd;
                            if (val === undefined || val === null || isNaN(val)) return 0;
                            return val;
                            })()}
                            className="cost-input"
                            readOnly
                        />
                        </td>
                          <td className="cost-cell-bif">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_cost_bif}
                              className="cost-input-bif"
                              readOnly
                            />
                            <small className="currency-hint">BIF</small>
                          </td>
                          <td className="total-cell">{formatNumber(item.total_cost_aed)}</td>
                          <td className="total-cell">{formatNumber(item.total_cost_usd)}</td>
                          <td className="total-cell-bif">{formatNumber(item.total_cost_bif)}</td>
                          <td className="selling-price-cell">
                            {priceSource === 'live' ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.selling_price}
                                onChange={(e) => {
                                  const sellingPrice = parseFloat(e.target.value) || 0;
                                  updateOrderItem(item.id, 'selling_price', sellingPrice);
                                }}
                                className="selling-price-input"
                                placeholder="0"
                              />
                            ) : (
                              <span className="selling-price">{formatCurrency(item.selling_price)}</span>
                            )}
                          </td>
                          <td className={item.expected_profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {formatCurrency(item.expected_profit)}
                          </td>
                          <td className={item.profit_margin >= 0 ? 'margin-positive' : 'margin-negative'}>
                            {formatMargin(item.profit_margin)}%
                          </td>
                          <td className="action-cell">
                            {orderItems.length > 1 && (
                              <button type="button" className="btn-remove-item" onClick={() => removeOrderItem(item.id)}>✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan="5" className="total-label">{t('subtotal')}</td>
                      <td className="total-value">{formatNumber(getSubtotalAed())} AED</td>
                      <td className="total-value">{formatNumber(getSubtotalUsd())} USD</td>
                      <td className="total-value-bif">{formatNumber(getSubtotalBif())} BIF</td>
                      <td colSpan="2"></td>
                      <td className="profit-total">{formatNumber(getTotalExpectedProfit())} BIF</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="form-group full-width">
            <label>📝 {t('notes')}</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              rows="3" 
              placeholder={t('notes_placeholder')} 
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={closeModal} disabled={submitLoading}>{t('cancel')}</button>
          <button type="submit" className="btn-primary" disabled={submitLoading}>
            {submitLoading ? <span className="btn-spinner"></span> : (editingOrder ? '💾 ' + t('save') : '➕ ' + t('create'))}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* MODAL GESTION TAUX DE CHANGE */}
      {exchangeRateModalOpen && (
        <div className="modal-overlay" onClick={() => setExchangeRateModalOpen(false)}>
          <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">💱</span>
              <h3>{t('manage_exchange_rates')}</h3>
              <button className="modal-close" onClick={() => setExchangeRateModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('from_currency')}</label>
                <select
                  value={rateFormData.from_currency}
                  onChange={e => setRateFormData({ ...rateFormData, from_currency: e.target.value })}
                >
                  <option value="AED">AED (Dirham)</option>
                  <option value="USD">USD (Dollar US)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('to_currency')}</label>
                <select
                  value={rateFormData.to_currency}
                  onChange={e => setRateFormData({ ...rateFormData, to_currency: e.target.value })}
                >
                  <option value="USD">USD (Dollar US)</option>
                  <option value="BIF">BIF (Franc Burundais)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('exchange_rate')}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rateFormData.rate}
                  onChange={e => setRateFormData({ ...rateFormData, rate: parseFloat(e.target.value) })}
                />
                <small>1 {rateFormData.from_currency} = {rateFormData.rate} {rateFormData.to_currency}</small>
              </div>
              <div className="form-group">
                <label>{t('effective_date')}</label>
                <input
                  type="date"
                  value={rateFormData.effective_date}
                  onChange={e => setRateFormData({ ...rateFormData, effective_date: e.target.value })}
                />
              </div>

              <div className="exchange-rates-list">
                <h4>{t('current_exchange_rates')}</h4>
                <div className="rates-grid">
                  <div className="rate-card">
                    <span className="rate-pair">AED → USD</span>
                    <span className="rate-value">{exchangeRates.AED_to_USD?.toFixed(4) || '3.6725'}</span>
                  </div>
                  <div className="rate-card">
                    <span className="rate-pair">USD → BIF</span>
                    <span className="rate-value">{exchangeRates.USD_to_BIF?.toFixed(4) || '2830.0000'}</span>
                  </div>
                  <div className="rate-card">
                    <span className="rate-pair">AED → BIF</span>
                    <span className="rate-value">{(exchangeRates.AED_to_USD * exchangeRates.USD_to_BIF)?.toFixed(2) || '10395.00'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setExchangeRateModalOpen(false)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSaveExchangeRate} disabled={rateLoading}>
                {rateLoading ? <span className="btn-spinner"></span> : '💾 ' + t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

{/* MODAL RÉCEPTION */}
{receptionModalOpen && selectedOrder && (
  <div className="modal-overlay reception-modal" onClick={() => setReceptionModalOpen(false)}>
    <div className={`modal-container-large ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">📥</span>
        <h3>{t('receive_order')} - {selectedOrder.order_number}</h3>
        <button className="modal-close" onClick={() => setReceptionModalOpen(false)}>✕</button>
      </div>
      <form onSubmit={handleReceptionSubmit}>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>{t('reception_date')}</label>
              <input 
                type="datetime-local" 
                value={receptionData.reception_date} 
                onChange={e => setReceptionData({ ...receptionData, reception_date: e.target.value })} 
              />
            </div>
            <div className="form-group full-width">
              <label>{t('notes')}</label>
              <textarea 
                rows="2"
                value={receptionData.notes} 
                onChange={e => setReceptionData({ ...receptionData, notes: e.target.value })} 
                placeholder={t('reception_notes_placeholder')}
              />
            </div>
          </div>

          {/* Section des pièces justificatives */}
          <div className="form-section attachments-section">
            <div className="section-title">
              <span className="section-icon">📎</span>
              <h4>{t('supporting_documents')}</h4>
            </div>
            <div className="file-upload-area">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleReceptionFileUpload} 
                multiple 
                className="file-input" 
                accept="image/*,.pdf,.doc,.docx"
              />
              <button 
                type="button" 
                className="btn-upload" 
                onClick={() => fileInputRef.current?.click()}
              >
                📎 {t('add_documents')}
              </button>
              <p className="upload-hint">{t('upload_hint')}</p>
              <div className="file-list">
                {receptionFiles.map(file => (
                  <div key={file.id} className="file-item">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                    {file.preview && file.type.startsWith('image/') && (
                      <div className="file-preview">
                        <img src={file.preview} alt={file.name} />
                      </div>
                    )}
                    <button 
                      type="button" 
                      className="btn-remove-file" 
                      onClick={() => removeReceptionFile(file.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section des articles à recevoir */}
          <div className="items-section">
            <div className="section-title">
              <span className="section-icon">📦</span>
              <h4>{t('items_to_receive')}</h4>
            </div>
            <div className="items-table">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>{t('product')}</th>
                    <th className="text-center">{t('ordered_quantity')}</th>
                    <th className="text-center">{t('already_received')}</th>
                    <th className="text-center">{t('remaining')}</th>
                    <th className="text-center">{t('to_receive')} *</th>
                  </tr>
                </thead>
                <tbody>
                  {receptionItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name} {item.unit && `(${item.unit})`} </td>
                      <td className="text-center">{item.ordered_quantity} </td>
                      <td className="text-center">{item.received_quantity} </td>
                      <td className="text-center remaining-quantity">{item.remaining_quantity} </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max={item.remaining_quantity}
                          value={item.to_receive}
                          onChange={e => updateReceptionItem(item.id, 'to_receive', parseFloat(e.target.value))}
                          className="reception-input"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="4" className="total-label"><strong>{t('total_to_receive')}</strong></td>
                    <td className="total-value">
                      <strong>{receptionItems.reduce((sum, item) => sum + (item.to_receive || 0), 0)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={() => setReceptionModalOpen(false)} disabled={receptionLoading}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={receptionLoading}>
            {receptionLoading ? <span className="btn-spinner"></span> : '📥 ' + t('confirm_reception')}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL DÉTAIL COMMANDE */}
{detailModalOpen && selectedOrder && (
  <div className="modal-overlay" onClick={() => setDetailModalOpen(false)}>
    <div className={`modal-container-large ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">📋</span>
        <div>
          <h3>{t('order_details')}</h3>
          <p className="order-number-subtitle">{selectedOrder.order_number}</p>
        </div>
        <button className="modal-close" onClick={() => setDetailModalOpen(false)}>✕</button>
      </div>

      <div className="modal-body">
        {/* Section des informations générales */}
        <div className="detail-section">
          <div className="section-title">
            <span className="section-icon">📋</span>
            <h4>{t('general_information')}</h4>
          </div>
          <div className="detail-grid">
            <div className="detail-card-info">
              <div className="detail-item">
                <span className="detail-icon">🏭</span>
                <span className="detail-label">{t('supplier')}:</span>
                <span className="detail-value">{selectedOrder.supplier_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📅</span>
                <span className="detail-label">{t('order_date')}:</span>
                <span className="detail-value">{new Date(selectedOrder.order_date).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">🚚</span>
                <span className="detail-label">{t('expected_delivery')}:</span>
                <span className="detail-value">{selectedOrder.expected_delivery_date ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString() : '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">⚡</span>
                <span className="detail-label">{t('priority')}:</span>
                <span className="detail-value"><PriorityBadge priority={selectedOrder.priority} t={t} /></span>
              </div>
            </div>
            <div className="detail-card-info">
              <div className="detail-item">
                <span className="detail-icon">📊</span>
                <span className="detail-label">{t('status')}:</span>
                <span className="detail-value"><StatusBadge status={selectedOrder.status} t={t} /></span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">💰</span>
                <span className="detail-label">{t('total_amount')}:</span>
                <span className="detail-value total-amount">
                  <strong>{formatCurrency(selectedOrder.total_amount_bif)} BIF</strong>
                  <span className="sub-amount">({formatNumber(selectedOrder.total_amount_usd)} USD / {formatNumber(selectedOrder.total_amount)} AED )</span>
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📈</span>
                <span className="detail-label">{t('expected_profit')}:</span>
                <span className={`detail-value ${selectedOrder.total_expected_profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                  {formatCurrency(selectedOrder.total_expected_profit)} BIF
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📝</span>
                <span className="detail-label">{t('notes')}:</span>
                <span className="detail-value">{selectedOrder.notes || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section des taux de change utilisés */}
        <div className="detail-section">
          <div className="section-title">
            <span className="section-icon">💱</span>
            <h4>{t('exchange_rates_used')}</h4>
          </div>
          <div className="exchange-rates-badges">
            <span className="rate-badge">
              1 AED = {selectedOrder.exchange_rate_aed_to_usd || 3.6725} USD
            </span>
            <span className="rate-badge">
              1 USD = {selectedOrder.exchange_rate_usd_to_bif || 2830} BIF
            </span>
            <span className="rate-badge highlight">
              1 AED = {((selectedOrder.exchange_rate_aed_to_usd || 3.6725) * (selectedOrder.exchange_rate_usd_to_bif || 2830)).toFixed(2)} BIF
            </span>
          </div>
        </div>

        {/* Section des produits */}
        <div className="detail-section">
          <div className="section-title">
            <span className="section-icon">📦</span>
            <h4>{t('products')}</h4>
          </div>
          <div className="table-responsive">
            <table className="data-table detail-table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th className="text-center">{t('quantity')}</th>
                  <th className="text-center">{t('received')}</th>
                  <th className="text-center">{t('remaining')}</th>
                  <th className="text-right">{t('unit_cost')} (AED)</th>
                  <th className="text-right">{t('unit_cost')} (USD)</th>
                  <th className="text-right">{t('unit_cost')} (BIF)</th>
                  <th className="text-right">{t('total_cost')} (AED)</th>
                  <th className="text-right">{t('total_cost')} (BIF)</th>
                  <th className="text-right">{t('expected_profit')}</th>
                  <th className="text-right">{t('margin')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => {
                    const remaining = (item.quantity - (item.received_quantity || 0));
                    const isFullyReceived = remaining === 0;
                    return (
                      <tr key={idx} className={isFullyReceived ? 'fully-received-row' : ''}>
                        <td>
                          <div className="product-info">
                            <strong>{item.product_name || item.product?.name || '-'}</strong>
                            {item.product_code && <small className="product-code">{item.product_code}</small>}
                            {item.unit && <span className="product-unit">({item.unit})</span>}
                          </div>
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-center received">{formatNumber(item.received_quantity || 0)}</td>
                        <td className={`text-center remaining ${remaining === 0 ? 'text-success' : remaining > 0 ? 'text-warning' : ''}`}>
                          {remaining}
                        </td>
                        <td className="text-right">{formatNumber(item.unit_cost_aed || item.unit_cost || 0)}</td>
                        <td className="text-right">{formatNumber(item.unit_cost_usd || 0)}</td>
                        <td className="text-right">{formatNumber(item.unit_cost_bif || 0)}</td>
                        <td className="text-right">{formatNumber(item.total_cost_aed || item.total_cost || 0)}</td>
                        <td className="text-right">{formatNumber(item.total_cost_bif || 0)}</td>
                        <td className={`text-right ${(item.expected_profit || 0) >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                          {formatCurrency(item.expected_profit || 0)}
                        </td>
                        <td className={`text-right ${(item.profit_margin || 0) >= 0 ? 'margin-positive' : 'margin-negative'}`}>
                          {(() => {
                            const margin = parseFloat(item.profit_margin);
                            return isNaN(margin) ? '0.0' : margin.toFixed(1);
                          })()}%
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="empty-row">
                    <td colSpan="11" className="text-center">
                      {t('no_products_found')}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="7" className="total-label"><strong>{t('grand_total')}</strong></td>
                  <td className="text-right total-value">
                    <strong>{formatNumber(selectedOrder.total_amount_aed || selectedOrder.total_amount || 0)} AED</strong>
                  </td>
                  <td className="text-right total-value">
                    <strong>{formatNumber(selectedOrder.total_amount_bif || 0)} BIF</strong>
                  </td>
                  <td className={`text-right total-profit ${(selectedOrder.total_expected_profit || 0) >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                    <strong>{formatCurrency(selectedOrder.total_expected_profit || 0)}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section de l'historique des réceptions */}
{selectedOrder.receptions && selectedOrder.receptions.length > 0 && (
  <div className="detail-section">
    <div className="section-title">
  <div className="section-title-left">
    <span className="section-icon">📥</span>
    <h4>{t('reception_history')}</h4>
  </div>
  
  <Tippy content={t('view_signed_receptions')} placement="top">
    <button className="btn-signed-receptions" onClick={() => loadSignedReceptions(selectedOrder.id)}>
      📄✅ {t('signed_receptions')}
    </button>
  </Tippy>
</div>
    <div className="receptions-timeline">
      {selectedOrder.receptions.map((reception, idx) => (
        <div key={idx} className="reception-timeline-item">
          <div className="timeline-dot"></div>
          <div className="reception-card">
            <div className="reception-header">
              <div className="reception-title">
                <span className="reception-icon">📥</span>
                <strong>{t('reception')} #{idx + 1}</strong>
                <span className="reception-number">{reception.reception_number}</span>
                {generatedReceptions[reception.id] && (
                  <span className="printed-badge">✅ {t('printed')}</span>
                )}
              </div>
              <div className="reception-actions">
                
                 <Tippy content={t('edit_reception')} placement="top">
                    <button className="btn-icon edit-reception" onClick={() => openEditReception(reception)}>
                      ✏️
                    </button>
                  </Tippy>
                  {!reception.signature && (
                    <Tippy content={t('sign_reception')} placement="top">
                      <button className="btn-icon sign-reception" onClick={() => openSignatureModal(reception)}>
                        ✍️
                      </button>
                    </Tippy>
                  )}
                  {reception.signature && (
                    <Tippy content={t('view_signed_reception')} placement="top">
                      <button className="btn-icon view-signed" onClick={() => window.open(publicAssetUrl(reception.signature.signed_pdf_path), '_blank')}>
                        📄✅
                      </button>
                    </Tippy>
                  )}
                <Tippy content={generatedReceptions[reception.id] ? t('reprint_reception') : t('print_reception')} placement="top">
                  <button 
                    className="btn-icon print-reception" 
                    onClick={() => printReception(reception, selectedOrder)}
                    disabled={printLoading === reception.id}
                  >
                    {printLoading === reception.id ? <span className="btn-spinner-small"></span> : '🖨️'}
                  </button>
                </Tippy>
                <Tippy content={t('view_attachments')} placement="top">
                  <button 
                    className="btn-icon view-attachments" 
                    onClick={() => openAttachmentsModal(reception)}
                  >
                    📎
                  </button>
                </Tippy>
              </div>
              <div className="reception-date">
                📅 {new Date(reception.reception_date).toLocaleString()}
              </div>
            </div>
            <div className="reception-body">
              <table className="reception-items-table">
                <thead>
                  <tr>
                    <th>{t('product')}</th>
                    <th className="text-center">{t('quantity')}</th>
                    <th className="text-center">{t('unit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reception.items?.map((item, itemIdx) => (
                    <tr key={itemIdx}>
                      <td>{item.product_name}</td>
                      <td className="text-center received-quantity">{formatNumber(item.received_quantity)}</td>
                      <td className="text-center">{item.unit || 'PIECE'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reception.notes && (
                <div className="reception-notes">
                  <span className="notes-icon">📝</span>
                  <span>{t('notes')}: {reception.notes}</span>
                </div>
              )}
              {reception.received_by_name && (
                <div className="reception-meta">
                  <span className="meta-icon">👤</span>
                  <span>{t('received_by')}: {reception.received_by_name}</span>
                </div>
              )}
              
              {/* Affichage des pièces jointes avec visualisation */}
              {reception.attachments && reception.attachments.length > 0 && (
                <div className="reception-attachments">
                  <div className="attachments-title">📎 {t('attachments')} ({reception.attachments.length})</div>
                  <div className="attachments-list">
                    {reception.attachments.slice(0, 3).map((att, attIdx) => (
                      <div key={attIdx} className="attachment-item">
                        <div className="attachment-info">
                          <span className="attachment-icon">
                            {att.file_type?.startsWith('image/') ? '🖼️' : 
                             att.file_type === 'application/pdf' ? '📕' : '📄'}
                          </span>
                          <span className="attachment-name" title={att.file_name}>
                            {att.file_name.length > 25 ? att.file_name.substring(0, 22) + '...' : att.file_name}
                          </span>
                          <span className="attachment-size">{(att.file_size / 1024).toFixed(2)} KB</span>
                        </div>
                        <div className="attachment-buttons">
                          <button 
                            className="btn-view" 
                            onClick={() => openFileViewer(att)}
                            title={t('view')}
                          >
                            👁️
                          </button>
                          <a 
                            href={publicAssetUrl(att.file_path)} 
                            className="btn-download" 
                            download
                            title={t('download')}
                          >
                            📥
                          </a>
                        </div>
                      </div>
                    ))}
                    {reception.attachments.length > 3 && (
                      <div className="more-attachments">
                        <button 
                          className="btn-more" 
                          onClick={() => openAttachmentsModal(reception)}
                        >
                          + {reception.attachments.length - 3} {t('more_files')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
        {/* Section résumé des réceptions */}
        {selectedOrder.receptions && selectedOrder.receptions.length > 0 && (
          <div className="detail-section summary-section">
            <div className="section-title">
              <span className="section-icon">📊</span>
              <h4>{t('reception_summary')}</h4>
            </div>
            <div className="summary-stats">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-content">
                  <div className="stat-label">{t('total_ordered')}</div>
                  <div className="stat-value">{selectedOrder.total_quantity || 0}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-label">{t('total_received')}</div>
                  <div className="stat-value text-success">{selectedOrder.total_received || 0}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <div className="stat-label">{t('total_remaining')}</div>
                  <div className="stat-value text-warning">{selectedOrder.total_remaining || 0}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <div className="stat-label">{t('completion_rate')}</div>
                  <div className="stat-value">
                    {selectedOrder.reception_rate ? selectedOrder.reception_rate.toFixed(1) : 0}%
                    <div className="progress-bar-mini">
                      <div className="progress-fill-mini" style={{ width: `${selectedOrder.reception_rate || 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setDetailModalOpen(false)}>
          ✕ {t('close')}
        </button>
        <button className="btn-primary" onClick={() => printOrder(selectedOrder)}>
          🖨️ {t('print')}
        </button>
        <button className="btn-primary" onClick={() => openShareModal(selectedOrder)}>
          📤 {t('share')}
        </button>
        {selectedOrder.status === 'pending' && (
          <button className="btn-success" onClick={() => handleApprove(selectedOrder)}>
            ✅ {t('approve')}
          </button>
        )}
        {(selectedOrder.status === 'approved' || selectedOrder.status === 'partial') && (
          <button className="btn-warning" onClick={() => openReceptionModal(selectedOrder)}>
            📥 {t('receive')}
          </button>
        )}
      </div>
    </div>
  </div>
)}

{/* MODAL ÉDITION RÉCEPTION */}
{editReceptionModalOpen && editReceptionData && (
  <div className="modal-overlay edit-reception-modal" onClick={() => setEditReceptionModalOpen(false)}>
    <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <form onSubmit={handleEditReceptionSubmit}>
        <div className="edit-reception-header">
          <h3>{t('edit_reception')}</h3>
          <span>{editReceptionData.reception_number}</span>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>{t('reception_date')}</label>
            <input 
              type="datetime-local" 
              value={editReceptionData.reception_date?.slice(0, 16)} 
              onChange={e => setEditReceptionData({...editReceptionData, reception_date: e.target.value})}
            />
          </div>
          
          <div className="edit-reception-items">
            <table className="edit-items-table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('ordered_quantity')}</th>
                  <th>{t('received_quantity')}</th>
                  <th>{t('unit')}</th>
                </tr>
              </thead>
              <tbody>
                {editingReceptionItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.product_name}</td>
                    <td>{item.ordered_quantity || item.quantity}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={item.received_quantity}
                        onChange={(e) => {
                          const newItems = [...editingReceptionItems];
                          newItems[idx].received_quantity = parseFloat(e.target.value);
                          setEditingReceptionItems(newItems);
                        }}
                      />
                    </td>
                    <td>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="form-group">
            <label>{t('notes')}</label>
            <textarea 
              rows="2"
              value={editReceptionData.notes || ''}
              onChange={e => setEditReceptionData({...editReceptionData, notes: e.target.value})}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={() => setEditReceptionModalOpen(false)}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={submitLoading}>
            {submitLoading ? <span className="btn-spinner"></span> : t('save_changes')}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL SIGNATURE */}
{signatureModalOpen && editReceptionData && (
  <div className="modal-overlay signature-modal" onClick={() => setSignatureModalOpen(false)}>
    <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">✍️</span>
        <h3>{t('sign_reception')}</h3>
        <button className="modal-close" onClick={() => setSignatureModalOpen(false)}>✕</button>
      </div>
      
      <div className="modal-body">
        <div className="signature-info">
          <div className="signature-info-item">
            <span className="signature-info-label">{t('reception_number')}:</span>
            <span className="signature-info-value">{editReceptionData.reception_number}</span>
          </div>
          <div className="signature-info-item">
            <span className="signature-info-label">{t('supplier')}:</span>
            <span className="signature-info-value">{selectedOrder?.supplier_name}</span>
          </div>
          <div className="signature-info-item">
            <span className="signature-info-label">{t('date')}:</span>
            <span className="signature-info-value">{new Date().toLocaleString()}</span>
          </div>
        </div>
        
        <div className="signature-input-group">
          <label>{t('signature_name')} *</label>
          <input 
            type="text" 
            value={signatureData.signed_by}
            onChange={e => setSignatureData({...signatureData, signed_by: e.target.value})}
            placeholder={t('enter_full_name')}
          />
        </div>
        
        <div className="signature-terms">
          <input 
            type="checkbox" 
            id="accept_terms"
            checked={signatureData.accept_terms}
            onChange={e => setSignatureData({...signatureData, accept_terms: e.target.checked})}
          />
          <label htmlFor="accept_terms">{t('accept_signature_terms')}</label>
        </div>
        
        <div className="signature-warning">
          ⚠️ {t('signature_warning')}
        </div>
      </div>
      
      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setSignatureModalOpen(false)}>
          {t('cancel')}
        </button>
        <button 
          className="btn-primary" 
          onClick={handleSignReception}
          disabled={!signatureData.signed_by || !signatureData.accept_terms || submitLoading}
        >
          {submitLoading ? <span className="btn-spinner"></span> : '✍️ ' + t('confirm_signature')}
        </button>
      </div>
    </div>
  </div>
)}


{/* Modal visualiseur avec blob URL */}
{viewerModalOpen && viewerFile && (
  <div className="file-viewer-overlay" onClick={closeFileViewer}>
    <div className={`file-viewer-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <div className="file-viewer-header">
        <div className="file-viewer-info">
          <span className="file-viewer-icon">📕</span>
          <span className="file-viewer-title">{viewerFile.file_name}</span>
        </div>
        <div className="file-viewer-actions">
          <a 
            href={viewerFile.blobUrl}
            className="btn-download-viewer" 
            download={viewerFile.file_name}
          >
            📥 {t('download')}
          </a>
          <button className="file-viewer-close" onClick={closeFileViewer}>✕</button>
        </div>
      </div>
      <div className="file-viewer-body">
        <iframe
          src={viewerFile.blobUrl}
          className="pdf-viewer-iframe"
          title={viewerFile.file_name}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#fff'
          }}
        />
      </div>
      <div className="file-viewer-footer">
        <button className="btn-secondary" onClick={closeFileViewer}>
          {t('close')}
        </button>
      </div>
    </div>
  </div>
)}


{/* MODAL BONS SIGNÉS */}
{signedReceptionsModalOpen && (
  <div className="modal-overlay" onClick={() => setSignedReceptionsModalOpen(false)}>
    <div className={`modal-container-large ${isDark ? 'dark' : 'light'}`}>
      <div className="modal-header">
        <span className="modal-icon">📄✅</span>
        <h3>{t('signed_receptions')}</h3>
        <button className="modal-close" onClick={() => setSignedReceptionsModalOpen(false)}>✕</button>
      </div>
      <div className="modal-body">
        {signedReceptions.length === 0 ? (
          <div className="empty-state">
            <p>{t('no_signed_receptions')}</p>
          </div>
        ) : (
          <div className="signed-receptions-list">
            {signedReceptions.map((sig, idx) => (
              <div key={sig.id || idx} className="signed-reception-card">
                <div className="reception-header">
                  <div className="reception-info">
                    <span className="reception-number">📋 {sig.reception_number}</span>
                    <span className="reception-date">📅 {new Date(sig.reception_date).toLocaleDateString()}</span>
                  </div>
                  <span className="signed-badge">✅ {t('signed')}</span>
                </div>
                
                <div className="reception-details">
                  <div className="details-left">
                    <p><strong>✍️ {t('signed_by')}:</strong> {sig.signed_by || '-'}</p>
                    <p><strong>⏰ {t('signed_at')}:</strong> {sig.signed_at ? new Date(sig.signed_at).toLocaleString() : '-'}</p>
                    <p><strong>🌐 {t('ip_address')}:</strong> {sig.ip_address || '-'}</p>
                  </div>
                  
                  {sig.qrcode_path && (
                    <div className="details-right">
                      <img 
                        src={publicAssetUrl(sig.qrcode_path)} 
                        alt="QR Code"
                        className="qrcode-image"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span className="qrcode-hint">📱 {t('scan_to_verify')}</span>
                    </div>
                  )}
                </div>
                
                <div className="reception-actions">
                  <button 
                    className="btn-print"
                    onClick={() => printSignedReception(sig)}
                    disabled={printLoading === sig.id}
                  >
                    {printLoading === sig.id ? <span className="btn-spinner"></span> : '🖨️'} {t('print_signed_reception')}
                  </button>
                  {sig.signed_pdf_path && (
                    <button 
                      className="btn-view"
                      onClick={() => window.open(publicAssetUrl(sig.signed_pdf_path), '_blank')}
                    >
                      📄 {t('view_signed_document')}
                    </button>
                  )}
                  <button 
                    className="btn-verify"
                    onClick={() => window.open(`/api/receptions/verify/${sig.reception_id}`, '_blank')}
                  >
                    🔍 {t('verify_authenticity')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setSignedReceptionsModalOpen(false)}>
          ✕ {t('close')}
        </button>
      </div>
    </div>
  </div>
)}

{/* MODAL DES PIÈCES JOINTES */}
{attachmentsModalOpen && currentReception && (
  <div className="modal-overlay" onClick={() => setAttachmentsModalOpen(false)}>
    <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">📎</span>
        <h3>{t('attachments')} - {currentReception.reception_number}</h3>
        <button className="modal-close" onClick={() => setAttachmentsModalOpen(false)}>✕</button>
      </div>
      <div className="modal-body">
        {currentAttachments.length === 0 ? (
          <div className="empty-state">
            <p>{t('no_attachments')}</p>
          </div>
        ) : (
          <div className="attachments-grid">
            {currentAttachments.map((att, idx) => (
              <div key={idx} className="attachment-card">
                <div className="attachment-preview">
                  {att.file_type?.startsWith('image/') ? (
                    <img 
                      src={publicAssetUrl(att.file_path)} 
                      alt={att.file_name}
                      className="preview-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="preview-icon">📄</div>
                  )}
                </div>
                <div className="attachment-info">
                  <div className="attachment-name" title={att.file_name}>
                    {att.file_name.length > 30 ? att.file_name.substring(0, 27) + '...' : att.file_name}
                  </div>
                  <div className="attachment-meta">
                    <span className="attachment-size">{(att.file_size / 1024).toFixed(2)} KB</span>
                    <a 
                      href={publicAssetUrl(att.file_path)} 
                      className="btn-download" 
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📥
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setAttachmentsModalOpen(false)}>
          {t('close')}
        </button>
      </div>
    </div>
  </div>
)}

      {/* MODAL PARTAGE */}
      {shareModalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">📤</span>
              <h3>{t('share_order')} - {selectedOrder.order_number}</h3>
              <button className="modal-close" onClick={() => setShareModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="share-section">
                <div className="share-link-box">
                  <label>{t('share_link')}</label>
                  <div className="link-copy">
                    <input type="text" value={shareData.share_link} readOnly />
                    <button 
                      type="button" 
                      className="btn-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(shareData.share_link);
                        toast.success(t('link_copied'));
                      }}
                    >
                      📋
                    </button>
                  </div>
                </div>
                
                <div className="share-divider">
                  <span>{t('or')}</span>
                </div>
                
                <div className="share-email">
                  <label>{t('share_by_email')}</label>
                  <div className="email-input">
                    <input 
                      type="email" 
                      value={shareData.email} 
                      onChange={e => setShareData({...shareData, email: e.target.value})}
                      placeholder={t('enter_email')}
                    />
                    <button 
                      type="button" 
                      className="btn-send-email" 
                      onClick={handleShareByEmail}
                      disabled={shareLoading}
                    >
                      {shareLoading ? <span className="btn-spinner"></span> : '📧 ' + t('send')}
                    </button>
                  </div>
                </div>
                
                <div className="share-whatsapp">
                  <label>{t('share_by_whatsapp')}</label>
                  <div className="whatsapp-input">
                    <input 
                      type="tel" 
                      value={shareData.whatsapp_number} 
                      onChange={e => setShareData({...shareData, whatsapp_number: e.target.value})}
                      placeholder={t('enter_whatsapp_number')}
                    />
                    <button 
                      type="button" 
                      className="btn-send-whatsapp" 
                      onClick={handleShareByWhatsApp}
                    >
                      💬 {t('send')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShareModalOpen(false)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FILTRE */}
      {filterModalOpen && (
        <div className="modal-overlay" onClick={() => setFilterModalOpen(false)}>
          <div className={`modal-container-small ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🔍</span>
              <h3>{t('filter_orders')}</h3>
              <button className="modal-close" onClick={() => setFilterModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('order_number')}</label><input type="text" value={filters.order_number} onChange={e => setFilters({...filters, order_number: e.target.value})} /></div>
              <div className="form-group"><label>{t('supplier')}</label><Select options={supplierOptions} value={filters.supplier_id} onChange={val => setFilters({...filters, supplier_id: val})} isClearable styles={selectStyles} /></div>
              <div className="form-group"><label>{t('status')}</label><select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="">{t('all_status')}</option>{ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              <div className="form-group"><label>{t('date_from')}</label><input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} /></div>
              <div className="form-group"><label>{t('date_to')}</label><input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetFilters}>{t('reset_filters')}</button>
              <button className="btn-primary" onClick={applyFilters}>{t('apply_filters')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Styles CSS */}
      <style>{`
        .purchase-orders-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .purchase-orders-page.light {
          background: var(--bg-main);
        }
        
        .purchase-orders-page.dark {
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
        
        .stat-profit {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
        }
        
        .btn-exchange-rate {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          margin-left: 12px;
          transition: all 0.2s;
        }
        
        .btn-exchange-rate:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.02);
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
        
        .bulk-delete-btn, .bulk-print-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .bulk-delete-btn {
          background: #dc2626;
          color: white;
        }
        
        .bulk-delete-btn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
        }
        
        .bulk-print-btn {
          background: #3b82f6;
          color: white;
        }
        
        .bulk-print-btn:hover {
          background: #2563eb;
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
        }
        
        .clear-filters-btn:hover {
          background: rgba(220,38,38,0.1);
        }
        
        .table-container {
          border-radius: 20px;
          padding: 20px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }
        
        .table-responsive {
          overflow-x: auto;
          max-height: 550px;
          overflow-y: auto;
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
          position: sticky;
          top: 0;
          z-index: 10;
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
        
        .order-number {
          font-family: monospace;
          font-weight: 600;
          color: #667eea;
        }
        
        .reception-progress {
          min-width: 100px;
        }
        
        .progress-bar {
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          margin-top: 4px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #10b981;
          border-radius: 3px;
          transition: width 0.3s;
        }
        
        .status-badge, .priority-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        
        .dropdown-trigger {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--bg-main);
          border: 1px solid var(--border);
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .dropdown-trigger:hover {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }
        
        .btn-spinner-small {
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
        
        .items-section {
          margin-top: 24px;
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
        
        .btn-add-item {
          padding: 6px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-add-item:hover {
          transform: translateY(-1px);
        }
        
        .btn-remove-item {
          padding: 4px 8px;
          background: rgba(220,38,38,0.1);
          color: #dc2626;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .items-table-wrapper {
          overflow-x: auto;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .items-table {
          width: 100%;
        }
        
        .items-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .items-table th, .items-table td {
          padding: 8px;
          border-bottom: 1px solid var(--border);
          text-align: left;
          color: var(--text-primary);
        }
        
        .items-table th {
          background: var(--bg-header);
          font-weight: 600;
        }
        
        .quantity-input, .cost-input, .cost-input-bif, .reception-input {
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .quantity-input:focus, .cost-input:focus, .cost-input-bif:focus, .reception-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 2px rgba(102,126,234,0.1);
        }
        
        .cost-input-editable {
          width: 100px;
          text-align: right;
          font-weight: 500;
          background: linear-gradient(135deg, #fef3c7, #fffbeb);
          border: 2px solid #f59e0b;
          border-radius: 6px;
          padding: 6px 8px;
          transition: all 0.2s;
        }
        
        .cost-input-editable:focus {
          outline: none;
          border-color: #d97706;
          box-shadow: 0 0 0 2px rgba(245,158,11,0.2);
        }
        
        .selling-price-input {
          width: 120px;
          text-align: right;
          font-weight: 600;
          background: linear-gradient(135deg, #dbeafe, #eff6ff);
          border: 2px solid #3b82f6;
          border-radius: 6px;
          padding: 6px 8px;
          transition: all 0.2s;
        }
        
        .selling-price-input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }
        
        .quantity-input { width: 80px; text-align: center; font-weight: 600; }
        .cost-input { width: 100px; text-align: right; }
        .cost-input-bif { width: 120px; text-align: right; }
        .reception-input { width: 100px; text-align: center; }
        
        .unit-hint, .currency-hint {
          font-size: 10px;
          color: var(--text-secondary);
          margin-left: 4px;
        }
        
        .currency-hint {
          display: block;
          margin-top: 2px;
        }
        
        .total-cell, .total-value {
          font-weight: 600;
          color: #667eea;
        }
        
        .total-cell-bif {
          font-weight: 600;
          color: #3b82f6;
        }
        
        .total-value-bif {
          font-weight: 700;
          color: #3b82f6;
        }
        
        .profit-positive {
          color: #10b981;
          font-weight: 600;
        }
        
        .profit-negative {
          color: #ef4444;
          font-weight: 600;
        }
        
        .margin-positive {
          color: #10b981;
        }
        
        .margin-negative {
          color: #ef4444;
        }
        
        .selling-price {
          color: #3b82f6;
          font-weight: 500;
        }
        
        .total-row {
          background: var(--bg-header);
          font-weight: 600;
        }
        
        .profit-total {
          color: #8b5cf6;
          font-weight: 700;
        }
        
        .reception-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
          background: var(--bg-card);
        }
        
        .reception-header {
          display: flex;
          justify-content: space-between;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
          color: var(--text-primary);
        }
        
        .reception-item {
          padding: 4px 0;
          color: var(--text-primary);
        }
        
        .reception-notes {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .detail-item {
          padding: 6px 0;
          color: var(--text-primary);
        }
        
        .empty-row {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
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
        
        /* Modal Styles */
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
          max-width: 700px;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--border);
        }
        
        .modal-container-large {
          background: var(--bg-card);
          border-radius: 20px;
          width: 95%;
          max-width: 1300px;
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
        
        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-main);
          color: var(--text-primary);
          transition: all 0.2s;
        }
        
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .required::after {
          content: " *";
          color: #dc2626;
        }
        
        .price-source-selector {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .price-source-option {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-card);
        }
        
        .price-source-option.active {
          border-color: #667eea;
          background: rgba(102,126,234,0.08);
        }
        
        .price-source-option:hover {
          border-color: #667eea;
        }
        
        .price-source-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 4px;
          color: var(--text-primary);
        }
        
        .price-source-option small {
          display: block;
          color: var(--text-secondary);
          font-size: 11px;
          margin-left: 28px;
        }
        
        .form-section {
          margin-bottom: 24px;
          padding: 16px 20px;
          background: var(--bg-main);
          border-radius: 16px;
          border: 1px solid var(--border);
        }
        
        .form-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #667eea;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .live-price-hint {
          font-size: 10px;
          color: #f59e0b;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
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
          background: var(--bg-main);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
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
        
        .text-center {
          text-align: center;
        }
        
        /* Exchange Rates */
        .exchange-rates-list {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        
        .exchange-rates-list h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        
        .rates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }
        
        .rate-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: var(--bg-main);
          border-radius: 8px;
          font-size: 12px;
          border: 1px solid var(--border);
        }
        
        .rate-pair {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .rate-value {
          font-family: monospace;
          font-weight: 700;
          color: #667eea;
        }
        
        /* Share Modal */
        .share-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .share-link-box label, .share-email label, .share-whatsapp label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 13px;
          color: var(--text-primary);
        }
        
        .link-copy, .email-input, .whatsapp-input {
          display: flex;
          gap: 8px;
        }
        
        .link-copy input, .email-input input, .whatsapp-input input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-main);
          color: var(--text-primary);
        }
        
        .btn-copy, .btn-send-email, .btn-send-whatsapp {
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-copy {
          background: #667eea;
          color: white;
        }
        
        .btn-send-email {
          background: #3b82f6;
          color: white;
        }
        
        .btn-send-whatsapp {
          background: #25D366;
          color: white;
        }
        
        .btn-copy:hover, .btn-send-email:hover, .btn-send-whatsapp:hover {
          transform: translateY(-1px);
        }
        
        .share-divider {
          text-align: center;
          position: relative;
          margin: 10px 0;
        }
        
        .share-divider span {
          background: var(--bg-card);
          padding: 0 10px;
          color: var(--text-secondary);
          font-size: 12px;
        }
        
        .share-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border);
          z-index: -1;
        }
        
        @media (max-width: 1024px) {
          .purchase-orders-page {
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
          .modal-container-large {
            width: 95%;
          }
        }
        
        @media (max-width: 768px) {
          .purchase-orders-page {
            padding: 16px;
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
          .btn-exchange-rate {
            margin-left: 0;
            margin-top: 8px;
          }
          .rates-grid {
            grid-template-columns: 1fr;
          }
          .items-table {
            font-size: 12px;
          }
          .quantity-input, .cost-input, .cost-input-bif {
            width: 70px;
          }
          .action-buttons {
            flex-wrap: wrap;
          }
          .link-copy, .email-input, .whatsapp-input {
            flex-direction: column;
          }
          .price-source-selector {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default PurchaseOrders;
