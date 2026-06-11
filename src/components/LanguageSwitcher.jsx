// frontend/src/components/LanguageSwitcher.jsx
import React, { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "bi", name: "Kirundi", flag: "🇧🇮" },
  ];

  const currentLang = languages.find((l) => l.code === language);

  return (
    <div className="language-switcher">
      <button className="lang-btn" onClick={() => setIsOpen(!isOpen)}>
        <span className="lang-flag">{currentLang?.flag}</span>
        <span className="lang-name">{currentLang?.name}</span>
        <span className="lang-chevron">▼</span>
      </button>

      {isOpen && (
        <div className="lang-dropdown">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`lang-option ${language === lang.code ? "active" : ""}`}
              onClick={() => {
                changeLanguage(lang.code);
                setIsOpen(false);
              }}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span className="lang-name">{lang.name}</span>
              {language === lang.code && <span className="checkmark">✓</span>}
            </button>
          ))}
        </div>
      )}

      <style jsx="true">{`
        .language-switcher {
          position: relative;
          display: inline-block;
        }

        .lang-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--card-bg, white);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .lang-btn:hover {
          background: var(--hover-bg, #f1f5f9);
        }

        .lang-flag {
          font-size: 18px;
        }

        .lang-name {
          font-weight: 500;
        }

        .lang-chevron {
          font-size: 12px;
          transition: transform 0.2s;
        }

        .lang-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: var(--card-bg, white);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          min-width: 150px;
          z-index: 1000;
        }

        .lang-option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 14px;
          text-align: left;
          transition: background 0.2s;
        }

        .lang-option:first-child {
          border-radius: 8px 8px 0 0;
        }

        .lang-option:last-child {
          border-radius: 0 0 8px 8px;
        }

        .lang-option:hover {
          background: var(--hover-bg, #f1f5f9);
        }

        .lang-option.active {
          background: var(--primary-light, #e0f2fe);
          font-weight: 600;
        }

        .lang-option .lang-flag {
          font-size: 18px;
          min-width: 24px;
        }

        .lang-option .lang-name {
          flex: 1;
        }

        .checkmark {
          color: var(--primary, #0ea5e9);
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default LanguageSwitcher;
