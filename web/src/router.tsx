import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration, useNavigate } from 'react-router';
import { RequireAuth, RequireStaff, RootError, RouteError } from './components/guards';
import { AppShell } from './components/layout/AppShell';
import { PageSpinner } from './components/ui/Spinner';
import { setNavigator } from './lib/navigation';
import { AuthLayout } from './pages/auth/AuthLayout';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { CommunityPage } from './pages/CommunityPage';
import { FollowingPage, HomePage, SavedPage, UnansweredPage } from './pages/FeedPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PostPage } from './pages/PostPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { TagPage } from './pages/TagPage';

const SubmitPage = lazy(() => import('./pages/SubmitPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DraftsPage = lazy(() => import('./pages/DraftsPage'));
const ModPage = lazy(() => import('./pages/mod/ModPage'));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

function RootLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator((to) => navigate(to));
  }, [navigate]);
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          {
            errorElement: <RouteError />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'following', element: <RequireAuth><FollowingPage /></RequireAuth> },
              { path: 'unanswered', element: <UnansweredPage /> },
              { path: 'saved', element: <RequireAuth><SavedPage /></RequireAuth> },
              { path: 'c', element: <CommunitiesPage /> },
              { path: 'c/:slug', element: <CommunityPage /> },
              { path: 't/:slug', element: <TagPage /> },
              { path: 'p/:id/:slug?', element: <PostPage /> },
              { path: 'submit', element: <RequireAuth><Lazy><SubmitPage /></Lazy></RequireAuth> },
              { path: 'drafts', element: <RequireAuth><Lazy><DraftsPage /></Lazy></RequireAuth> },
              { path: 'u/:username', element: <ProfilePage /> },
              { path: 'search', element: <SearchPage /> },
              { path: 'notifications', element: <RequireAuth><NotificationsPage /></RequireAuth> },
              { path: 'messages', element: <RequireAuth><Lazy><MessagesPage /></Lazy></RequireAuth> },
              { path: 'messages/:id', element: <RequireAuth><Lazy><MessagesPage /></Lazy></RequireAuth> },
              { path: 'settings', element: <RequireAuth><Lazy><SettingsPage /></Lazy></RequireAuth> },
              { path: 'mod/*', element: <RequireStaff><Lazy><ModPage /></Lazy></RequireStaff> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
