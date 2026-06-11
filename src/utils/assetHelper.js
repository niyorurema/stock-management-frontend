// frontend/src/utils/assetHelper.js
import { API_BASE } from '../config/api';

/**
 * Obtenir l'URL complète d'un fichier
 * @param {string} path - Chemin relatif du fichier
 * @returns {string} - URL complète
 */
export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  const cleanPath = path.replace(/^\/+/, '');
  const baseUrl = (API_BASE || '/api')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');

  if (!baseUrl) return `/${cleanPath}`;
  return `${baseUrl}/${cleanPath}`;
};

/**
 * Obtenir l'URL d'un fichier avec token d'authentification
 * @param {string} path - Chemin relatif du fichier
 * @returns {string} - URL avec token
 */
export const getAuthenticatedAssetUrl = (path) => {
  const url = getAssetUrl(path);
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
  
  return url;
};

/**
 * Vérifier si un fichier est une image
 * @param {string} filename - Nom du fichier
 * @returns {boolean}
 */
export const isImageFile = (filename) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  const ext = filename.split('.').pop()?.toLowerCase();
  return imageExtensions.includes(ext);
};

/**
 * Vérifier si un fichier est un PDF
 * @param {string} filename - Nom du fichier
 * @returns {boolean}
 */
export const isPdfFile = (filename) => {
  return filename.toLowerCase().endsWith('.pdf');
};

/**
 * Obtenir l'icône correspondant au type de fichier
 * @param {string} filename - Nom du fichier
 * @param {string} mimeType - Type MIME
 * @returns {string} - Emoji/icône
 */
export const getFileIcon = (filename, mimeType = '') => {
  if (isImageFile(filename)) return '🖼️';
  if (isPdfFile(filename)) return '📕';
  if (mimeType?.includes('word')) return '📘';
  if (mimeType?.includes('excel')) return '📗';
  if (mimeType?.includes('powerpoint')) return '📙';
  if (mimeType?.includes('zip') || mimeType?.includes('rar')) return '🗜️';
  return '📄';
};

/**
 * Formater la taille du fichier
 * @param {number} bytes - Taille en bytes
 * @returns {string} - Taille formatée
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
