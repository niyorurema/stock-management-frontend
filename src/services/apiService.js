import axios from 'axios';
import { notify } from './notificationService';
import { API_BASE } from '../config/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['X-Auth-Token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let logoutScheduled = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (!error.response) {
      const msg =
        'Serveur API inaccessible. Démarrez le backend : cd backend puis php spark serve';
      console.error('API réseau:', url, error.message);
      error.userMessage = msg;
      return Promise.reject(error);
    }

    // Gestion des erreurs d'authentification 401
    if (status === 401 && !url.includes('/auth/login')) {
      error.userMessage =
        error.response?.data?.message || 'Session expirée ou token invalide';
      
      if (!logoutScheduled) {
        logoutScheduled = true;
        
        // Nettoyer complètement le localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('session_info');
        
        // Afficher un message d'erreur
        notify.error('Session expirée, veuillez vous reconnecter');
        
        // Rediriger vers la page de connexion
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }

    if (status === 403) {
      error.userMessage =
        error.response?.data?.message || 'Accès refusé';
      notify.error(error.userMessage);
    }

    return Promise.reject(error);
  }
);

export default api;

export const settingsService = {
  getAll: () => api.get('/settings'),
  getByKey: (key) => api.get(`/settings/${key}`),
  update: (data) => api.post('/settings', data),
  updateOne: (key, value) => api.post('/settings', { [key]: value }),
  uploadLogo: (formData) =>
    api.post('/settings/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reset: () => api.post('/settings/reset'),
  testEbmsConnection: () => api.get('/settings/ebms/test'),
  checkEbmsTin: (tin) => api.get('/settings/ebms/check-tin', { params: { tin } }),
};

export const productService = {
  getAll: (params = {}) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),

  getCategories: (params = {}) => api.get('/products/categories', { params }),
  createCategory: (data) => api.post('/products/categories', data),
  deleteCategory: (id) => api.delete(`/products/categories/${id}`),
  updateCategory: (id, data) => api.put(`/products/categories/${id}`, data),
  bulkDelete: (ids) => api.post('/products/bulk-delete', { ids }),
  bulkActivate: (ids) => api.post('/products/bulk-activate', { ids }),
  bulkDeactivate: (ids) => api.post('/products/bulk-deactivate', { ids }),
  getByCode: (code) => api.get(`/products/code/${code}`),
  bulkUpdatePrices: (data) => api.post('/products/bulk-update-prices', data),
  recalcPrices: (rates) => api.post('/products/recalc-prices', { rates }),
  getAllActive: (params = {}) => api.get('/products', { params: { ...params, is_active: 1 } }),
};

export const stockService = {
  getMovements: (params) => api.get('/stock/movements', { params }),
  addMovement: (data) => api.post('/stock/movement', data),
  getSummary: (params) => api.get('/stock/summary', { params }),
  getWarehouseSummary: (params) => api.get('/stock/warehouse-summary', { params }),
  getWarehouses: () => api.get('/stock/warehouses'),
  transferStock: (data) => api.post('/stock/transfer', data),
  bulkDelete: (ids) => api.post('/stock/bulk-delete', { ids }),
  getProductStock: (productId, warehouseId) =>
    api.get(`/stock/product-stock/${productId}/${warehouseId}`),
  checkStock: (data) => api.post('/stock/check-stock', data),
  createWarehouse: (data) => api.post('/stock/warehouses', data),
  updateWarehouse: (id, data) => api.put(`/stock/warehouses/${id}`, data),
  deleteWarehouse: (id) => api.delete(`/stock/warehouses/${id}`),
  addMovementAttachments: (movementId, formData) =>
    api.post(`/stock/movement/${movementId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMovementAttachments: (movementId) =>
    api.get(`/stock/movement/${movementId}/attachments`),
  deleteAttachment: (attachmentId) =>
    api.delete(`/stock/attachments/${attachmentId}`),
};

export const invoiceService = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  cancel: (id, data) => api.post(`/invoices/${id}/cancel`, data),
  syncWithEBMS: (id) => api.post(`/invoices/${id}/sync-ebms`),
  getStats: (params) => api.get('/invoices/stats', { params }),
  addPayment: (id, data) => api.post(`/invoices/${id}/payment`, data),
  addAttachments: (id, formData) =>
    api.post(`/invoices/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getEbmsLogs: (id) => api.get(`/invoices/${id}/ebms-logs`),
  sendEmail: (id) => api.post(`/invoices/${id}/send-email`),
  sendPaymentReminder: (id) => api.post(`/invoices/${id}/reminder`),
  verify: (id) => api.post(`/invoices/${id}/verify`),
  bulkDelete: (ids) => api.post('/invoices/bulk-delete', { ids }),
};

export const userService = {
  getAll: (params = {}) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  getRoles: () => api.get('/users/roles'),
  getPermissions: () => api.get('/users/permissions'),
};

export const roleService = {
  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  updatePermissions: (id, permissionIds) =>
    api.put(`/roles/${id}/permissions`, { permission_ids: permissionIds }),
};

export const authService = {
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const profileService = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
};

export const notificationService = {
  getAll: (params = {}) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const customerService = {
  getAll: (params = {}) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const reservationService = {
  getAll: (params = {}) => api.get('/reservations', { params }),
  getById: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  delete: (id) => api.delete(`/reservations/${id}`),
  confirm: (id) => api.post(`/reservations/${id}/confirm`),
  deliver: (id, data) => api.post(`/reservations/${id}/deliver`, data),
  completeByDelivered: (id) => api.post(`/reservations/${id}/complete-by-delivered`),
};

export const exchangeRateService = {
  getAll: () => api.get('/exchange-rates'),
  getLatest: () => api.get('/exchange-rates/latest'),
  create: (data) => api.post('/exchange-rates', data),
  update: (id, data) => api.put(`/exchange-rates/${id}`, data),
  delete: (id) => api.delete(`/exchange-rates/${id}`),
};

export const warehouseService = {
  getAll: (params = {}) => api.get('/warehouses', { params }),
  getById: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`),
  toggleStatus: (id) => api.patch(`/warehouses/${id}/toggle-status`),
  getStockValue: (id) => api.get(`/warehouses/${id}/stock-value`),
};

/*export const reportService = {
  getDailyPerformance: (params) =>
    api.get('/reports/daily-performance', { params }),
};*/

// frontend/src/services/apiService.js

export const reportService = {
  // GET /reports/dashboard?start_date=...&end_date=...
  getDashboard: (params) => api.get('/reports/dashboard', { params }),
  
  // POST /reports/performance
  getPerformance: (data) => api.post('/reports/performance', data),
  
  // POST /reports/inventory
  getInventory: (data) => api.post('/reports/inventory', data),
  
  // POST /reports/financial
  getFinancial: (data) => api.post('/reports/financial', data),
  
  // POST /reports/suppliers
  getSuppliers: (data) => api.post('/reports/suppliers', data),
  
  // GET /reports/daily-performance
  getDailyPerformance: (params) => api.get('/reports/daily-performance', { params }),
};

/** Message d'erreur lisible pour les toasts */
export function getApiErrorMessage(error, fallback = 'Erreur de chargement') {
  return (
    error?.userMessage ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

// Dans apiService.js, ajoutez :
export const supplierService = {
  getAll: (params = {}) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

export const receptionService = {
  getById: (id) => api.get(`/receptions/${id}`),
  update: (id, data) => api.put(`/receptions/${id}`, data),
  sign: (id, data) => api.post(`/receptions/${id}/sign`, data),
  print: (id) => api.get(`/receptions/${id}/print`),
  getAttachments: (id) => api.get(`/receptions/${id}/attachments`),
  printSigned: (id) => api.get(`/receptions/${id}/print-signed`),
};

export const purchaseOrderService = {
  getAll: (params = {}) => api.get('/purchase-orders', { params }),
  getById: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  approve: (id, data) => api.post(`/purchase-orders/${id}/approve`, data),
  updateStatus: (id, status) => api.patch(`/purchase-orders/${id}/status`, { status }),
  receive: (id, formData) => api.post(`/purchase-orders/${id}/receive`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getSignatures: (id) => api.get(`/purchase-orders/${id}/signatures`),
  shareByEmail: (id, email) => api.post(`/purchase-orders/${id}/share-email`, { email }),
  getReceptions: (id) => api.get(`/purchase-orders/${id}/receptions`),
};


// ==================== SERVICE D'ATTACHEMENT ====================
export const attachmentService = {
  /**
   * Télécharger un fichier
   * @param {string} filePath - Chemin du fichier
   * @param {string} fileName - Nom du fichier
   * @returns {Promise<boolean>} - Succès ou échec
   */
  download: async (filePath, fileName) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Nettoyer le chemin du fichier
      const cleanPath = filePath.replace(/^\/+/, '');
      
      // Construire l'URL complète (enlevant /api de la base URL)
      const baseUrl = API_BASE.replace('/api', '');
      const url = `${baseUrl}/${cleanPath}`;
      
      const response = await fetch(url, {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      return true;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  },
  
  /**
   * Visualiser un fichier dans un nouvel onglet
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<boolean>} - Succès ou échec
   */
  view: async (filePath) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Nettoyer le chemin du fichier
      const cleanPath = filePath.replace(/^\/+/, '');
      
      // Construire l'URL complète
      const baseUrl = API_BASE.replace('/api', '');
      const url = `${baseUrl}/${cleanPath}`;
      
      const response = await fetch(url, {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Ouvrir dans un nouvel onglet
      window.open(blobUrl, '_blank');
      
      // Nettoyer après un délai
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('View error:', error);
      throw error;
    }
  },
  
  /**
   * Upload de fichiers
   * @param {string} endpoint - Endpoint API
   * @param {FormData} formData - Données du formulaire
   * @returns {Promise} - Réponse de l'API
   */
  upload: async (endpoint, formData) => {
    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  /**
   * Supprimer un fichier
   * @param {string} endpoint - Endpoint API
   * @param {number|string} id - ID du fichier
   * @returns {Promise} - Réponse de l'API
   */
  delete: async (endpoint, id) => {
    const response = await api.delete(`${endpoint}/${id}`);
    return response.data;
  }
};
