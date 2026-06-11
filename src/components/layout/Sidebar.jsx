// frontend/src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";
import Tooltip from "../common/Tooltip";
import { useNavigate } from "react-router-dom";
import { hasPermission, ROUTE_PERMISSIONS } from "../../utils/permissions";
import { publicAssetUrl } from "../../utils/authFetch"; // Ajout de l'import

function Sidebar({
  collapsed,
  setCollapsed,
  activePage,
  setActivePage,
  mobileMenuOpen: mobileMenuOpenProp,
  setMobileMenuOpen: setMobileMenuOpenProp,
}) {
  const { logout, user } = useAuth();
  const { t, language, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { logo, companyName, loading } = useSettings();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpenInternal, setMobileMenuOpenInternal] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const mobileMenuOpen = mobileMenuOpenProp ?? mobileMenuOpenInternal;
  const setMobileMenuOpen = setMobileMenuOpenProp ?? setMobileMenuOpenInternal;
  const navigate = useNavigate();

  // Fonction pour obtenir l'URL complète du logo
  const getLogoUrl = (logoPath) => {
    if (!logoPath) return null;
    if (logoPath.startsWith("http")) return logoPath;
    if (logoPath.startsWith("/images/")) return logoPath;

    // Utiliser publicAssetUrl pour construire l'URL complète
    return publicAssetUrl(logoPath);
  };

  // Détection mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Réinitialiser l'état d'erreur quand le logo change
  useEffect(() => {
    setLogoError(false);
    setLogoLoaded(false);
  }, [logo]);

  const handleNavigation = (page) => {
    setActivePage(page);
    let path = `/${page}`;
    if (page === "dashboard") path = "/";

    navigate(path);
    window.dispatchEvent(new CustomEvent("forceRefresh", { detail: { page } }));

    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = () => {
    logout();
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const allMenuItems = [
    { id: "dashboard", icon: "📊", label: "dashboard" },
    { id: "products", icon: "📦", label: "products" },
    { id: "categories", icon: "📁", label: "categories" },
    { id: "stock", icon: "🏪", label: "stock" },
    { id: "invoices", icon: "📄", label: "invoices" },
    { id: "customers", icon: "👥", label: "customers" },
    { id: "suppliers", icon: "🏭", label: "suppliers" },
    { id: "purchase-orders", icon: "📦", label: "purchase_orders" },
    { id: "reservations", icon: "📅", label: "reservations" },
    { id: "sales-dashboard", icon: "💰", label: "sales_dashboard" },
    { id: "warehouses", icon: "🏭", label: "warehouses" },
    { id: "reports", icon: "📈", label: "reports" },
    { id: "users", icon: "👥", label: "users" },
    { id: "roles", icon: "🔐", label: "roles" },
    { id: "settings", icon: "⚙️", label: "settings" },
  ];

  const menuItems = allMenuItems.filter((item) => {
    const perm = ROUTE_PERMISSIONS[item.id];
    if (perm === null || perm === undefined) return true;
    return hasPermission(user, perm);
  });

  const sidebarClasses = [
    "sidebar",
    collapsed && !isMobile ? "collapsed" : "",
    isMobile ? "mobile" : "",
    mobileMenuOpen ? "mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Sidebar */}
      <div className={sidebarClasses}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-circle">
              <div className="logo-circle-outer"></div>
              <div className="logo-circle-inner">
                {loading ? (
                  <div className="logo-skeleton"></div>
                ) : logo && logo !== "/images/logo.svg" && logo !== "" ? (
                  <img
                    src={publicAssetUrl(logo)}
                    alt={companyName || "Logo"}
                    className="logo-img"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      console.error("Erreur chargement logo:", logo);
                      e.target.style.display = "none";
                      // Afficher l'icône de fallback
                      const parent = e.target.closest(".logo-circle-inner");
                      if (parent) {
                        const icon = parent.querySelector(".logo-icon");
                        if (icon) icon.style.display = "flex";
                      }
                    }}
                    onLoad={(e) => {
                      console.log("Logo chargé:", logo);
                      // Masquer l'icône de fallback
                      const parent = e.target.closest(".logo-circle-inner");
                      if (parent) {
                        const icon = parent.querySelector(".logo-icon");
                        if (icon) icon.style.display = "none";
                      }
                    }}
                  />
                ) : (
                  <span
                    className="logo-icon"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                    }}
                  >
                    📦
                  </span>
                )}
              </div>
            </div>
            {(!collapsed || isMobile) && (
              <div className="logo-text">
                <span className="logo-name">SM</span>
                <span className="logo-badge">Pro</span>
              </div>
            )}
          </div>
          {!isMobile && (
            <button
              className="collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "→" : "←"}
            </button>
          )}
          {isMobile && mobileMenuOpen && (
            <button className="collapse-btn" onClick={toggleMobileMenu}>
              ✕
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="sidebar-nav-wrapper">
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <Tooltip
                key={item.id}
                content={collapsed && !isMobile ? t(item.label) : ""}
                placement="right"
              >
                <button
                  className={`nav-link ${activePage === item.id ? "active" : ""}`}
                  onClick={() => handleNavigation(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {(!collapsed || isMobile) && (
                    <span className="nav-label">{t(item.label)}</span>
                  )}
                </button>
              </Tooltip>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="footer-btn" onClick={toggleTheme}>
            <span className="nav-icon">{theme === "light" ? "🌙" : "☀️"}</span>
            {(!collapsed || isMobile) && (
              <span>{theme === "light" ? t("") : t("")}</span>
            )}
          </button>

          <div className="footer-btn-wrapper">
            <button
              className="footer-btn language-select-btn"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            >
              <span className="nav-icon">🌐</span>
              {(!collapsed || isMobile) && (
                <span className="language-label">
                  {language === "fr" ? "FR" : language === "en" ? "EN" : "BI"}
                </span>
              )}
            </button>
            {langDropdownOpen && (
              <div className="language-dropdown-menu">
                <button
                  className={`language-option ${language === "fr" ? "active" : ""}`}
                  onClick={() => {
                    changeLanguage("fr");
                    setLangDropdownOpen(false);
                  }}
                >
                  <span>🇫🇷</span> Français
                </button>
                <button
                  className={`language-option ${language === "en" ? "active" : ""}`}
                  onClick={() => {
                    changeLanguage("en");
                    setLangDropdownOpen(false);
                  }}
                >
                  <span>🇬🇧</span> English
                </button>
                <button
                  className={`language-option ${language === "bi" ? "active" : ""}`}
                  onClick={() => {
                    changeLanguage("bi");
                    setLangDropdownOpen(false);
                  }}
                >
                  <span>🇧🇮</span> Kirundi
                </button>
              </div>
            )}
          </div>

          <button className="footer-btn logout" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            {(!collapsed || isMobile) && <span>{t("")}</span>}
          </button>
        </div>
      </div>

      {/* Overlay mobile */}
      {isMobile && mobileMenuOpen && (
        <div className="mobile-overlay" onClick={toggleMobileMenu}></div>
      )}

      <style jsx="true">{`
        .footer-btn-wrapper {
          position: relative;
          width: 100%;
        }

        .language-select-btn {
          width: 100%;
        }

        .language-label {
          font-size: 12px;
          font-weight: 600;
        }

        .language-dropdown-menu {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          background: var(--bg-card, white);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          margin-bottom: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          overflow: hidden;
        }

        .language-option {
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-primary, #1e293b);
          transition: background 0.2s;
        }

        .language-option:hover {
          background: var(--bg-main, #f1f5f9);
        }

        .language-option.active {
          background: var(--primary-light, #e0f2fe);
          font-weight: 600;
        }

        .language-option span {
          font-size: 16px;
        }

        /* Styles pour le logo */
        .logo-skeleton {
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            #e2e8f0 25%,
            #f1f5f9 50%,
            #e2e8f0 75%
          );
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 50%;
        }

        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </>
  );
}

export default Sidebar;

// // frontend/src/components/layout/Sidebar.jsx
// import React, { useState, useEffect } from "react";
// import { useAuth } from "../../contexts/AuthContext";
// import { useLanguage } from "../../contexts/LanguageContext";
// import { useTheme } from "../../contexts/ThemeContext";
// import { useSettings } from "../../contexts/SettingsContext";
// import Tooltip from "../common/Tooltip";
// import { useNavigate } from "react-router-dom";
// import { hasPermission, ROUTE_PERMISSIONS } from "../../utils/permissions";

// function Sidebar({
//   collapsed,
//   setCollapsed,
//   activePage,
//   setActivePage,
//   mobileMenuOpen: mobileMenuOpenProp,
//   setMobileMenuOpen: setMobileMenuOpenProp,
// }) {
//   const { logout, user } = useAuth();
//   const { t, language, changeLanguage } = useLanguage();
//   const { theme, toggleTheme } = useTheme();
//   const { logo, companyName, loading } = useSettings();
//   const [isMobile, setIsMobile] = useState(false);
//   const [mobileMenuOpenInternal, setMobileMenuOpenInternal] = useState(false);
//   const [langDropdownOpen, setLangDropdownOpen] = useState(false);
//   const mobileMenuOpen = mobileMenuOpenProp ?? mobileMenuOpenInternal;
//   const setMobileMenuOpen = setMobileMenuOpenProp ?? setMobileMenuOpenInternal;
//   const navigate = useNavigate();

//   // Détection mobile
//   useEffect(() => {
//     const checkMobile = () => {
//       const mobile = window.innerWidth <= 768;
//       setIsMobile(mobile);
//       if (!mobile) {
//         setMobileMenuOpen(false);
//       }
//     };

//     checkMobile();
//     window.addEventListener("resize", checkMobile);
//     return () => window.removeEventListener("resize", checkMobile);
//   }, []);

//   const handleNavigation = (page) => {
//     setActivePage(page);
//     let path = `/${page}`;
//     if (page === "dashboard") path = "/";

//     navigate(path);
//     window.dispatchEvent(new CustomEvent("forceRefresh", { detail: { page } }));

//     if (isMobile) {
//       setMobileMenuOpen(false);
//     }
//   };

//   const toggleMobileMenu = () => {
//     setMobileMenuOpen(!mobileMenuOpen);
//   };

//   const handleLogout = () => {
//     logout();
//     if (isMobile) {
//       setMobileMenuOpen(false);
//     }
//   };

//   const allMenuItems = [
//     { id: "dashboard", icon: "📊", label: "dashboard" },
//     { id: "products", icon: "📦", label: "products" },
//     { id: "categories", icon: "📁", label: "categories" },
//     { id: "stock", icon: "🏪", label: "stock" },
//     { id: "invoices", icon: "📄", label: "invoices" },
//     { id: "customers", icon: "👥", label: "customers" },
//     { id: "suppliers", icon: "🏭", label: "suppliers" },
//     { id: "purchase-orders", icon: "📦", label: "purchase_orders" },
//     { id: "reservations", icon: "📅", label: "reservations" },
//     { id: "sales-dashboard", icon: "💰", label: "sales_dashboard" },
//     { id: "warehouses", icon: "🏭", label: "warehouses" },
//     { id: "reports", icon: "📈", label: "reports" },
//     { id: "users", icon: "👥", label: "users" },
//     { id: "roles", icon: "🔐", label: "roles" },
//     { id: "settings", icon: "⚙️", label: "settings" },
//   ];

//   const menuItems = allMenuItems.filter((item) => {
//     const perm = ROUTE_PERMISSIONS[item.id];
//     if (perm === null || perm === undefined) return true;
//     return hasPermission(user, perm);
//   });

//   const sidebarClasses = [
//     "sidebar",
//     collapsed && !isMobile ? "collapsed" : "",
//     isMobile ? "mobile" : "",
//     mobileMenuOpen ? "mobile-open" : "",
//   ]
//     .filter(Boolean)
//     .join(" ");

//   return (
//     <>
//       {/* Sidebar */}
//       <div className={sidebarClasses}>
//         {/* Header */}
//         <div className="sidebar-header">
//           <div className="logo">
//             <div className="logo-circle">
//               <div className="logo-circle-outer"></div>
// <div className="logo-circle-inner">
//   {loading ? (
//     <div className="logo-skeleton"></div>
//   ) : logo && logo !== "/images/logo.svg" ? (
//     <img
//       src={getLogoUrl(logo)}
//       alt={companyName}
//       className="logo-img"
//       onError={(e) => {
//         e.target.onerror = null;
//         e.target.style.display = "none";
//         // Afficher l'icône de fallback
//         const parent = e.target.parentElement;
//         if (parent) {
//           const icon = parent.querySelector(".logo-icon");
//           if (icon) icon.style.display = "flex";
//         }
//       }}
//       onLoad={(e) => {
//         // Masquer l'icône si l'image se charge correctement
//         const parent = e.target.parentElement;
//         if (parent) {
//           const icon = parent.querySelector(".logo-icon");
//           if (icon) icon.style.display = "none";
//         }
//       }}
//     />
//   ) : (
//     <span className="logo-icon" style={{ display: "flex" }}>📦</span>
//   )}
// </div>
//             </div>
//             {(!collapsed || isMobile) && (
//               <div className="logo-text">
//                 <span className="logo-name">SM</span>
//                 <span className="logo-badge">Pro</span>
//               </div>
//             )}
//           </div>
//           {!isMobile && (
//             <button
//               className="collapse-btn"
//               onClick={() => setCollapsed(!collapsed)}
//             >
//               {collapsed ? "→" : "←"}
//             </button>
//           )}
//           {isMobile && mobileMenuOpen && (
//             <button className="collapse-btn" onClick={toggleMobileMenu}>
//               ✕
//             </button>
//           )}
//         </div>

//         {/* Navigation */}
//         <div className="sidebar-nav-wrapper">
//           <nav className="sidebar-nav">
//             {menuItems.map((item) => (
//               <Tooltip
//                 key={item.id}
//                 content={collapsed && !isMobile ? t(item.label) : ""}
//                 placement="right"
//               >
//                 <button
//                   className={`nav-link ${activePage === item.id ? "active" : ""}`}
//                   onClick={() => handleNavigation(item.id)}
//                 >
//                   <span className="nav-icon">{item.icon}</span>
//                   {(!collapsed || isMobile) && (
//                     <span className="nav-label">{t(item.label)}</span>
//                   )}
//                 </button>
//               </Tooltip>
//             ))}
//           </nav>
//         </div>

//         {/* Footer */}
//         <div className="sidebar-footer">
//           <button className="footer-btn" onClick={toggleTheme}>
//             <span className="nav-icon">{theme === "light" ? "🌙" : "☀️"}</span>
//             {(!collapsed || isMobile) && (
//               <span>{theme === "light" ? t("") : t("")}</span>
//             )}
//           </button>

//           <div className="footer-btn-wrapper">
//             <button
//               className="footer-btn language-select-btn"
//               onClick={() => setLangDropdownOpen(!langDropdownOpen)}
//             >
//               <span className="nav-icon">🌐</span>
//               {(!collapsed || isMobile) && (
//                 <span className="language-label">
//                   {language === "fr" ? "FR" : language === "en" ? "EN" : "BI"}
//                 </span>
//               )}
//             </button>
//             {langDropdownOpen && (
//               <div className="language-dropdown-menu">
//                 <button
//                   className={`language-option ${language === "fr" ? "active" : ""}`}
//                   onClick={() => {
//                     changeLanguage("fr");
//                     setLangDropdownOpen(false);
//                   }}
//                 >
//                   <span>🇫🇷</span> Français
//                 </button>
//                 <button
//                   className={`language-option ${language === "en" ? "active" : ""}`}
//                   onClick={() => {
//                     changeLanguage("en");
//                     setLangDropdownOpen(false);
//                   }}
//                 >
//                   <span>🇬🇧</span> English
//                 </button>
//                 <button
//                   className={`language-option ${language === "bi" ? "active" : ""}`}
//                   onClick={() => {
//                     changeLanguage("bi");
//                     setLangDropdownOpen(false);
//                   }}
//                 >
//                   <span>🇧🇮</span> Kirundi
//                 </button>
//               </div>
//             )}
//           </div>

//           <button className="footer-btn logout" onClick={handleLogout}>
//             <span className="nav-icon">🚪</span>
//             {(!collapsed || isMobile) && <span>{/*{t("logout")}*/}</span>}
//           </button>
//         </div>
//       </div>

//       {/* Overlay mobile */}
//       {isMobile && mobileMenuOpen && (
//         <div className="mobile-overlay" onClick={toggleMobileMenu}></div>
//       )}

//       <style jsx="true">{`
//         .footer-btn-wrapper {
//           position: relative;
//           width: 100%;
//         }

//         .language-select-btn {
//           width: 100%;
//         }

//         .language-label {
//           font-size: 12px;
//           font-weight: 600;
//         }

//         .language-dropdown-menu {
//           position: absolute;
//           bottom: 100%;
//           left: 0;
//           right: 0;
//           background: var(--bg-card, white);
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 8px;
//           margin-bottom: 4px;
//           box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
//           z-index: 1000;
//           overflow: hidden;
//         }

//         .language-option {
//           width: 100%;
//           padding: 8px 12px;
//           border: none;
//           background: transparent;
//           cursor: pointer;
//           text-align: left;
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           font-size: 13px;
//           color: var(--text-primary, #1e293b);
//           transition: background 0.2s;
//         }

//         .language-option:hover {
//           background: var(--bg-main, #f1f5f9);
//         }

//         .language-option.active {
//           background: var(--primary-light, #e0f2fe);
//           font-weight: 600;
//         }

//         .language-option span {
//           font-size: 16px;
//         }
//       `}</style>
//     </>
//   );
// }

// export default Sidebar;
