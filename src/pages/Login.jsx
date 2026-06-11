// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';

function Login({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Animation au chargement
    setTimeout(() => {
      setShowLeft(true);
      setShowRight(true);
    }, 100);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    onLogin(username, password);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="login-container">
      {/* Background animé */}
      <div className="login-bg"></div>

      {/* Modal Gauche - Description (coulisse de gauche) */}
      <div className={`modal-left ${showLeft ? 'slide-in-left' : ''}`}>
        <div className="modal-left-content">
          <div className="logo-section">
            <div className="logo-icon">📦</div>
            <h1>StockManager Pro</h1>
            <p>Solution intelligente de gestion</p>
          </div>

          <div className="description">
            <h2>Bienvenue sur votre plateforme</h2>
            <p>
              Gérez efficacement vos stocks, vos ventes et votre facturation électronique 
              en conformité avec les normes de l'OBR (Office Burundais des Recettes).
            </p>
          </div>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">🏪</span>
              <div>
                <h3>Gestion multi-entrepôts</h3>
                <p>Plusieurs emplacements</p>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon">📄</span>
              <div>
                <h3>Facturation électronique</h3>
                <p>Intégration EBMS OBR</p>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon">📊</span>
              <div>
                <h3>Rapports en temps réel</h3>
                <p>Analysez vos performances</p>
              </div>
            </div>
          </div>

          <div className="stats">
            <div><span>500+</span><br />Utilisateurs</div>
            <div><span>1000+</span><br />Factures/jour</div>
            <div><span>99.9%</span><br />Disponibilité</div>
          </div>
        </div>
      </div>

      {/* Modal Droite - Formulaire (coulisse de droite) */}
      <div className={`modal-right ${showRight ? 'slide-in-right' : ''}`}>
        <div className="modal-right-content">
          <div className="form-header">
            <div className="lock-icon">🔐</div>
            <h2>Connexion sécurisée</h2>
            <p>Accédez à votre espace de travail</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <span className="input-icon">📧</span>
              <input
                type="text"
                placeholder="Nom d'utilisateur ou email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-options">
              <label>
                <input type="checkbox" /> Se souvenir de moi
              </label>
              <a href="#">Mot de passe oublié ?</a>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="form-footer">
            Version 2.0 | © 2024 StockManager Pro
          </div>
        </div>
      </div>

      <style>{`
        .login-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .login-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        }

        /* Modal Gauche */
        .modal-left {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          box-shadow: 5px 0 30px rgba(0,0,0,0.3);
          transform: translateX(-100%);
          transition: transform 0.8s cubic-bezier(0.34, 1.2, 0.64, 1);
          overflow-y: auto;
          z-index: 10;
        }

        .modal-left.slide-in-left {
          transform: translateX(0);
        }

        .modal-left-content {
          padding: 50px 40px;
          color: white;
        }

        .logo-section { text-align: center; margin-bottom: 50px; }
        .logo-icon { font-size: 60px; margin-bottom: 20px; }
        .logo-section h1 { font-size: 32px; margin-bottom: 10px; background: linear-gradient(135deg, #a78bfa, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo-section p { color: rgba(255,255,255,0.5); }
        .description { margin-bottom: 40px; }
        .description h2 { font-size: 24px; margin-bottom: 15px; }
        .description p { color: rgba(255,255,255,0.7); line-height: 1.6; }
        .feature { display: flex; gap: 15px; margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; }
        .feature-icon { font-size: 28px; }
        .feature h3 { font-size: 16px; margin-bottom: 5px; }
        .feature p { font-size: 13px; color: rgba(255,255,255,0.5); }
        .stats { display: flex; justify-content: space-around; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 15px; text-align: center; }
        .stats span { font-size: 24px; font-weight: bold; color: #a78bfa; }

        /* Modal Droite */
        .modal-right {
          position: absolute;
          top: 0;
          right: 0;
          width: 50%;
          height: 100%;
          background: white;
          box-shadow: -5px 0 30px rgba(0,0,0,0.2);
          transform: translateX(100%);
          transition: transform 0.8s cubic-bezier(0.34, 1.2, 0.64, 1);
          overflow-y: auto;
          z-index: 10;
        }

        .modal-right.slide-in-right {
          transform: translateX(0);
        }

        .modal-right-content {
          padding: 80px 50px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 100%;
        }

        .form-header { text-align: center; margin-bottom: 40px; }
        .lock-icon { font-size: 55px; margin-bottom: 20px; }
        .form-header h2 { font-size: 32px; color: #1a1a2e; margin-bottom: 10px; }
        .form-header p { color: #666; }

        .input-group {
          display: flex;
          align-items: center;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          margin-bottom: 20px;
          padding: 0 15px;
        }
        .input-icon { font-size: 18px; color: #94a3b8; }
        .input-group input {
          width: 100%;
          padding: 14px 12px;
          border: none;
          outline: none;
          font-size: 15px;
          background: transparent;
        }

        .form-options {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          font-size: 13px;
        }
        .form-options a { color: #667eea; text-decoration: none; }

        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        }

        .error-message {
          background: #fee2e2;
          color: #dc2626;
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
        }

        .form-footer {
          text-align: center;
          margin-top: 40px;
          font-size: 12px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

export default Login;