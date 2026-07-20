import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { user, initialized } = useAuth();

  if (!initialized) {return null;}

  return user ? <Outlet /> : <Navigate to="/auth" replace />;
}
