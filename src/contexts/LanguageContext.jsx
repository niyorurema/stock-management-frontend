import React, { createContext, useState, useContext, useEffect } from "react";
import frTranslations from "../translations/fr.json";
import enTranslations from "../translations/en.json";
import biTranslations from "../translations/bi.json";

const translations = {
  fr: frTranslations,
  en: enTranslations,
  bi: biTranslations,
};

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("language") || "fr";
  });

  const [t, setT] = useState(translations[language]);

  useEffect(() => {
    setT(translations[language]);
    localStorage.setItem("language", language);
  }, [language]);

  const changeLanguage = (lang) => {
    if (translations[lang]) setLanguage(lang);
  };

  const translate = (key) => {
    return t[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, changeLanguage, t: translate }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
