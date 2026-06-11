import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, ROUTE_PERMISSIONS } from '../../utils/permissions';
import Loader from '../common/Loader';

export default function ProtectedRoute({ page, children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  const required = ROUTE_PERMISSIONS[page] ?? null;
  if (required !== null && required && !hasPermission(user, required)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
