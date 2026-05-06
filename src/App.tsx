import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import JoinByInvitePage from './pages/JoinByInvitePage';
import JoinRequestsPage from './pages/JoinRequestsPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import OrganizationsPage from './pages/OrganizationsPage';
import CreateOrgPage from './pages/CreateOrgPage';
import OrganizationProfilePage from './pages/OrganizationProfilePage';
import OrgFundPage from './pages/OrgFundPage';
import OrgRepertoirePage from './pages/OrgRepertoirePage';
import OrgSongPage from './pages/OrgSongPage';
import OrgTasksPage from './pages/OrgTasksPage';
import OrgClosedTasksPage from './pages/OrgClosedTasksPage';
import OrgTaskPage from './pages/OrgTaskPage';
import SettingsPage from './pages/SettingsPage';
import UserProfilePage from './pages/UserProfilePage';
import { useAuth } from './hooks/useAuth';
import UserPublicProfilePage from './pages/UserPublicProfilePage';
import OrgSectionsPage from './pages/OrgSectionsPage';
import SectionProfilePage from './pages/SectionProfilePage';
import SchedulePage from './pages/SchedulePage';
import CreateEventPage from './pages/CreateEventPage';
import EventPage from './pages/EventPage';
import EventParticipantsPage from './pages/EventParticipantsPage';
import FeedbackPage from './pages/FeedbackPage';
import BirthdaysPage from './pages/BirthdaysPage';
import EventDescriptionTemplatesPage from './pages/EventDescriptionTemplatesPage';

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
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/organizations/create" element={<CreateOrgPage />} />
            <Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} />
            <Route path="/organizations/:organizationId/fund" element={<OrgFundPage />} />
            <Route path="/organizations/:organizationId/repertoire" element={<OrgRepertoirePage />} />
            <Route path="/organizations/:organizationId/repertoire/songs/:songId" element={<OrgSongPage />} />
            <Route path="/organizations/:organizationId/tasks" element={<OrgTasksPage />} />
            <Route path="/organizations/:organizationId/tasks/closed" element={<OrgClosedTasksPage />} />
            <Route path="/organizations/:organizationId/tasks/:taskId" element={<OrgTaskPage />} />
            <Route path="/organizations/:organizationId/join-requests" element={<JoinRequestsPage />} />
            <Route path="/organizations/:organizationId/edit" element={<div />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<UserProfilePage />} />
            <Route path="/users/:userId" element={<UserPublicProfilePage />} />
            <Route path="/organizations/:organizationId/sections" element={<OrgSectionsPage />} />
            <Route path="/organizations/:organizationId/sections/:sectionId" element={<SectionProfilePage />} />
            <Route path="/organizations/:organizationId/schedule" element={<SchedulePage />} />
            <Route path="/organizations/:organizationId/events/create" element={<CreateEventPage />} />
            <Route path="/organizations/:organizationId/events/:eventId" element={<EventPage />} />
            <Route path="/organizations/:organizationId/events/:eventId/participants" element={<EventParticipantsPage />} />
            <Route path="/organizations/:organizationId/feedback" element={<FeedbackPage />} />
            <Route path="/organizations/:organizationId/birthdays" element={<BirthdaysPage />} />
            <Route path="/organizations/:organizationId/sections/:sectionId/birthdays" element={<BirthdaysPage />} />
            <Route path="/organizations/:organizationId/event-templates" element={<EventDescriptionTemplatesPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
