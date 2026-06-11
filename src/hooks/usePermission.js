import { useAuth } from '../contexts/AuthContext';
import { hasPermission, hasAnyPermission, hasRole } from '../utils/permissions';

export function usePermission() {
  const { user } = useAuth();

  return {
    user,
    can: (permission) => hasPermission(user, permission),
    canAny: (permissions) => hasAnyPermission(user, permissions),
    isRole: (role) => hasRole(user, role),
    isSuperAdmin: () => hasRole(user, 'super_admin'),
  };
}
