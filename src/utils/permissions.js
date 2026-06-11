/**
 * Vérifie si l'utilisateur possède une permission.
 * @param {object|null} user - { roles, permissions }
 * @param {string} permission - ex: products.view
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];

  if (roles.includes('super_admin')) return true;
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  const [module] = permission.split('.');
  if (permissions.includes(`${module}.*`)) return true;

  return false;
}

export function hasAnyPermission(user, list) {
  return list.some((p) => hasPermission(user, p));
}

export function hasRole(user, role) {
  return (user?.roles || []).includes(role);
}

/** Permission requise pour accéder à une page (route frontend). */
export const ROUTE_PERMISSIONS = {
  dashboard: null,
  products: 'products.view',
  categories: 'categories.view',
  stock: 'stock.view',
  invoices: 'invoices.view',
  customers: 'customers.view',
  suppliers: 'suppliers.view',
  'purchase-orders': 'purchase_orders.view',
  reservations: 'reservations.view',
  'sales-dashboard': 'sales_dashboard.view',
  warehouses: 'warehouses.view',
  reports: 'reports.view',
  users: 'users.view',
  roles: 'roles.view',
  settings: 'settings.view',
  profile: 'profile.view',
  notifications: 'notifications.view',
};
