import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';



function MainLayout({ children, activePage, setActivePage, onAction }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    // <div className="app-layout">
    <div className="app-layout {`main-content ${collapsed ? 'expanded' : ''}`}">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed}
        activePage={activePage}
        setActivePage={setActivePage}
      />
      <div className="main-wrapper">
        <Header 
          activePage={activePage} 
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNavigate={setActivePage}
          onAction={onAction}
        />
        <main className="main-content">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default MainLayout;
