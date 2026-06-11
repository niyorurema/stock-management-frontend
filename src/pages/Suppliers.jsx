// frontend/src/pages/Suppliers.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAction } from '../contexts/ActionContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Loader from '../components/common/Loader';
import Swal from 'sweetalert2';
import { authFetch, authFetchJson } from '../utils/authFetch';
//import { getApiErrorMessage } from '../services/apiService';
import { supplierService, getApiErrorMessage } from '../services/apiService';

// Composant StatusBadge
const StatusBadge = ({ isActive, t }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
      {isActive ? '✅' : '❌'} {isActive ? t('active') : t('inactive')}
    </span>
  );
};

const Suppliers = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { registerAction, unregisterAction } = useAction();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  
  // États
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  
  // États des modaux
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  
  // États pour le formulaire
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    tin: '',
    bank_account: '',
    payment_terms: 30,
    is_active: true,
    notes: ''
  });
  
  // Loaders
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const isMounted = useRef(true);

  // Chargement des fournisseurs
 /* const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive !== 'all') params.append('is_active', filterActive === 'active' ? 1 : 0);
      
      const { response, data: result } = await authFetchJson(`/api/suppliers?${params}`);

      if (!response.ok) {
        toast.error(result?.message || `${t('error_loading_suppliers')} (${response.status})`);
        return;
      }

      if (result.success) {
        setSuppliers(result.data || []);
        setTotalItems(result.data?.length || 0);
      } else {
        toast.error(result.message || t('error_loading_suppliers'));
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(getApiErrorMessage(error, t('error_loading_suppliers')));
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterActive, t]);*/

  const loadSuppliers = useCallback(async () => {
  setLoading(true);
  try {
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (filterActive !== 'all') params.is_active = filterActive === 'active' ? 1 : 0;
    
    const response = await supplierService.getAll(params);
    
    if (response.data?.success) {
      setSuppliers(response.data.data || []);
      setTotalItems(response.data.data?.length || 0);
    } else {
      toast.error(response.data?.message || t('error_loading_suppliers'));
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error(getApiErrorMessage(error, t('error_loading_suppliers')));
  } finally {
    setLoading(false);
  }
}, [searchTerm, filterActive, t]);

  // Création/Mise à jour fournisseur
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.warning(t('name_required'));
      return;
    }
    
    if (!formData.phone.trim()) {
      toast.warning(t('phone_required'));
      return;
    }
    
    const confirmed = await Swal.fire({
      title: editingSupplier ? t('confirm_update') : t('confirm_create'),
      text: editingSupplier ? t('update_confirmation') : t('create_confirmation'),
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
        code: formData.code || undefined,
        name: formData.name,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone,
        address: formData.address || null,
        tin: formData.tin || null,
        bank_account: formData.bank_account || null,
        payment_terms: formData.payment_terms,
        is_active: formData.is_active ? 1 : 0,
        notes: formData.notes || null
      };
      
      let result;
      /*if (editingSupplier) {
        ({ data: result } = await authFetchJson(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }));
      } else {
        ({ data: result } = await authFetchJson('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        }));
      }*/

      if (editingSupplier) {
          const response = await supplierService.update(editingSupplier.id, payload);
          result = response.data;
        } else {
          const response = await supplierService.create(payload);
          result = response.data;
        }
      
      if (result.success) {
        toast.success(editingSupplier ? t('supplier_updated') : t('supplier_created'));
        loadSuppliers();
        closeModal();
        resetForm();
      } else {
        const errorMsg = typeof result.message === 'object' 
          ? Object.values(result.message).flat().join(', ') 
          : result.message;
        toast.error(errorMsg || t('error_saving_supplier'));
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('error_saving_supplier'));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Suppression fournisseur
  const handleDelete = async (supplier) => {
    if (supplier.order_count > 0) {
      const result = await Swal.fire({
        title: t('supplier_has_orders'),
        text: t('supplier_has_orders_desc'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: t('deactivate'),
        cancelButtonText: t('cancel'),
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#1e293b'
      });
      
      if (!result.isConfirmed) return;
      
      try {
        const { data } = await authFetchJson(`/api/suppliers/${supplier.id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: 0 }),
        });
        
        if (data.success) {
          toast.success(t('supplier_deactivated'));
          loadSuppliers();
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(t('error_deactivating_supplier'));
      }
      return;
    }
    
    const result = await Swal.fire({
      title: t('confirm_delete'),
      text: `${t('confirm_delete_desc')} "${supplier.name}" ?`,
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
    
    try {
      /*const { data } = await authFetchJson(`/api/suppliers/${supplier.id}`, {
        method: 'DELETE',
      });*/
      const response = await supplierService.delete(supplier.id);
      const data = response.data;
      
      if (data.success) {
        toast.success(t('supplier_deleted'));
        loadSuppliers();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(t('error_deleting_supplier'));
    }
  };

  // Actions groupées
  const handleSelectAll = () => {
    if (selectedSuppliers.length === suppliers.length) {
      setSelectedSuppliers([]);
    } else {
      setSelectedSuppliers(suppliers.map(s => s.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedSuppliers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSuppliers.length === 0) {
      toast.warning(t('select_suppliers'));
      return;
    }
    
    const result = await Swal.fire({
      title: t('confirm_bulk_delete'),
      text: t('confirm_bulk_delete_desc').replace('{count}', selectedSuppliers.length),
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
    
    let deleted = 0;
    for (const id of selectedSuppliers) {
      const supplier = suppliers.find(s => s.id === id);
      if (supplier && supplier.order_count === 0) {
        try {
          /*await authFetch(`/api/suppliers/${id}`, { method: 'DELETE' });*/
          await supplierService.delete(id);
          deleted++;
        } catch (error) {
          console.error(`Erreur suppression ${id}:`, error);
        }
      } else if (supplier) {
        await authFetchJson(`/api/suppliers/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: 0 }),
        });
        deleted++;
      }
    }
    
    toast.success(t('bulk_delete_success').replace('{count}', deleted));
    setSelectedSuppliers([]);
    loadSuppliers();
  };

  // Utilitaires
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      tin: '',
      bank_account: '',
      payment_terms: 30,
      is_active: true,
      notes: ''
    });
    setEditingSupplier(null);
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        code: supplier.code || '',
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        tin: supplier.tin || '',
        bank_account: supplier.bank_account || '',
        payment_terms: supplier.payment_terms || 30,
        is_active: supplier.is_active === 1,
        notes: supplier.notes || ''
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
  };

  const viewSupplierDetail = async (supplier) => {
    setSelectedSupplier(supplier);
    setDetailModalOpen(true);
  };

  // Enregistrement des actions
  useEffect(() => {
    registerAction('add', () => openModal());
    registerAction('refresh', () => loadSuppliers());

    return () => {
      unregisterAction('add');
      unregisterAction('refresh');
    };
  }, []);

  // Chargement initial
  useEffect(() => {
    isMounted.current = true;
    loadSuppliers();
    return () => { isMounted.current = false; };
  }, [loadSuppliers]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedSuppliers = suppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <Loader fullScreen text={t('loading_suppliers')} transparent={true} />;

  return (
    <div className={`suppliers-page ${isDark ? 'dark' : 'light'}`}>
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
          <h2>🏭 {t('suppliers')}</h2>
          <p>{t('suppliers_desc')}</p>
        </div>
        <div className="stats-badge">
          <span className="stat-total">🏭 {t('total_suppliers')}: {totalItems}</span>
          <span className="stat-active">✅ {t('active')}: {suppliers.filter(s => s.is_active).length}</span>
          <span className="stat-inactive">❌ {t('inactive')}: {suppliers.filter(s => !s.is_active).length}</span>
        </div>
      </div>

      {/* Actions groupées */}
      {selectedSuppliers.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">{selectedSuppliers.length} {t('selected')}</span>
          <button className="bulk-delete-btn" onClick={handleBulkDelete}>🗑️ {t('delete_selected')}</button>
          <button className="bulk-clear-btn" onClick={() => setSelectedSuppliers([])}>✕</button>
        </div>
      )}

      {/* Barre de recherche et filtres */}
      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder={t('search_suppliers')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterActive === 'all' ? 'active' : ''}`}
            onClick={() => setFilterActive('all')}
          >
            {t('all')}
          </button>
          <button 
            className={`filter-tab ${filterActive === 'active' ? 'active' : ''}`}
            onClick={() => setFilterActive('active')}
          >
            ✅ {t('active')}
          </button>
          <button 
            className={`filter-tab ${filterActive === 'inactive' ? 'active' : ''}`}
            onClick={() => setFilterActive('inactive')}
          >
            ❌ {t('inactive')}
          </button>
        </div>
      </div>

      {/* Tableau des fournisseurs */}
      <div className={`table-container ${isDark ? 'dark' : 'light'}`}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={selectedSuppliers.length === paginatedSuppliers.length && paginatedSuppliers.length > 0} onChange={handleSelectAll} />
                </th>
                <th>{t('code')}</th>
                <th>{t('name')}</th>
                <th>{t('contact_person')}</th>
                <th>{t('phone')}</th>
                <th>{t('email')}</th>
                <th>{t('orders')}</th>
                <th>{t('total_purchases')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSuppliers.map(supplier => (
                <tr key={supplier.id} className={!supplier.is_active ? 'inactive-row' : ''}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedSuppliers.includes(supplier.id)} 
                      onChange={() => handleSelectOne(supplier.id)}
                      disabled={!supplier.is_active}
                    />
                   </td>
                  <td><span className="supplier-code">{supplier.code}</span> </td>
                  <td>
                    <div className="supplier-name">
                      <strong>{supplier.name}</strong>
                      {supplier.contact_person && <small>{supplier.contact_person}</small>}
                    </div>
                   </td>
                  <td>{supplier.contact_person || '-'} </td>
                  <td>{supplier.phone || '-'} </td>
                  <td>{supplier.email || '-'} </td>
                  <td>
                    <span className="order-count">{supplier.order_count || 0}</span>
                                     </td>
                  <td><strong>{formatCurrency(supplier.total_purchases || 0)}</strong> </td>
                  <td><StatusBadge isActive={supplier.is_active} t={t} /> </td>
                  <td>
                    <div className="action-buttons">
                      <Tippy content={t('view_details')} placement="top" animation="scale">
                        <button className="btn-icon view" onClick={() => viewSupplierDetail(supplier)}>👁️</button>
                      </Tippy>
                      <Tippy content={t('edit')} placement="top" animation="scale">
                        <button className="btn-icon edit" onClick={() => openModal(supplier)}>✏️</button>
                      </Tippy>
                      <Tippy content={t('delete')} placement="top" animation="scale">
                        <button className="btn-icon delete" onClick={() => handleDelete(supplier)}>🗑️</button>
                      </Tippy>
                    </div>
                   </td>
                </tr>
              ))}
              {paginatedSuppliers.length === 0 && (
                <tr className="empty-row">
                  <td colSpan="10">
                    <div className={`empty-state ${isDark ? 'dark' : 'light'}`}>
                      <span className="empty-icon">🏭</span>
                      <p>{t('no_suppliers')}</p>
                      <button className="btn-primary" onClick={() => openModal()}>➕ {t('add_first_supplier')}</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
            <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
            <span className="page-info">{t('page')} {currentPage} {t('of')} {totalPages}</span>
            <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
          </div>
        )}
      </div>

      {/* MODAL CRÉATION/MODIFICATION FOURNISSEUR */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className={`modal-container-large ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🏭</span>
              <h3>{editingSupplier ? t('edit_supplier') : t('new_supplier')}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('code')}</label>
                    <input 
                      type="text" 
                      value={formData.code} 
                      onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      placeholder={t('code_auto')}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="required">{t('name')} *</label>
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('contact_person')}</label>
                    <input 
                      type="text" 
                      value={formData.contact_person} 
                      onChange={e => setFormData({...formData, contact_person: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('email')}</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="required">{t('phone')} *</label>
                    <input 
                      type="tel" 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('address')}</label>
                    <input 
                      type="text" 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('tin')}</label>
                    <input 
                      type="text" 
                      value={formData.tin} 
                      onChange={e => setFormData({...formData, tin: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('bank_account')}</label>
                    <input 
                      type="text" 
                      value={formData.bank_account} 
                      onChange={e => setFormData({...formData, bank_account: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('payment_terms')}</label>
                    <input 
                      type="number" 
                      value={formData.payment_terms} 
                      onChange={e => setFormData({...formData, payment_terms: parseInt(e.target.value)})}
                    />
                    <small>{t('payment_terms_hint')}</small>
                  </div>
                  
                  <div className="form-group">
                    <label>{t('status')}</label>
                    <select 
                      value={formData.is_active ? 'active' : 'inactive'} 
                      onChange={e => setFormData({...formData, is_active: e.target.value === 'active'})}
                    >
                      <option value="active">✅ {t('active')}</option>
                      <option value="inactive">❌ {t('inactive')}</option>
                    </select>
                  </div>
                  
                  <div className="form-group full-width">
                    <label>{t('notes')}</label>
                    <textarea 
                      value={formData.notes} 
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      rows="3"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={submitLoading}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitLoading}>
                  {submitLoading ? <span className="btn-spinner"></span> : (editingSupplier ? t('save') : t('create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DÉTAIL FOURNISSEUR */}
      {detailModalOpen && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setDetailModalOpen(false)}>
          <div className={`modal-container ${isDark ? 'dark' : 'light'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🏭</span>
              <h3>{t('supplier_details')}</h3>
              <button className="modal-close" onClick={() => setDetailModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-grid">
                  <div className="detail-item"><strong>{t('code')}:</strong> {selectedSupplier.code}</div>
                  <div className="detail-item"><strong>{t('name')}:</strong> {selectedSupplier.name}</div>
                  <div className="detail-item"><strong>{t('contact_person')}:</strong> {selectedSupplier.contact_person || '-'}</div>
                  <div className="detail-item"><strong>{t('email')}:</strong> {selectedSupplier.email || '-'}</div>
                  <div className="detail-item"><strong>{t('phone')}:</strong> {selectedSupplier.phone || '-'}</div>
                  <div className="detail-item"><strong>{t('address')}:</strong> {selectedSupplier.address || '-'}</div>
                  <div className="detail-item"><strong>{t('tin')}:</strong> {selectedSupplier.tin || '-'}</div>
                  <div className="detail-item"><strong>{t('bank_account')}:</strong> {selectedSupplier.bank_account || '-'}</div>
                  <div className="detail-item"><strong>{t('payment_terms')}:</strong> {selectedSupplier.payment_terms} {t('days')}</div>
                  <div className="detail-item"><strong>{t('status')}:</strong> <StatusBadge isActive={selectedSupplier.is_active} t={t} /></div>
                  <div className="detail-item full-width"><strong>{t('notes')}:</strong> {selectedSupplier.notes || '-'}</div>
                </div>
              </div>

              {selectedSupplier.recent_orders && selectedSupplier.recent_orders.length > 0 && (
                <div className="detail-section">
                  <h4>{t('recent_orders')}</h4>
                  <div className="table-responsive">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>{t('order_number')}</th>
                          <th>{t('order_date')}</th>
                          <th>{t('total_amount')}</th>
                          <th>{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupplier.recent_orders.map((order, idx) => (
                          <tr key={idx}>
                            <td>{order.order_number}</td>
                            <td>{new Date(order.order_date).toLocaleDateString()} </td>
                            <td>{formatCurrency(order.total_amount)} </td>
                            <td>{order.status} </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetailModalOpen(false)}>{t('close')}</button>
              <button className="btn-primary" onClick={() => {
                setDetailModalOpen(false);
                openModal(selectedSupplier);
              }}>✏️ {t('edit')}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .suppliers-page {
          padding: 24px 32px;
          min-height: 100vh;
        }
        
        .suppliers-page.light {
          background: var(--bg-main);
        }
        
        .suppliers-page.dark {
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
        
        .stat-active, .stat-inactive {
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
          padding: 6px 12px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .bulk-delete-btn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
        }
        
        .bulk-clear-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
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
        
        .search-box input::placeholder {
          color: var(--text-muted);
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
          transition: all 0.2s;
          color: var(--text-secondary);
        }
        
        .filter-tab.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
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
        
        .data-table th, .data-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .data-table th {
          background: var(--bg-header);
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .inactive-row {
          opacity: 0.7;
          background: var(--bg-main);
        }
        
        .supplier-code {
          font-family: monospace;
          font-weight: 600;
          color: #667eea;
        }
        
        .supplier-name strong {
          display: block;
          color: var(--text-primary);
        }
        
        .supplier-name small {
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .order-count {
          display: inline-block;
          background: rgba(102,126,234,0.1);
          color: #667eea;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-badge.active {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }
        
        .status-badge.inactive {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        
        .action-buttons {
          display: flex;
          gap: 6px;
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
        .btn-icon.delete { background: rgba(239,68,68,0.1); color: #dc2626; }
        
        .btn-icon:hover { transform: scale(1.05); }
        
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
        
        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
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
          border: 1px solid var(--border);
        }
        
        .modal-container-large {
          background: var(--bg-card);
          border-radius: 20px;
          width: 95%;
          max-width: 900px;
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
        
        .form-group input:focus, 
        .form-group select:focus, 
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .form-group small {
          font-size: 11px;
          color: var(--text-secondary);
          display: block;
          margin-top: 4px;
        }
        
        .required::after {
          content: " *";
          color: #dc2626;
        }
        
        .detail-section {
          margin-bottom: 24px;
        }
        
        .detail-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .detail-item {
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        
        .detail-item.full-width {
          grid-column: span 2;
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
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .suppliers-page {
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
          .detail-item.full-width {
            grid-column: span 1;
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
          .modal-container-large {
            width: 95%;
          }
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
  return new Intl.NumberFormat('fr-BI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0) + ' FBu';
};

export default Suppliers;
