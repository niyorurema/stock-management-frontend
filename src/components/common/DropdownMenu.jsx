// frontend/src/components/common/DropdownMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const DropdownMenu = ({ trigger, items, isOpen, onClose, position = 'bottom' }) => {
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      let top = rect.bottom + window.scrollY;
      let left = rect.right - 180; // Largeur approximative du dropdown
      
      // Vérifier l'espace en bas
      if (position === 'bottom' && rect.bottom + 250 > viewportHeight) {
        top = rect.top + window.scrollY - 250;
      }
      
      // Vérifier l'espace à droite
      if (left + 180 > viewportWidth) {
        left = viewportWidth - 190;
      }
      
      setDropdownStyle({
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999
      });
    }
  }, [isOpen, position]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target)) {
        const dropdownElement = document.querySelector('.portal-dropdown');
        if (dropdownElement && !dropdownElement.contains(event.target)) {
          onClose();
        }
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      <span ref={triggerRef} onClick={(e) => e.stopPropagation()}>
        {trigger}
      </span>
      
      {isOpen && createPortal(
        <div className="portal-dropdown" style={dropdownStyle}>
          <div className="dropdown-menu-portal">
            {items.map((item, index) => (
              <React.Fragment key={index}>
                {item.divider ? (
                  <div className="dropdown-divider" />
                ) : (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      item.onClick();
                      onClose();
                    }}
                    disabled={item.disabled}
                  >
                    <span className="dropdown-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default DropdownMenu;