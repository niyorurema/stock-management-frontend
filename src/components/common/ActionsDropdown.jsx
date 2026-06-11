// frontend/src/components/common/ActionsDropdown.jsx
import React, { useState, useRef, useEffect } from 'react';
import Tippy from '@tippyjs/react';

const ActionsDropdown = ({ 
  order, 
  onViewDetail, 
  onEdit, 
  onApprove, 
  onReceive, 
  onPrint, 
  onShare,
  approveLoading,
  printLoading,
  t 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleAction = (action) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="actions-dropdown" ref={dropdownRef}>
      <button 
        className="dropdown-trigger" 
        onClick={toggleDropdown}
        aria-label={t('actions')}
      >
        ⋯
      </button>
      
      {isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={() => handleAction(() => onViewDetail(order))}>
            <span className="dropdown-icon">👁️</span>
            <span>{t('view_details')}</span>
          </button>
          
          {order.status !== 'approved' && order.status !== 'completed' && order.status !== 'cancelled' && (
            <button className="dropdown-item" onClick={() => handleAction(() => onEdit(order))}>
              <span className="dropdown-icon">✏️</span>
              <span>{t('edit')}</span>
            </button>
          )}
          
          {order.status === 'pending' && (
            <button className="dropdown-item" onClick={() => handleAction(() => onApprove(order))} disabled={approveLoading === order.id}>
              <span className="dropdown-icon">{approveLoading === order.id ? <span className="btn-spinner-small"></span> : '✅'}</span>
              <span>{t('approve')}</span>
            </button>
          )}
          
          {order.status === 'approved' && (
            <button className="dropdown-item" onClick={() => handleAction(() => onReceive(order))}>
              <span className="dropdown-icon">📥</span>
              <span>{t('receive')}</span>
            </button>
          )}
          
          <button className="dropdown-item" onClick={() => handleAction(() => onPrint(order))} disabled={printLoading === order.id}>
            <span className="dropdown-icon">{printLoading === order.id ? <span className="btn-spinner-small"></span> : '🖨️'}</span>
            <span>{t('print')}</span>
          </button>
          
          <button className="dropdown-item" onClick={() => handleAction(() => onShare(order))}>
            <span className="dropdown-icon">📤</span>
            <span>{t('share')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionsDropdown;