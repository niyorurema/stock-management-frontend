// frontend/src/components/ThemeSwitcher.jsx
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeSwitcher = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="theme-switcher" onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
      
      <style jsx="true">{`
        .theme-switcher {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--card-bg, white);
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .theme-switcher:hover {
          transform: scale(1.05);
          background: var(--hover-bg, #f1f5f9);
        }
      `}</style>
    </button>
  );
};

export default ThemeSwitcher;