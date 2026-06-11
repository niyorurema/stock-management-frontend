// src/components/layout/Footer.jsx
import React from "react";
import { useLanguage } from "../../contexts/LanguageContext";

function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <p>
        © {year} SM-Pro. {t("copyright")}
      </p>
    </footer>
  );
}

export default Footer;
