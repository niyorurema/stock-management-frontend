// frontend/src/pages/Settings.jsx
import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { settingsService } from "../services/apiService";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import Loader from "../components/common/Loader";
//import { authFetch, authFetchJson, publicAssetUrl } from "../utils/authFetch";
import { publicAssetUrl } from "../utils/authFetch";

const Settings = () => {
  const { t, language, changeLanguage } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [settings, setSettings] = useState({
    company_name: "",
    company_nif: "",
    company_rc: "",
    company_center: "",
    company_activity: "",
    company_legal_form: "",
    company_phone: "",
    company_commune: "",
    company_address: "",
    company_email: "",
    company_logo: "",
    invoice_footer_text: "",
    invoice_validity_days: "30",
    company_is_subject_to_vat: true,
    system_id: "",
    tp_postal_number: "",
    tp_address_province: "",
    tp_address_quartier: "",
    tp_address_rue: "",
    tp_address_avenue: "",
    tp_address_number: "",
    ct_taxpayer: false,
    tl_taxpayer: false,
    tsce_tax: false,
    ott_tax: false,
    vat_exemption: false,
    tp_activity_sector: "",
    tp_type: "1",
    ebms_username: "",
    ebms_password: "",
    ebms_public_key: "",
    ebms_login_url: "",
    ebms_get_invoice_url: "",
    ebms_add_invoice_url: "",
    ebms_check_tin_url: "",
    ebms_cancel_invoice_url: "",
    ebms_add_stock_movement_url: "",
    ebms_sync_stock_movements: false,
    ebms_sync_invoices: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testingEbms, setTestingEbms] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const fileInputRef = useRef(null);

  const getLogoUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return publicAssetUrl(path);
  };

  const parseBoolean = (value) => {
    return value === true || value === "1" || value === 1 || value === "true";
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.getAll();
      if (response.data?.success) {
        const data = response.data.data;
         //const settingsData = response.data.data;
        const normalized = {
          ...data,
          company_is_subject_to_vat: parseBoolean(
            data.company_is_subject_to_vat,
          ),
          vat_exemption: parseBoolean(data.vat_exemption),
          ct_taxpayer: parseBoolean(data.ct_taxpayer),
          tl_taxpayer: parseBoolean(data.tl_taxpayer),
          tsce_tax: parseBoolean(data.tsce_tax),
          ott_tax: parseBoolean(data.ott_tax),
          ebms_sync_stock_movements: parseBoolean(
            data.ebms_sync_stock_movements,
          ),
          ebms_sync_invoices: parseBoolean(data.ebms_sync_invoices),
        };
        setSettings((prev) => ({ ...prev, ...normalized }));
        if (data.company_logo) {
          setLogoPreview(data.company_logo);
          setLogoError(false);
        }
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error(t("error_loading_settings"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update(settings);
      await Swal.fire({
        icon: "success",
        title: t("save_success"),
        text: t("save_success_text"),
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f1f5f9" : "#1e293b",
        confirmButtonColor: "#10b981",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error(t("error_saving_settings"));
    } finally {
      setSaving(false);
    }
  };

  const testEbmsConnection = async () => {
    setTestingEbms(true);
    try {
      const response = await settingsService.testEbmsConnection();
      if (response.data?.success) {
        toast.success(response.data.message || t("ebms_connection_success"));
      } else {
        toast.error(response.data?.message || t("ebms_connection_error"));
      }
    } catch (error) {
      console.error("Erreur test EBMS:", error);
      toast.error(error.response?.data?.message || t("ebms_connection_error"));
    } finally {
      setTestingEbms(false);
    }
  };

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === "checkbox" ? checked : value,
    });
  };

const handleLogoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    await Swal.fire({
      icon: "error",
      title: t("error_format"),
      text: t("error_format_text"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
      confirmButtonColor: "#dc2626",
    });
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    await Swal.fire({
      icon: "error",
      title: t("error_size"),
      text: t("error_size_text"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
      confirmButtonColor: "#dc2626",
    });
    return;
  }

  setUploading(true);
  const formData = new FormData();
  formData.append("logo", file);

  try {
    const response = await settingsService.uploadLogo(formData);
    const result = response.data;

    if (result.success) {
      const logoPath = result.data?.path || result.path;
      setLogoPreview(logoPath);
      setLogoError(false);
      setSettings({ ...settings, company_logo: logoPath });

      await Swal.fire({
        icon: "success",
        title: t("logo_upload_success"),
        text: t("logo_upload_success_text"),
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f1f5f9" : "#1e293b",
        confirmButtonColor: "#10b981",
        timer: 2000,
        showConfirmButton: false,
      });
    } else {
      await Swal.fire({
        icon: "error",
        title: t("error_upload"),
        text: result.message || t("error_upload_text"),
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f1f5f9" : "#1e293b",
        confirmButtonColor: "#dc2626",
      });
    }
  } catch (error) {
    console.error("Erreur upload:", error);
    await Swal.fire({
      icon: "error",
      title: t("error_network"),
      text: error.response?.data?.message || t("error_network_text"),
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
      confirmButtonColor: "#dc2626",
    });
  } finally {
    setUploading(false);
  }
};

  const removeLogo = async () => {
    const result = await Swal.fire({
      title: t("logo_delete_confirm"),
      text: t("logo_delete_confirm_text"),
      icon: "question",
      showCancelButton: true,
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f1f5f9" : "#1e293b",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: t("confirm_yes"),
      cancelButtonText: t("confirm_no"),
    });

    if (result.isConfirmed) {
      setSettings({ ...settings, company_logo: "" });
      setLogoPreview(null);
      setLogoError(false);
      await Swal.fire({
        icon: "success",
        title: t("logo_delete_success"),
        text: t("logo_delete_success_text"),
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f1f5f9" : "#1e293b",
        confirmButtonColor: "#10b981",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

const resetSettings = async () => {
  const result = await Swal.fire({
    title: t("reset_confirm_title"),
    html: `
      <div style="text-align: left;">
        <p style="margin-bottom: 10px;">${t("reset_confirm_text")}</p>
        <ul style="margin-left: 20px; color: ${isDark ? "#94a3b8" : "#666"};">
          <li>${t("reset_confirm_list1")}</li>
          <li>${t("reset_confirm_list2")}</li>
          <li>${t("reset_confirm_list3")}</li>
        </ul>
      </div>
    `,
    icon: "warning",
    showCancelButton: true,
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#f1f5f9" : "#1e293b",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    confirmButtonText: t("reset_confirm_confirm"),
    cancelButtonText: t("reset_confirm_cancel"),
    reverseButtons: true,
  });

  if (result.isConfirmed) {
    try {
      const response = await settingsService.reset();
      const data = response.data;

      if (data.success) {
        setSettings((prev) => ({ ...prev, ...data.data }));
        setLogoPreview(data.data.company_logo || null);
        setLogoError(false);

        await Swal.fire({
          icon: "success",
          title: t("reset_success"),
          text: t("reset_success_text"),
          background: isDark ? "#1e293b" : "#ffffff",
          color: isDark ? "#f1f5f9" : "#1e293b",
          confirmButtonColor: "#10b981",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          icon: "error",
          title: t("error_upload"),
          text: data.message || t("error_upload_text"),
          background: isDark ? "#1e293b" : "#ffffff",
          color: isDark ? "#f1f5f9" : "#1e293b",
          confirmButtonColor: "#dc2626",
        });
      }
    } catch (error) {
      console.error("Erreur reset:", error);
      await Swal.fire({
        icon: "error",
        title: t("error_network"),
        text: error.response?.data?.message || t("error_network_text"),
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f1f5f9" : "#1e293b",
        confirmButtonColor: "#dc2626",
      });
    }
  }
};

  if (loading) {
    return <Loader text={t("loading")} />;
  }

  return (
    <div className={`settings-page ${isDark ? "dark" : "light"}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#1e293b",
          },
        }}
      />

      <div className="settings-header">
        <div className="header-content">
          <h1>⚙️ {t("settings")}</h1>
          <p>{t("settings_subtitle")}</p>
        </div>
        <button type="button" className="btn-reset" onClick={resetSettings}>
          🔄 {t("reset")}
        </button>
      </div>

      <div className={`settings-tabs ${isDark ? "dark" : "light"}`}>
        <button
          className={`tab-btn ${activeTab === "company" ? "active" : ""}`}
          onClick={() => setActiveTab("company")}
        >
          🏢 {t("company")}
        </button>
        <button
          className={`tab-btn ${activeTab === "taxpayer" ? "active" : ""}`}
          onClick={() => setActiveTab("taxpayer")}
        >
          🏛️ {t("taxpayer_info")}
        </button>
        <button
          className={`tab-btn ${activeTab === "taxes" ? "active" : ""}`}
          onClick={() => setActiveTab("taxes")}
        >
          💰 {t("taxes")}
        </button>
        <button
          className={`tab-btn ${activeTab === "invoice" ? "active" : ""}`}
          onClick={() => setActiveTab("invoice")}
        >
          📄 {t("invoice")}
        </button>
        <button
          className={`tab-btn ${activeTab === "ebms" ? "active" : ""}`}
          onClick={() => setActiveTab("ebms")}
        >
          🔗 EBMS
        </button>
        <button
          className={`tab-btn ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          👁️ {t("preview")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {/* Onglet Entreprise */}
        {activeTab === "company" && (
          <div className="tab-content">
            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">🏢</span>
                <h3>{t("company_info")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("company_name")} *</label>
                  <input
                    type="text"
                    name="company_name"
                    value={settings.company_name}
                    onChange={handleChange}
                    placeholder="MUHIZI BLESSED COMPANY"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t("company_nif")} *</label>
                  <input
                    type="text"
                    name="company_nif"
                    value={settings.company_nif}
                    onChange={handleChange}
                    placeholder="4002141416"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t("company_rc")}</label>
                  <input
                    type="text"
                    name="company_rc"
                    value={settings.company_rc}
                    onChange={handleChange}
                    placeholder="0041847/23"
                  />
                </div>
                <div className="form-group">
                  <label>{t("company_center")}</label>
                  <input
                    type="text"
                    name="company_center"
                    value={settings.company_center}
                    onChange={handleChange}
                    placeholder="DPMC"
                  />
                </div>
                <div className="form-group">
                  <label>{t("company_activity")}</label>
                  <input
                    type="text"
                    name="company_activity"
                    value={settings.company_activity}
                    onChange={handleChange}
                    placeholder="COMMERCE GENERAL"
                  />
                </div>
                <div className="form-group">
                  <label>{t("company_legal_form")}</label>
                  <input
                    type="text"
                    name="company_legal_form"
                    value={settings.company_legal_form}
                    onChange={handleChange}
                    placeholder="SU"
                  />
                </div>
                <div className="form-group">
                  <label>{t("company_is_subject_to_vat")}</label>
                  <select
                    name="company_is_subject_to_vat"
                    value={settings.company_is_subject_to_vat ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        company_is_subject_to_vat: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">✅ Oui</option>
                    <option value="0">❌ Non</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">📍</span>
                <h3>{t("contact_info")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("phone")}</label>
                  <input
                    type="tel"
                    name="company_phone"
                    value={settings.company_phone}
                    onChange={handleChange}
                    placeholder="69377364"
                  />
                </div>
                <div className="form-group">
                  <label>{t("email")}</label>
                  <input
                    type="email"
                    name="company_email"
                    value={settings.company_email}
                    onChange={handleChange}
                    placeholder="contact@entreprise.com"
                  />
                </div>
                <div className="form-group">
                  <label>{t("commune")}</label>
                  <input
                    type="text"
                    name="company_commune"
                    value={settings.company_commune}
                    onChange={handleChange}
                    placeholder="MUKAZA"
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("address")}</label>
                  <input
                    type="text"
                    name="company_address"
                    value={settings.company_address}
                    onChange={handleChange}
                    placeholder="ROHERO"
                  />
                </div>
              </div>
            </div>

            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">🖼️</span>
                <h3>{t("company_logo")}</h3>
              </div>
              <div className="logo-section">
                <div className="logo-preview">
                  {logoPreview && !logoError ? (
                    <div className="logo-image">
                      <img
                        src={getLogoUrl(logoPreview)}
                        alt="Logo"
                        onError={() => setLogoError(true)}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                      <button
                        type="button"
                        className="btn-remove-logo"
                        onClick={removeLogo}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="logo-placeholder">
                      <span className="placeholder-icon">🏢</span>
                      <span>{t("no_logo")}</span>
                    </div>
                  )}
                </div>
                <div className="logo-upload">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/jpeg,image/png,image/jpg,image/gif"
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    className="btn-upload-logo"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "⏳..." : `📤 ${t("choose_logo")}`}
                  </button>
                  <p className="upload-hint">{t("logo_hint")}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Contribuable */}
        {activeTab === "taxpayer" && (
          <div className="tab-content">
            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">🏛️</span>
                <h3>{t("system_identification")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>
                    {t("system_id")}
                    {settings.system_id ? " ✅ (Non modifiable)" : " *"}
                  </label>
                  <input
                    type="text"
                    name="system_id"
                    value={settings.system_id}
                    onChange={handleChange}
                    placeholder="SM-0001"
                    disabled={!!settings.system_id}
                    required={!settings.system_id}
                  />
                  {settings.system_id && (
                    <small
                      style={{
                        color: "var(--text-secondary)",
                        marginTop: "4px",
                      }}
                    >
                      ℹ️ {t("system_id_locked")}
                    </small>
                  )}
                </div>
              </div>
            </div>

            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">📍</span>
                <h3>{t("taxpayer_address")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("tp_postal_number")}</label>
                  <input
                    type="text"
                    name="tp_postal_number"
                    value={settings.tp_postal_number}
                    onChange={handleChange}
                    placeholder="Boîte postale"
                    maxLength="20"
                  />
                </div>
                <div className="form-group">
                  <label>{t("ct_taxpayer")}</label>
                  <select
                    name="ct_taxpayer"
                    value={settings.ct_taxpayer ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ct_taxpayer: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">✅ Oui</option>
                    <option value="0">❌ Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("tp_address_province")}</label>
                  <input
                    type="text"
                    name="tp_address_province"
                    value={settings.tp_address_province}
                    onChange={handleChange}
                    placeholder="Province"
                    maxLength="50"
                  />
                </div>
                <div className="form-group">
                  <label>{t("tp_address_quartier")}</label>
                  <input
                    type="text"
                    name="tp_address_quartier"
                    value={settings.tp_address_quartier}
                    onChange={handleChange}
                    placeholder="Quartier"
                    maxLength="50"
                  />
                </div>
                <div className="form-group">
                  <label>{t("tp_address_rue")}</label>
                  <input
                    type="text"
                    name="tp_address_rue"
                    value={settings.tp_address_rue}
                    onChange={handleChange}
                    placeholder="Rue"
                    maxLength="50"
                  />
                </div>
                <div className="form-group">
                  <label>{t("tp_address_avenue")}</label>
                  <input
                    type="text"
                    name="tp_address_avenue"
                    value={settings.tp_address_avenue}
                    onChange={handleChange}
                    placeholder="Avenue"
                    maxLength="50"
                  />
                </div>
                <div className="form-group">
                  <label>{t("tp_address_number")}</label>
                  <input
                    type="text"
                    name="tp_address_number"
                    value={settings.tp_address_number}
                    onChange={handleChange}
                    placeholder="Numéro"
                    maxLength="10"
                  />
                </div>
              </div>
            </div>

            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">🏷️</span>
                <h3>{t("taxpayer_classification")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("tp_type")} *</label>
                  <select
                    name="tp_type"
                    value={settings.tp_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="1">👤 {t("tp_type_physical")}</option>
                    <option value="2">🏢 {t("tp_type_moral")}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("tl_taxpayer")}</label>
                  <select
                    name="tl_taxpayer"
                    value={settings.tl_taxpayer ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tl_taxpayer: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">✅ Oui</option>
                    <option value="0">❌ Non</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>{t("tp_activity_sector")}</label>
                  <input
                    type="text"
                    name="tp_activity_sector"
                    value={settings.tp_activity_sector}
                    onChange={handleChange}
                    placeholder="Secteur d'activité"
                    maxLength="250"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Taxes */}
        {activeTab === "taxes" && (
          <div className="tab-content">
            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">💰</span>
                <h3>{t("tax_configuration")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("company_is_subject_to_vat")}</label>
                  <select
                    name="company_is_subject_to_vat"
                    value={settings.company_is_subject_to_vat ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        company_is_subject_to_vat: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">✅ Oui</option>
                    <option value="0">❌ Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("tsce_tax")}</label>
                  <select
                    name="tsce_tax"
                    value={settings.tsce_tax ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tsce_tax: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">✅ Oui</option>
                    <option value="0">❌ Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("ott_tax")}</label>
                  <select
                    name="ott_tax"
                    value={settings.ott_tax ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ott_tax: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">✅ Oui</option>
                    <option value="0">❌ Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t("vat_exemption")}</label>
                  <select
                    name="vat_exemption"
                    value={settings.vat_exemption ? "1" : "0"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        vat_exemption: e.target.value === "1",
                      })
                    }
                  >
                    <option value="0">❌ {t("no")}</option>
                    <option value="1">✅ {t("yes")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet EBMS */}
        {activeTab === "ebms" && (
          <div className="tab-content">
            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">🔗</span>
                <h3>{t("ebms_api_endpoints")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>{t("ebms_login_url")}</label>
                  <input
                    type="url"
                    name="ebms_login_url"
                    value={settings.ebms_login_url}
                    onChange={handleChange}
                    placeholder="https://ebms.obr.gov.bi:9443/ebms_api/login/"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Nom d'utilisateur EBMS</label>
                  <input
                    type="text"
                    name="ebms_username"
                    value={settings.ebms_username}
                    onChange={handleChange}
                    placeholder="Nom d'utilisateur EBMS"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Mot de passe EBMS</label>
                  <input
                    type="password"
                    name="ebms_password"
                    value={settings.ebms_password}
                    onChange={handleChange}
                    placeholder="Mot de passe EBMS"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Clé publique EBMS</label>
                  <textarea
                    name="ebms_public_key"
                    value={settings.ebms_public_key}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Clé publique EBMS"
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("ebms_get_invoice_url")}</label>
                  <input
                    type="url"
                    name="ebms_get_invoice_url"
                    value={settings.ebms_get_invoice_url}
                    onChange={handleChange}
                    placeholder="https://ebms.obr.gov.bi:9443/ebms_api/getInvoice/"
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("ebms_add_invoice_url")}</label>
                  <input
                    type="url"
                    name="ebms_add_invoice_url"
                    value={settings.ebms_add_invoice_url}
                    onChange={handleChange}
                    placeholder="https://ebms.obr.gov.bi:9443/ebms_api/addInvoice_confirm/"
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("ebms_check_tin_url")}</label>
                  <input
                    type="url"
                    name="ebms_check_tin_url"
                    value={settings.ebms_check_tin_url}
                    onChange={handleChange}
                    placeholder="https://ebms.obr.gov.bi:9443/ebms_api/checkTIN/"
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("ebms_cancel_invoice_url")}</label>
                  <input
                    type="url"
                    name="ebms_cancel_invoice_url"
                    value={settings.ebms_cancel_invoice_url}
                    onChange={handleChange}
                    placeholder="https://ebms.obr.gov.bi:9443/ebms_api/cancelInvoice/"
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("ebms_add_stock_movement_url")}</label>
                  <input
                    type="url"
                    name="ebms_add_stock_movement_url"
                    value={settings.ebms_add_stock_movement_url}
                    onChange={handleChange}
                    placeholder="https://ebms.obr.gov.bi:9443/ebms_api/AddStockMovement/"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Synchroniser les mouvements de stock avec EBMS</label>
                  <div className="checkbox-group">
                    <label className="switch">
                      <input
                        type="checkbox"
                        name="ebms_sync_stock_movements"
                        checked={settings.ebms_sync_stock_movements}
                        onChange={handleChange}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span>Activer l'envoi des mouvements de stock</span>
                  </div>
                </div>
                <div className="form-group full-width">
                  <label>Synchroniser les factures avec EBMS</label>
                  <div className="checkbox-group">
                    <label className="switch">
                      <input
                        type="checkbox"
                        name="ebms_sync_invoices"
                        checked={settings.ebms_sync_invoices}
                        onChange={handleChange}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span>Activer l'envoi des factures vers EBMS</span>
                  </div>
                </div>
                <div className="form-group full-width">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={testEbmsConnection}
                    disabled={testingEbms}
                  >
                    {testingEbms
                      ? "Test en cours..."
                      : "Tester la connexion EBMS"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "invoice" && (
          <div className="tab-content">
            <div className={`form-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">📄</span>
                <h3>{t("invoice_customization")}</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("invoice_validity")}</label>
                  <input
                    type="number"
                    name="invoice_validity_days"
                    value={settings.invoice_validity_days}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group full-width">
                  <label>{t("invoice_footer")}</label>
                  <textarea
                    name="invoice_footer_text"
                    value={settings.invoice_footer_text}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Merci de votre confiance..."
                  />
                </div>
              </div>
            </div>

            <div className={`form-card info-card ${isDark ? "dark" : "light"}`}>
              <div className="card-header">
                <span className="card-icon">ℹ️</span>
                <h3>{t("info_title")}</h3>
              </div>
              <div className="info-list">
                <div className="info-item">
                  <span className="info-dot">•</span>
                  <span>{t("info_tva")}</span>
                </div>
                <div className="info-item">
                  <span className="info-dot">•</span>
                  <span>{t("info_ebms")}</span>
                </div>
                <div className="info-item">
                  <span className="info-dot">•</span>
                  <span>{t("info_qrcode")}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Aperçu */}
        {activeTab === "preview" && (
          <div className="tab-content">
            <div className={`preview-card ${isDark ? "dark" : "light"}`}>
              <div className="preview-header">
                <h3>{t("invoice_preview")}</h3>
                <p>{t("preview_description")}</p>
              </div>
              <div className="preview-invoice">
                <div className="preview-company">
                  {logoPreview && !logoError && (
                    <img
                      src={getLogoUrl(logoPreview)}
                      alt="Logo"
                      className="preview-logo"
                      onError={(e) => {
                        e.target.style.display = "none";
                        setLogoError(true);
                      }}
                    />
                  )}
                  <div className="preview-info">
                    <h4>{settings.company_name || t("company_name")}</h4>
                    <p>
                      {t("company_nif")}: {settings.company_nif || "---"}
                    </p>
                    <p>
                      {t("company_rc")}: {settings.company_rc || "---"}
                    </p>
                    <p>
                      {t("phone")}: {settings.company_phone || "---"}
                    </p>
                    <p>
                      {settings.company_address || "---"},{" "}
                      {settings.company_commune || "---"}
                    </p>
                  </div>
                </div>
                <div className="preview-divider"></div>
                <div className="preview-footer">
                  <p>{settings.invoice_footer_text || t("invoice_footer")}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? `💾 ${t("saving")}` : `💾 ${t("save_settings")}`}
          </button>
        </div>
      </form>

      <style>{`
        .settings-page {
          min-height: 100vh;
          padding: 24px 32px;
        }
        
        .settings-page.light {
          background: var(--bg-main);
        }
        
        .settings-page.dark {
          background: var(--bg-main);
        }

        /* Header */
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-content h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--text-primary);
        }

        .header-content p {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .btn-reset {
          padding: 10px 20px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-reset:hover {
          background: rgba(220,38,38,0.1);
          border-color: #dc2626;
          color: #dc2626;
        }

        /* Tabs */
        .settings-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          padding: 6px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }

        .tab-btn {
          flex: 1;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          box-shadow: 0 2px 8px rgba(102,126,234,0.3);
        }

        .tab-btn:hover:not(.active) {
          background: var(--bg-main);
        }

        /* Form Cards */
        .form-card {
          background: var(--bg-card);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 20px;
          border: 1px solid var(--border);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(102,126,234,0.2);
        }

        .card-icon {
          font-size: 22px;
        }

        .card-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        /* Form Grid */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group.full-width {
          grid-column: span 2;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 14px;
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

        /* Logo Section */
        .logo-section {
          display: flex;
          gap: 30px;
          align-items: center;
          flex-wrap: wrap;
        }

        .logo-preview {
          width: 120px;
          height: 120px;
          border: 2px dashed var(--border);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-main);
        }

        .logo-image {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-image img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .btn-remove-logo {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .btn-remove-logo:hover {
          transform: scale(1.1);
        }

        .logo-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }

        .placeholder-icon {
          font-size: 40px;
        }

        .btn-upload-logo {
          padding: 10px 24px;
          background: var(--bg-main);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-upload-logo:hover:not(:disabled) {
          background: var(--bg-card);
        }

        .btn-upload-logo:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-hint {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        /* Info Card */
        .info-card {
          background: rgba(245,158,11,0.1);
          border-left: 4px solid #f59e0b;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--text-primary);
        }

        .info-dot {
          color: #f59e0b;
          font-weight: bold;
        }

        /* Preview Card */
        .preview-card {
          background: var(--bg-card);
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .preview-header {
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 20px;
          color: white;
        }

        .preview-header h3 {
          font-size: 18px;
          margin-bottom: 4px;
        }

        .preview-header p {
          font-size: 12px;
          opacity: 0.8;
        }

        .preview-invoice {
          padding: 24px;
        }

        .preview-company {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .preview-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
        }

        .preview-info h4 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .preview-info p {
          font-size: 11px;
          color: var(--text-secondary);
          margin: 2px 0;
        }

        .preview-divider {
          height: 1px;
          background: linear-gradient(to right, var(--border), transparent);
          margin: 20px 0;
        }

        .preview-footer {
          text-align: center;
          font-size: 11px;
          color: var(--text-secondary);
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        /* Form Actions */
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .btn-save {
          padding: 12px 32px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-save:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16,185,129,0.4);
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Loading */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 16px;
        }

        .loading-container.light {
          background: var(--bg-main);
        }

        .loading-container.dark {
          background: var(--bg-main);
        }

        .loading-container p {
          color: var(--text-secondary);
        }

        .loader-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .settings-page {
            padding: 16px;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .form-group.full-width {
            grid-column: span 1;
          }
          .settings-tabs {
            flex-direction: column;
          }
          .logo-section {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Settings;
