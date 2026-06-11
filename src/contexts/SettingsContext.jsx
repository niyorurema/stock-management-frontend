// frontend/src/contexts/SettingsContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { settingsService } from '../services/apiService';
import { resolveAssetUrl } from "../config/api";

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [logo, setLogo] = useState(() => {
    return localStorage.getItem('company_logo') || '/images/logo.svg';
  });
  const [companyName, setCompanyName] = useState(() => {
    return localStorage.getItem('company_name') || 'StockManager Pro';
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsService.getAll();
        const result = response.data;

        if (result.success) {
          const data = result.data;

          if (data.company_name) {
            setCompanyName(data.company_name);
            localStorage.setItem('company_name', data.company_name);
          }

          if (data.company_logo) {
            const logoUrl = resolveAssetUrl(data.company_logo);
            setLogo(logoUrl);
            localStorage.setItem('company_logo', logoUrl);
          }
        }
      } catch (error) {
        console.error('Erreur chargement settings:', error);
      } finally {
        setLoading(false);
      }
    };

    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, []);

  const updateLogo = async (newLogo) => {
    setLogo(newLogo);
    localStorage.setItem('company_logo', newLogo);
    try {
      await settingsService.update({ company_logo: newLogo });
    } catch (error) {
      console.error('Erreur sauvegarde logo:', error);
    }
  };

  const updateCompanyName = async (newName) => {
    setCompanyName(newName);
    localStorage.setItem('company_name', newName);
    try {
      await settingsService.update({ company_name: newName });
    } catch (error) {
      console.error('Erreur sauvegarde nom:', error);
    }
  };

  const uploadLogo = async (file) => {
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await settingsService.uploadLogo(formData);
      const result = response.data;
      if (result.success) {
        const logoUrl = resolveAssetUrl(result.path);
        setLogo(logoUrl);
        localStorage.setItem('company_logo', logoUrl);
        return { success: true, path: logoUrl };
      }
      return { success: false, message: result.message };
    } catch (error) {
      console.error('Erreur upload logo:', error);
      return { success: false, message: error.message };
    }
  };

  return (
    <SettingsContext.Provider value={{
      logo,
      companyName,
      loading,
      updateLogo,
      updateCompanyName,
      uploadLogo,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
