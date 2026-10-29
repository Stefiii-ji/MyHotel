import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout.jsx';
import ErrorPage from './pages/ErrorPage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoadingPage from './pages/LoadingPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import GroupCreatePage from './pages/GroupCreatePage.jsx';
import GroupJoinPage from './pages/GroupJoinPage.jsx';
import GroupLobbyPage from './pages/GroupLobbyPage.jsx';
import { HotelDemoProvider } from './context/HotelDemoContext.jsx';
import { RecentGroupProvider } from './context/RecentGroupContext.jsx';

const GroupSwipePage = lazy(() => import('./pages/GroupSwipePage.jsx'));
const GroupProgressPage = lazy(() => import('./pages/GroupProgressPage.jsx'));
const GroupMatchesPage = lazy(() => import('./pages/GroupMatchesPage.jsx'));
const HotelDetailPage = lazy(() => import('./pages/HotelDetailPage.jsx'));

export default function App() {
  return (
    <RecentGroupProvider>
      <HotelDemoProvider>
        <Suspense
          fallback={
            <div className="page-shell grid min-h-[50vh] place-items-center" role="status">
              <p className="text-sm text-[#77756e]">Opening group page…</p>
            </div>
          }
        >
          <Routes>
            <Route element={<SiteLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/groups/new" element={<GroupCreatePage />} />
              <Route path="/groups/:groupId" element={<GroupLobbyPage />} />
              <Route path="/groups/:groupId/swipe" element={<GroupSwipePage />} />
              <Route path="/groups/:groupId/progress" element={<GroupProgressPage />} />
              <Route path="/groups/:groupId/matches" element={<GroupMatchesPage />} />
              <Route path="/hotels/:hotelId" element={<HotelDetailPage />} />
              <Route path="/join/:token" element={<GroupJoinPage />} />
              <Route path="/loading" element={<LoadingPage />} />
              <Route path="/error" element={<ErrorPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </HotelDemoProvider>
    </RecentGroupProvider>
  );
}
