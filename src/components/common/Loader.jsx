// frontend/src/components/common/Loader.jsx
import React from 'react';

const Loader = ({ fullScreen = true, text = "Chargement...", transparent = true }) => {
  return (
    <div className={`loader-container ${fullScreen ? 'fullscreen' : ''} ${transparent ? 'transparent' : ''}`}>
      <div className="loader-overlay"></div>
      <div className="loader-content">
        <div className="loader-spinner"></div>
        <div className="loader-text">{text}</div>
        <div className="loader-progress">
          <div className="loader-progress-bar"></div>
        </div>
      </div>
      <style jsx="true">{`
        .loader-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        
        .loader-container.fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          min-height: 100vh;
        }
        
        .loader-container.transparent .loader-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: transparent /*rgba(255, 255, 255, 0.85);*/
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        
        .loader-content {
          position: relative;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 30px 40px;
          background: transparent /*rgba(255, 255, 255, 0.95);*/
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        
        .loader-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid #e2e8f0;
          border-top-color: #6366f1;
          border-right-color: #8b5cf6;
          border-bottom-color: #10b981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        .loader-text {
          font-size: 14px;
          color: #1e293b;
          font-weight: 500;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        .loader-progress {
          width: 200px;
          height: 3px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }
        
        .loader-progress-bar {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #10b981);
          border-radius: 3px;
          animation: progress 2s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Loader;