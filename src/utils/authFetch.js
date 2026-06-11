/**
 * fetch() avec token JWT — même base API que apiService.
 */
import { resolveApiUrl } from '../config/api';
import { API_BASE } from '../config/api';

export function getAuthHeaders(includeJson = true) {
  const token = localStorage.getItem('auth_token');
  const headers = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }
  return headers;
}

export function normalizeApiUrl(url) {
  return resolveApiUrl(url);
}

export async function authFetch(url, options = {}) {
  const normalized = normalizeApiUrl(url);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? getAuthHeaders(false) : getAuthHeaders(true)),
    ...(options.headers || {}),
  };

  if (isFormData) {
    delete headers['Content-Type'];
  }

  let response;
  try {
    response = await fetch(normalized, {
      ...options,
      headers,
    });
  } catch (err) {
    const netErr = new Error(
      'Serveur API inaccessible. Démarrez le backend : cd backend puis php spark serve'
    );
    netErr.isNetworkError = true;
    throw netErr;
  }

  if (response.status === 401 && !normalized.includes('/auth/login')) {
    const hadToken = localStorage.getItem('auth_token');
    if (hadToken && normalized.includes('/auth/me')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }

  return response;
}

export async function authFetchJson(url, options = {}) {
  const response = await authFetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

/*export function publicAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\/+/, '');
  return `/${clean}`;
}*/

export const publicAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  const cleanPath = path.replace(/^\/+/, '');
  const baseUrl = (API_BASE || '/api')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');

  if (!baseUrl) return `/${cleanPath}`;
  return `${baseUrl}/${cleanPath}`;
};
