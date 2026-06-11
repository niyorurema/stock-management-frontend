// frontend/src/config/api.js
/**
 * Configuration API centralisée.
 * En local : utilise le proxy CRA
 * En production (Vercel) : utilise l'URL complète du backend Render
 */

// URL de base pour l'API
const PRODUCTION_API_URL = 'https://sm-3zpe.onrender.com/api';
const DEVELOPMENT_API_URL = process.env.REACT_APP_API_BASE || 'http://localhost:8081/api';

// Détermine l'URL selon l'environnement
export const API_BASE = process.env.NODE_ENV === 'production'
  ? (process.env.REACT_APP_API_BASE || PRODUCTION_API_URL)
  : DEVELOPMENT_API_URL;

export function apiUrl(path = '') {
  if (!path) return API_BASE;
  if (path.startsWith('http')) return path;
  
  // Enlever le préfixe /api/ s'il existe pour éviter les doubles
  const clean = path.replace(/^\/?api\/?/, '').replace(/^\//, '');
  
  // Si on est en dev, on garde le chemin relatif pour le proxy
  if (process.env.NODE_ENV !== 'production' && API_BASE === '/api') {
    return `/api/${clean}`;
  }
  
  // En production, construire l'URL complète
  return `${API_BASE.replace(/\/$/, '')}/${clean}`;
}

/** URL pour fetch / axios */
export function resolveApiUrl(url) {
  if (!url) return API_BASE;
  if (url.startsWith('http')) return url;

  const clean = url.replace(/^\/?api\/?/, '').replace(/^\/+/, '');
  const base = (API_BASE || '/api').replace(/\/$/, '');

  if (base === '/api') return `/api/${clean}`;
  if (base.endsWith('/api')) return `${base}/${clean}`;

  return `${base}/api/${clean}`;
}

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\/+/, '');
  return `/${clean}`;
}



/**
 * Configuration API centralisée.
 * En dev (npm start) : le proxy CRA redirige /api → backend (port 8080).
 * En prod (build dans backend/public) : /api = même origine que CodeIgniter.
 */

/*export const API_BASE = process.env.REACT_APP_API_BASE || 'api';
export function apiUrl(path = '') {
  if (!path) return API_BASE;
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\/?api\/?/, '').replace(/^\//, '');
  return `${API_BASE.replace(/\/$/, '')}/${clean}`;
}

/** URL pour fetch / axios (toujours relative en dev avec proxy) 
export function resolveApiUrl(url) {
  if (!url) return API_BASE;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/api')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return apiUrl(url);
}

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\/+/, '');
  return `/${clean}`;
}*/
