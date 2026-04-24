import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import JoinByInvitePage from './pages/JoinByInvitePage';
import JoinRequestsPage from './pages/JoinRequestsPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import OrganizationsPage from './pages/OrganizationsPage';
import CreateOrgPage from './pages/CreateOrgPage';
import OrganizationProfilePage from './pages/OrganizationProfilePage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import { useAuth } from './hooks/useAuth';

const PENDING_INVITE_CODE_KEY = 'pendingInviteCode';

function PendingInviteRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      return;
    }

    const pendingInviteCode = localStorage.getItem(PENDING_INVITE_CODE_KEY);
    if (!pendingInviteCode) {
      return;
    }

    const targetPath = `/join?code=${encodeURIComponent(pendingInviteCode)}`;
    const currentPath = `${location.pathname}${location.search}`;

    if (currentPath === targetPath) {
      localStorage.removeItem(PENDING_INVITE_CODE_KEY);
      return;
    }

    localStorage.removeItem(PENDING_INVITE_CODE_KEY);
    navigate(targetPath, { replace: true });
  }, [location.pathname, location.search, navigate, user]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PendingInviteRedirect />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/join" element={<JoinByInvitePage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/organizations" replace />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/organizations/create" element={<CreateOrgPage />} />
            <Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} />
            <Route path="/organizations/:organizationId/join-requests" element={<JoinRequestsPage />} />
            <Route path="/organizations/:organizationId/edit" element={<div />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
