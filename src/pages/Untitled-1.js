// frontend/src/pages/PurchaseOrders.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import Select from 'react-select';
import { useLanguage } from '../contexts/LanguageContext';
import { useAction } from '../contexts/ActionContext';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/common/Loader';
import Swal from 'sweetalert2';
import {
  purchaseOrderService,
  supplierService,
  productService,
  exchangeRateService,
} from '../services/apiService';

// Constantes avec traductions dynamiques
const getOrderStatuses = (t) => [
  { value: 'draft', label: t('status_draft'), color: '#64748b', icon: '📝' },
  { value: 'pending', label: t('status_pending'), color: '#f59e0b', icon: '⏳' },
  { value: 'confirmed', label: t('status_confirmed'), color: '#3b82f6', icon: '✅' },
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
  { value: 'BIF', label: 'Franc Burundais', symbol: 'FBu', rate: 1 },
  { value: 'USD', label: 'Dollar US', symbol: '$', rate: 2830 },
  { value: 'EUR', label: 'Euro', symbol: '€', rate: 3070 },
  { value: 'AED', label: 'Dirham', symbol: 'AED', rate: 770 },
  { value: 'GBP', label: 'Livre Sterling', symbol: '£', rate: 3580 }
];

// Composants
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
      {priorityInfo.icon} {priorityInfo.label}
    </span>
  );
};

const PurchaseOrders = () => {
  const { t, language } = useLanguage();
  const { registerAction, unregisterAction } = useAction();
  const { user } = useAuth();
  
  // États
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState([]);
  
  // États des modaux
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [receptionModalOpen, setReceptionModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [exchangeRateModalOpen, setExchangeRateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingRate, setEditingRate] = useState(null);
  
  // États des filtres
  const [filters, setFilters] = useState({
    order_number: '',
    supplier_id: null,
    status: '',
    date_from: '',
    date_to: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  
  // États pour le formulaire
  const [formData, setFormData] = useState({
    supplier_id: null,
    order_date: new Date().toISOString().slice(0, 16),
    expected_delivery_date: '',
    priority: 'normal',
    currency: 'BIF',
    exchange_rate: 1,
    notes: ''
  });
  
  const [orderItems, setOrderItems] = useState([
    { 
      id: Date.now(), 
      product_id: null, 
      quantity: 1, 
      unit_cost: 0, 
      unit_cost_bif: 0,
      total_cost: 0,
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
  
  const [receptionItems, setReceptionItems] = useState([]);
  const [receptionData, setReceptionData] = useState({
    reception_date: new Date().toISOString().slice(0, 16),
    notes: ''
  });
  
  // États pour les taux de change
  const [rateFormData, setRateFormData] = useState({
    from_currency: 'USD',
    to_currency: 'BIF',
    rate: 2830,
    effective_date: new Date().toISOString().split('T')[0]
  });
  
  // Loaders
  const [submitLoading, setSubmitLoading] = useState(false);
  const [receptionLoading, setReceptionLoading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  
  const isMounted = useRef(true);

  // Chargement des données
  const loadOrders = useCallback(async (params = {}, page = 1) => {
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
      
      const response = await purchaseOrderService.getAll(cleanParams);
      const result = response.data;

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
  }, [itemsPerPage, t]);

  // Chargement des données de référence
  const loadReferenceData = useCallback(async () => {
    try {
      const [suppliersRes, productsRes, ratesRes] = await Promise.all([
        supplierService.getAll(),
        productService.getAllActive(),
        exchangeRateService.getLatest(),
      ]);

      const suppliersResult = suppliersRes.data;
      const productsResult = productsRes.data;
      const ratesResult = ratesRes.data;
      
      if (suppliersResult.success) {
        setSuppliers(suppliersResult.data || []);
        setSupplierOptions((suppliersResult.data || []).map(s => ({ 
          value: s.id, 
          label: `${s.name} (${s.code})`,
          payment_terms: s.payment_terms
        })));
      }
      
      if (productsResult.success) {
        setProducts(productsResult.data || []);
        setProductOptions((productsResult.data || []).map(p => ({ 
          value: p.id, 
          label: `${p.name} (${p.code})`, 
          unit: p.unit,
          selling_price: p.selling_price || 0,
          purchase_price: p.purchase_price || 0,
          code: p.code,
          name: p.name,
          current_stock: p.current_stock || 0
        })));
      }
      
      if (ratesResult.success) {
        setExchangeRates(ratesResult.data || {});
      } else {
        setExchangeRates({
          USD_to_BIF: 2830,
          EUR_to_BIF: 3070,
          GBP_to_BIF: 3580,
          AED_to_BIF: 770
        });
      }
      
    } catch (error) {
      console.error('Erreur chargement références:', error);
      toast.error(t('error_loading_reference_data'));
      setExchangeRates({
        USD_to_BIF: 2830,
        EUR_to_BIF: 3070,
        GBP_to_BIF: 3580,
        AED_to_BIF: 770
      });
    }
  }, [t]);

  // Gestion des items
  const addOrderItem = () => {
    setOrderItems(prev => [...prev, { 
      id: Date.now(), 
      product_id: null, 
      quantity: 1, 
      unit_cost: 0, 
      unit_cost_bif: 0,
      total_cost: 0,
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
      toast.warning(t('at_least_one_product'));
      return;
    }
    setOrderItems(prev => prev.filter(item => item.id !== id));
  };

  const updateOrderItem = (id, field, value) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        const currentRate = formData.exchange_rate || 1;
        
        if (field === 'product_id') {
          const selectedProduct = productOptions.find(p => p.value === value);
          if (selectedProduct) {
            updated.product_name = selectedProduct.name;
            updated.product_code = selectedProduct.code;
            updated.unit = selectedProduct.unit;
            updated.selling_price = selectedProduct.selling_price;
            updated.purchase_price = selectedProduct.purchase_price;
            updated.unit_cost = selectedProduct.purchase_price;
            updated.unit_cost_bif = selectedProduct.purchase_price * currentRate;
          }
        }
        
        if (field === 'quantity' || field === 'unit_cost') {
          const qty = parseFloat(updated.quantity) || 0;
          const cost = parseFloat(updated.unit_cost) || 0;
          updated.total_cost = qty * cost;
          updated.total_cost_bif = updated.total_cost * currentRate;
          
          const sellingPrice = updated.selling_price || 0;
          updated.expected_profit = (sellingPrice - (cost * currentRate)) * qty;
          updated.profit_margin = (cost * currentRate) > 0 ? ((sellingPrice - (cost * currentRate)) / (cost * currentRate)) * 100 : 0;
        }
        
        if (field === 'unit_cost_bif') {
          const qty = parseFloat(updated.quantity) || 0;
          const costBif = parseFloat(updated.unit_cost_bif) || 0;
          updated.unit_cost = costBif / currentRate;
          updated.total_cost = qty * updated.unit_cost;
          updated.total_cost_bif = qty * costBif;
          
          const sellingPrice = updated.selling_price || 0;
          updated.expected_profit = (sellingPrice - costBif) * qty;
          updated.profit_margin = costBif > 0 ? ((sellingPrice - costBif) / costBif) * 100 : 0;
        }
        
        return updated;
      }
      return item;
    }));
  };

  // Calculs
  const getSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  };
  
  const getSubtotalBif = () => {
    return orderItems.reduce((sum, item) => sum + (item.total_cost_bif || 0), 0);
  };

  const getTotalAmount = () => {
    return getSubtotal();
  };
  
  const getTotalAmountBif = () => {
    return getSubtotalBif();
  };

  const getTotalExpectedProfit = () => {
    return orderItems.reduce((sum, item) => sum + (item.expected_profit || 0), 0);
  };

  // Gestion du taux de change
  const handleCurrencyChange = (currency) => {
    const currencyInfo = CURRENCIES.find(c => c.value === currency);
    const newRate = exchangeRates[`${currency}_to_BIF`] || currencyInfo?.rate || 1;
    
    setFormData(prev => ({
      ...prev,
      currency: currency,
      exchange_rate: newRate
    }));
    
    // Mettre à jour les prix de tous les items
    setOrderItems(prev => prev.map(item => {
      if (item.product_id) {
        const qty = item.quantity || 0;
        const costInForeign = item.purchase_price;
        const costInBif = costInForeign * newRate;
        const newUnitCost = costInForeign;
        const newUnitCostBif = costInBif;
        
        return {
          ...item,
          unit_cost: newUnitCost,
          unit_cost_bif: newUnitCostBif,
          total_cost: qty * newUnitCost,
          total_cost_bif: qty * newUnitCostBif,
          expected_profit: ((item.selling_price || 0) - newUnitCostBif) * qty,
          profit_margin: newUnitCostBif > 0 ? (((item.selling_price || 0) - newUnitCostBif) / newUnitCostBif) * 100 : 0
        };
      }
      return item;
    }));
  };

  // Gestion des taux de change (CRUD)
  const loadExchangeRates = useCallback(async () => {
    try {
      const response = await exchangeRateService.getAll();
      const result = response.data;
      if (result.success) {
        setExchangeRates(result.data);
      }
    } catch (error) {
      console.error('Erreur chargement taux:', error);
    }
  }, []);

  const handleSaveExchangeRate = async () => {
    setRateLoading(true);
    try {
      const response = await exchangeRateService.create(rateFormData);
      const result = response.data;
      
      if (result.success) {
        toast.success(t('exchange_rate_saved'));
        await loadExchangeRates();
        setExchangeRateModalOpen(false);
        resetRateForm();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(t('error_saving_exchange_rate'));
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
    setEditingRate(null);
  };

  const openExchangeRateModal = () => {
    resetRateForm();
    setExchangeRateModalOpen(true);
  };

  // Création/Modification de commande
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validItems = orderItems.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.warning(t('at_least_one_product'));
      return;
    }
    
    if (!formData.supplier_id) {
      toast.warning(t('supplier_required'));
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
      cancelButtonText: t('cancel')
    });
    
    if (!confirmed.isConfirmed) return;
    
    setSubmitLoading(true);
    try {
      const payload = {
        supplier_id: formData.supplier_id.value,
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date,
        priority: formData.priority,
        currency: formData.currency,
        exchange_rate: formData.exchange_rate,
        notes: formData.notes,
        subtotal: getSubtotal(),
        subtotal_bif: getSubtotalBif(),
        total_amount: getTotalAmount(),
        total_amount_bif: getTotalAmountBif(),
        items: validItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          unit_cost_bif: item.unit_cost_bif,
          total_cost: item.total_cost,
          total_cost_bif: item.total_cost_bif,
          expected_profit: item.expected_profit
        }))
      };
      
      let response;
      if (editingOrder) {
        response = await purchaseOrderService.update(editingOrder.id, payload);
      } else {
        response = await purchaseOrderService.create(payload);
      }

      const result = response.data;
      
      if (result.success) {
        toast.success(editingOrder ? t('order_updated') : t('order_created'));
        loadOrders(appliedFilters, currentPage);
        closeModal();
        resetForm();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('error_saving_order'));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Réception de commande
  const openReceptionModal = async (order) => {
    setSelectedOrder(order);
    
    const response = await purchaseOrderService.getById(order.id);
    const result = response.data;
    
    if (result.success) {
      const orderDetails = result.data;
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
    }
    
    setReceptionModalOpen(true);
  };

  const handleReceptionSubmit = async (e) => {
    e.preventDefault();
    
    const itemsToReceive = receptionItems.filter(item => item.to_receive > 0);
    if (itemsToReceive.length === 0) {
      toast.warning(t('no_items_to_receive'));
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
      cancelButtonText: t('cancel')
    });
    
    if (!confirmed.isConfirmed) return;
    
    setReceptionLoading(true);
    try {
      const payload = {
        order_id: selectedOrder.id,
        reception_date: receptionData.reception_date,
        notes: receptionData.notes,
        items: itemsToReceive.map(item => ({
          order_item_id: item.id,
          product_id: item.product_id,
          received_quantity: item.to_receive
        }))
      };
      
      const response = await purchaseOrderService.receive(selectedOrder.id, payload);
      const result = response.data;
      
      if (result.success) {
        toast.success(t('reception_success'));
        setReceptionModalOpen(false);
        loadOrders(appliedFilters, currentPage);
        resetReceptionForm();
      } else {
        toast.error(result.message);
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

  // Utilitaires
  const resetForm = () => {
    setFormData({
      supplier_id: null,
      order_date: new Date().toISOString().slice(0, 16),
      expected_delivery_date: '',
      priority: 'normal',
      currency: 'BIF',
      exchange_rate: 1,
      notes: ''
    });
    setOrderItems([{ 
      id: Date.now(), 
      product_id: null, 
      quantity: 1, 
      unit_cost: 0, 
      unit_cost_bif: 0,
      total_cost: 0,
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

  const openModal = (order = null) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        supplier_id: { value: order.supplier_id, label: order.supplier_name },
        order_date: order.order_date?.slice(0, 16),
        expected_delivery_date: order.expected_delivery_date || '',
        priority: order.priority || 'normal',
        currency: order.currency || 'BIF',
        exchange_rate: order.exchange_rate || 1,
        notes: order.notes || ''
      });
      purchaseOrderService.getById(order.id)
        .then(res => {
          const result = res.data;
          if (result.success && result.data.items) {
            setOrderItems(result.data.items.map(item => ({
              id: item.id || Date.now(),
              product_id: item.product_id,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              unit_cost_bif: item.unit_cost_bif || item.unit_cost * (order.exchange_rate || 1),
              total_cost: item.total_cost,
              total_cost_bif: item.total_cost_bif || item.total_cost * (order.exchange_rate || 1),
              received_quantity: item.received_quantity || 0,
              product_name: item.product_name,
              product_code: item.product_code,
              unit: item.unit,
              selling_price: item.selling_price,
              purchase_price: item.purchase_price,
              expected_profit: item.expected_profit,
              profit_margin: item.profit_margin
            })));
          }
        });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingOrder(null);
  };

  const viewOrderDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  // Filtres
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

  // Actions groupées
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

  // Enregistrement des actions
  useEffect(() => {
    registerAction('add', () => openModal());
    registerAction('filter', () => setFilterModalOpen(true));
    registerAction('refresh', () => refreshOrders());

    return () => {
      unregisterAction('add');
      unregisterAction('filter');
      unregisterAction('refresh');
    };
  }, []);

  // Chargement initial
  useEffect(() => {
    isMounted.current = true;
    loadReferenceData();
    loadOrders({}, 1);
    loadExchangeRates();
    return () => { isMounted.current = false; };
  }, []);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const totalExpectedProfit = getTotalExpectedProfit();

  if (loading) return <Loader fullScreen text={t('loading_orders')} transparent={true} />;

  const ORDER_STATUSES = getOrderStatuses(t);
  const PRIORITIES = getPriorities(t);

  return (
    <div className="purchase-orders-page">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>📦 {t('purchase_orders')}</h2>
          <p>{t('purchase_orders_desc')}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">📋 {t('total_orders')}: {totalItems}</span>
          <span className="stat-value">💰 {t('total_value')}: {formatCurrency(orders.reduce((sum, o) => sum + (o.total_amount || 0), 0))}</span>
          <span className="stat-profit">📈 {t('expected_profit')}: {formatCurrency(totalExpectedProfit)}</span>
          <button className="btn-exchange-rate" onClick={openExchangeRateModal}>
            💱 {t('manage_exchange_rates')}
          </button>
        </div>
      </div>

      {/* Actions groupées */}
      {selectedOrders.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">{selectedOrders.length} {t('selected')}</span>
          <button className="bulk-delete-btn" onClick={() => {}}>🗑️ {t('delete_selected')}</button>
          <button className="bulk-clear-btn" onClick={() => setSelectedOrders([])}>✕</button>
        </div>
      )}

      {/* Filtres actifs */}
      {Object.keys(appliedFilters).length > 0 && (
        <div className="active-filters-info">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">{t('active_filters')}:</span>
          {appliedFilters.order_number && <span className="filter-tag">{t('order_number')}: {appliedFilters.order_number}</span>}
          {appliedFilters.supplier_id && <span className="filter-tag">{t('supplier')}: {suppliers.find(s => s.id == appliedFilters.supplier_id)?.name}</span>}
          {appliedFilters.status && <span className="filter-tag">{t('status')}: {appliedFilters.status}</span>}
          {appliedFilters.date_from && <span className="filter-tag">{t('from')}: {appliedFilters.date_from}</span>}
          {appliedFilters.date_to && <span className="filter-tag">{t('to')}: {appliedFilters.date_to}</span>}
          <button className="clear-filters-btn" onClick={resetFilters}>✕ {t('clear_filters')}</button>
        </div>
      )}

      {/* Tableau des commandes */}
      <div className="table-container">
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
                <th>{t('total_amount')}</th>
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
                  <td><strong>{formatCurrency(order.total_amount)}</strong> {order.currency} </td>
                  <td>
                    <div className="reception-progress">
                      <span>{order.total_received || 0} / {order.total_quantity || 0}</span>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${order.reception_rate || 0}%` }}></div>
                      </div>
                    </div>
                   </td>
                  <td><StatusBadge status={order.status} t={t} /></td>
                  <td><PriorityBadge priority={order.priority} t={t} /></td>
                  <td>
                    <div className="action-buttons">
                      <Tippy content={t('view_details')} placement="top">
                        <button className="btn-icon view" onClick={() => viewOrderDetail(order)}>👁️</button>
                      </Tippy>
                      <Tippy content={t('edit')} placement="top">
                        <button className="btn-icon edit" onClick={() => openModal(order)}>✏️</button>
                      </Tippy>
                      <Tippy content={t('receive')} placement="top">
                        <button className="btn-icon receive" onClick={() => openReceptionModal(order)}>📥</button>
                      </Tippy>
                    </div>
                   </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan="10" className="empty-row">{t('no_orders')} </td></tr>
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
          <div className="modal-container-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">📦</span>
              <h3>{editingOrder ? t('edit_order') : t('new_order')}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required">{t('supplier')} *</label>
                    <Select
                      options={supplierOptions}
                      value={formData.supplier_id}
                      onChange={val => setFormData({...formData, supplier_id: val})}
                      className="select-filter"
                      classNamePrefix="select"
                      placeholder={t('select_supplier')}
                      isClearable
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('order_date')}</label>
                    <input type="datetime-local" value={formData.order_date} onChange={e => setFormData({...formData, order_date: e.target.value})} />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('expected_delivery_date')}</label>
                    <input type="date" value={formData.expected_delivery_date} onChange={e => setFormData({...formData, expected_delivery_date: e.target.value})} />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('priority')}</label>
                    <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                      {PRIORITIES.map(p => (
                        <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>{t('currency')}</label>
                    <select value={formData.currency} onChange={e => handleCurrencyChange(e.target.value)}>
                      {CURRENCIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label} ({c.symbol})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>{t('exchange_rate')} ({formData.currency} → BIF)</label>
                    <input 
                      type="number" 
                      step="0.0001" 
                      value={formData.exchange_rate} 
                      onChange={e => setFormData({...formData, exchange_rate: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                {/* Liste des produits */}
                <div className="items-section">
                  <div className="items-header">
                    <h4>{t('products_list')}</h4>
                    <button type="button" className="btn-add-item" onClick={addOrderItem}>➕ {t('add_product')}</button>
                  </div>
                  <div className="items-table">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>{t('product')} *</th>
                          <th>{t('quantity')} *</th>
                          <th>{t('unit_cost')} ({formData.currency})</th>
                          <th>{t('unit_cost')} (BIF)</th>
                          <th>{t('total_cost')} ({formData.currency})</th>
                          <th>{t('total_cost')} (BIF)</th>
                          <th>{t('selling_price')} (BIF)</th>
                          <th>{t('expected_profit')} (BIF)</th>
                          <th>{t('margin')}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item) => {
                          const selectedProduct = productOptions.find(p => p.value === item.product_id);
                          return (
                            <tr key={item.id}>
                              <td>
                                <Select
                                  options={productOptions}
                                  value={productOptions.find(p => p.value === item.product_id)}
                                  onChange={val => updateOrderItem(item.id, 'product_id', val?.value)}
                                  className="select-product"
                                  classNamePrefix="select"
                                  placeholder={t('select_product')}
                                  isClearable
                                />
                                </td>
                                <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.quantity}
                                  onChange={e => updateOrderItem(item.id, 'quantity', parseFloat(e.target.value))}
                                  required
                                  className="quantity-input"
                                />
                                {item.unit && <small className="unit-hint">{item.unit}</small>}
                               </td>
                               <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_cost}
                                  onChange={e => updateOrderItem(item.id, 'unit_cost', parseFloat(e.target.value))}
                                  className="cost-input"
                                />
                               </td>
                               <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_cost_bif}
                                  onChange={e => updateOrderItem(item.id, 'unit_cost_bif', parseFloat(e.target.value))}
                                  className="cost-input-bif"
                                />
                                <small className="currency-hint">BIF</small>
                               </td>
                              <td className="total-cell">{formatNumber(item.total_cost)} </td>
                              <td className="total-cell-bif">{formatNumber(item.total_cost_bif)} </td>
                               <td>
                                <span className="selling-price">{formatCurrency(item.selling_price)}</span>
                               </td>
                              <td className={item.expected_profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatCurrency(item.expected_profit)}
                               </td>
                              <td className={item.profit_margin >= 0 ? 'margin-positive' : 'margin-negative'}>
                                {item.profit_margin.toFixed(1)}%
                               </td>
                               <td>
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
                          <td colSpan="4" className="total-label">{t('subtotal')} </td>
                          <td className="total-value">{formatCurrency(getSubtotal())} {formData.currency} </td>
                          <td className="total-value-bif">{formatCurrency(getSubtotalBif())} BIF </td>
                          <td> </td>
                          <td className="profit-total">{formatCurrency(getTotalExpectedProfit())} BIF </td>
                          <td> </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>{t('notes')}</label>
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows="3" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={submitLoading}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitLoading}>
                  {submitLoading ? <span className="btn-spinner"></span> : (editingOrder ? t('save') : t('create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GESTION TAUX DE CHANGE */}
      {exchangeRateModalOpen && (
        <div className="modal-overlay" onClick={() => setExchangeRateModalOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
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
                  onChange={e => setRateFormData({...rateFormData, from_currency: e.target.value})}
                >
                  {CURRENCIES.filter(c => c.value !== 'BIF').map(c => (
                    <option key={c.value} value={c.value}>{c.label} ({c.symbol})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('to_currency')}</label>
                <select 
                  value={rateFormData.to_currency} 
                  onChange={e => setRateFormData({...rateFormData, to_currency: e.target.value})}
                >
                  <option value="BIF">Franc Burundais (FBu)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('exchange_rate')}</label>
                <input 
                  type="number" 
                  step="0.0001" 
                  value={rateFormData.rate} 
                  onChange={e => setRateFormData({...rateFormData, rate: parseFloat(e.target.value)})}
                  placeholder="Taux de change"
                />
                <small>1 {rateFormData.from_currency} = {rateFormData.rate} {rateFormData.to_currency}</small>
              </div>
              <div className="form-group">
                <label>{t('effective_date')}</label>
                <input 
                  type="date" 
                  value={rateFormData.effective_date} 
                  onChange={e => setRateFormData({...rateFormData, effective_date: e.target.value})}
                />
              </div>
              
              {/* Liste des taux existants */}
              <div className="exchange-rates-list">
                <h4>{t('current_exchange_rates')}</h4>
                <div className="rates-grid">
                  {Object.entries(exchangeRates).map(([key, rate]) => (
                    <div key={key} className="rate-card">
                      <span className="rate-pair">{key.replace('_to_', ' → ')}</span>
                      <span className="rate-value">{parseFloat(rate).toFixed(4)}</span>
                    </div>
                  ))}
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
        <div className="modal-overlay" onClick={() => setReceptionModalOpen(false)}>
          <div className="modal-container-large" onClick={e => e.stopPropagation()}>
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
                    <input type="datetime-local" value={receptionData.reception_date} onChange={e => setReceptionData({...receptionData, reception_date: e.target.value})} />
                  </div>
                  <div className="form-group full-width">
                    <label>{t('notes')}</label>
                    <input type="text" value={receptionData.notes} onChange={e => setReceptionData({...receptionData, notes: e.target.value})} />
                  </div>
                </div>

                <div className="items-section">
                  <h4>{t('items_to_receive')}</h4>
                  <div className="items-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('product')}</th>
                          <th>{t('ordered_quantity')}</th>
                          <th>{t('already_received')}</th>
                          <th>{t('remaining')}</th>
                          <th>{t('to_receive')} *</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receptionItems.map((item) => (
                          <tr key={item.id}>
                            <td>{item.product_name} {item.unit && `(${item.unit})`} </td>
                            <td className="text-center">{item.ordered_quantity} </td>
                            <td className="text-center">{item.received_quantity} </td>
                            <td className="text-center">{item.remaining_quantity} </td>
                             <td>
                              <input
                                type="number"
                                step="0.01"
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
                    </table>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setReceptionModalOpen(false)} disabled={receptionLoading}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={receptionLoading}>
                  {receptionLoading ? <span className="btn-spinner"></span> : t('confirm_reception')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

     {/* MODAL DÉTAIL COMMANDE */}
      {detailModalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setDetailModalOpen(false)}>
          <div className="modal-container-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">📋</span>
              <h3>{t('order_details')} - {selectedOrder.order_number}</h3>
              <button className="modal-close" onClick={() => setDetailModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-grid">
                  <div className="detail-item"><strong>{t('supplier')}:</strong> {selectedOrder.supplier_name}</div>
                  <div className="detail-item"><strong>{t('order_date')}:</strong> {new Date(selectedOrder.order_date).toLocaleString()}</div>
                  <div className="detail-item"><strong>{t('expected_delivery')}:</strong> {selectedOrder.expected_delivery_date ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString() : '-'}</div>
                  <div className="detail-item"><strong>{t('status')}:</strong> <StatusBadge status={selectedOrder.status} t={t} /></div>
                  <div className="detail-item"><strong>{t('priority')}:</strong> <PriorityBadge priority={selectedOrder.priority} t={t} /></div>
                  <div className="detail-item"><strong>{t('currency')}:</strong> {selectedOrder.currency}</div>
                  <div className="detail-item"><strong>{t('total_amount')}:</strong> {formatCurrency(selectedOrder.total_amount)} {selectedOrder.currency}</div>
                  <div className="detail-item"><strong>{t('notes')}:</strong> {selectedOrder.notes || '-'}</div>
                </div>
              </div>

              <div className="detail-section">
                <h4>{t('products')}</h4>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('product')}</th>
                        <th>{t('quantity')}</th>
                        <th>{t('received')}</th>
                        <th>{t('remaining')}</th>
                        <th>{t('unit_cost')}</th>
                        <th>{t('total_cost')}</th>
                        <th>{t('expected_profit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.product_name} {item.unit && `(${item.unit})`} </td>
                          <td>{item.quantity} </td>
                          <td>{item.received_quantity || 0} </td>
                          <td>{(item.quantity - (item.received_quantity || 0))} </td>
                          <td>{formatCurrency(item.unit_cost)} {selectedOrder.currency} </td>
                          <td>{formatCurrency(item.total_cost)} {selectedOrder.currency} </td>
                          <td className={item.expected_profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {formatCurrency(item.expected_profit)} BIF
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedOrder.receptions && selectedOrder.receptions.length > 0 && (
                <div className="detail-section">
                  <h4>{t('reception_history')}</h4>
                  {selectedOrder.receptions.map((reception, idx) => (
                    <div key={idx} className="reception-card">
                      <div className="reception-header">
                        <strong>{t('reception')} #{idx + 1}</strong>
                        <span>{new Date(reception.reception_date).toLocaleString()}</span>
                      </div>
                      <div className="reception-body">
                        {reception.items?.map((item, itemIdx) => (
                          <div key={itemIdx} className="reception-item">
                            {item.product_name}: {item.received_quantity} {item.unit}
                          </div>
                        ))}
                        {reception.notes && <div className="reception-notes">{t('notes')}: {reception.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetailModalOpen(false)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FILTRE */}
      {filterModalOpen && (
        <div className="modal-overlay" onClick={() => setFilterModalOpen(false)}>
          <div className="modal-container-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🔍</span>
              <h3>{t('filter_orders')}</h3>
              <button className="modal-close" onClick={() => setFilterModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('order_number')}</label><input type="text" value={filters.order_number} onChange={e => setFilters({...filters, order_number: e.target.value})} /></div>
              <div className="form-group"><label>{t('supplier')}</label><Select options={supplierOptions} value={filters.supplier_id} onChange={val => setFilters({...filters, supplier_id: val})} isClearable /></div>
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

      <style jsx="true">{`
        .purchase-orders-page {
          padding: 20px 30px;
          background: var(--bg-color, #f5f7fb);
          min-height: 100vh;
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
        
        /* Styles améliorés pour les champs quantité et coût */
        .quantity-input {
          width: 100px;
          text-align: center;
          font-weight: 600;
          background: linear-gradient(135deg, #f8fafc, #ffffff);
          border: 2px solid #e2e8f0;
          transition: all 0.2s;
        }
        
        .quantity-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
          outline: none;
        }
        
        .cost-input {
          width: 120px;
          text-align: right;
          font-weight: 500;
          background: linear-gradient(135deg, #fef3c7, #fffbeb);
          border: 2px solid #fde68a;
        }
        
        .cost-input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
          outline: none;
        }
        
        .cost-input-bif {
          width: 120px;
          text-align: right;
          font-weight: 500;
          background: linear-gradient(135deg, #dbeafe, #eff6ff);
          border: 2px solid #bfdbfe;
        }
        
        .cost-input-bif:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
          outline: none;
        }
        
        .unit-hint {
          font-size: 10px;
          color: #64748b;
          margin-left: 4px;
        }
        
        .currency-hint {
          font-size: 10px;
          color: #3b82f6;
          display: block;
          margin-top: 2px;
        }
        
        .total-cell-bif {
          font-weight: 600;
          color: #3b82f6;
          background: #eff6ff;
        }
        
        .total-value-bif {
          font-weight: 700;
          color: #3b82f6;
          background: #eff6ff;
          padding: 4px 8px;
          border-radius: 6px;
        }
        
        /* Styles pour la gestion des taux de change */
        .exchange-rates-list {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }
        
        .exchange-rates-list h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-color, #1e293b);
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
          background: var(--hover-bg, #f1f5f9);
          border-radius: 8px;
          font-size: 12px;
        }
        
        .rate-pair {
          font-weight: 600;
          color: var(--text-color, #1e293b);
        }
        
        .rate-value {
          font-family: monospace;
          font-weight: 700;
          color: #667eea;
        }
        
        
        .purchase-orders-page {
          padding: 20px 30px;
          background: var(--bg-color, #f5f7fb);
          min-height: 100vh;
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
          font-size: 24px;
          color: var(--text-color, #1e293b);
          margin-bottom: 4px;
        }
        
        .page-header p {
          color: var(--text-secondary, #64748b);
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
        
        .bulk-actions-bar {
          background: #e0e7ff;
          padding: 12px 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        
        .active-filters-info {
          background: #e0e7ff;
          padding: 10px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 13px;
        }
        
        .filter-tag {
          background: #667eea;
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }
        
        .table-container {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .table-responsive {
          overflow-x: auto;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .data-table th, .data-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .data-table th {
          background: #f8fafc;
          font-weight: 600;
          color: #1e293b;
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
          background: #e2e8f0;
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
        }
        
        .btn-icon {
          padding: 6px 10px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-icon.view { background: #e0e7ff; color: #4f46e5; }
        .btn-icon.edit { background: #d1fae5; color: #10b981; }
        .btn-icon.receive { background: #dbeafe; color: #3b82f6; }
        
        .btn-icon:hover { transform: scale(1.05); }
        
        .items-section {
          margin-top: 24px;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }
        
        .items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .btn-add-item {
          padding: 6px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        
        .items-table {
          overflow-x: auto;
        }
        
        .items-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .items-table th, .items-table td {
          padding: 8px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }
        
        .items-table th {
          background: #f8fafc;
          font-weight: 600;
        }
        
        .total-cell, .total-value {
          font-weight: 600;
          color: #667eea;
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
          background: #f8fafc;
          font-weight: 600;
        }
        
        .profit-total {
          color: #8b5cf6;
          font-weight: 700;
        }
        
        .reception-input {
          width: 100px;
          padding: 6px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        
        .reception-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        }
        
        .reception-header {
          display: flex;
          justify-content: space-between;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 8px;
        }
        
        .reception-item {
          padding: 4px 0;
        }
        
        .reception-notes {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #64748b;
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .detail-item {
          padding: 6px 0;
        }
        
        .empty-row {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
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
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
        
        .modal-container-large {
          background: white;
          border-radius: 16px;
          width: 95%;
          max-width: 1200px;
          max-height: 90vh;
          overflow: auto;
        }
        
        .modal-container-small {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
        }
        
        .modal-header {
          padding: 20px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .modal-body {
          padding: 24px;
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
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
        }
        
        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        
        .required::after {
          content: " *";
          color: #dc2626;
        }
        
        .btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .btn-secondary {
          padding: 10px 20px;
          background: #e2e8f0;
          color: #1e293b;
          border: none;
          border-radius: 8px;
          cursor: pointer;
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
        
        .text-center {
          text-align: center;
        }
        
        @media (max-width: 768px) {
          .purchase-orders-page { padding: 16px; }
          .form-grid { grid-template-columns: 1fr; }
          .form-group.full-width { grid-column: span 1; }
          .modal-container-large { width: 95%; }
          .detail-grid { grid-template-columns: 1fr; }
        }
        
        @media (max-width: 768px) {
          .purchase-orders-page { padding: 16px; }
          .form-grid { grid-template-columns: 1fr; }
          .form-group.full-width { grid-column: span 1; }
          .modal-container-large { width: 95%; }
          .detail-grid { grid-template-columns: 1fr; }
          .rates-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

// Helper pour formater les nombres
const formatNumber = (num) => {
  return new Intl.NumberFormat('fr-BI').format(num || 0);
};

const formatCurrency = (num) => {
  return new Intl.NumberFormat('fr-BI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);
};

export default PurchaseOrders;