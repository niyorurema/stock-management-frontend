import { usePermission } from '../../hooks/usePermission';

/**
 * Affiche les enfants seulement si l'utilisateur a la permission.
 * permission: string | string[] (une suffit)
 */
export default function Can({ permission, children, fallback = null }) {
  const { can, canAny } = usePermission();
  const allowed = Array.isArray(permission) ? canAny(permission) : can(permission);
  if (!allowed) return fallback;
  return children;
}
