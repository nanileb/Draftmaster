import { Toaster } from 'sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useOutletContext, useSearchParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';

// Pages
import DraftMaster from './pages/DraftMaster';
import RoleSelectRoute from './pages/home/RoleSelectRoute';
import DraftRoute from './pages/home/DraftRoute';
import MatchupRoute from './pages/home/MatchupRoute';
import TipsRoute from './pages/home/TipsRoute';
import BestDraftsRoute from './pages/home/BestDraftsRoute';
import PoolManager from './components/PoolManager';
import ProfilePage from './pages/ProfilePage';
import TeamOptimization from './pages/TeamOptimization';
import ChampionsOverview from './pages/ChampionsOverview';
import { useDraft } from './lib/DraftContext';

// Route wrappers — pull champions/version from parent Outlet context
function PoolRoute() {
  const { champions } = useOutletContext();
  const draft = useDraft();
  return (
    <PoolManager
      champions={champions}
      pool={draft.userPool}
      onSave={draft.savePool}
      onClose={() => {}}
      embedded
    />
  );
}

function TeamRoute() {
  const { champions, version } = useOutletContext();
  return <TeamOptimization champions={champions} version={version} embedded />;
}

function HomeIndex() {
  const { champions, version } = useOutletContext();
  const [searchParams] = useSearchParams();
  const addParam = searchParams.get('add');
  
  // Pass addParam to RoleSelectRoute if present
  return <RoleSelectRoute champions={champions} version={version} addParam={addParam} />;
}

function DraftRouteWrapper() {
  const { champions, version } = useOutletContext();
  return <DraftRoute champions={champions} version={version} />;
}


function BestDraftsWrapper() {
  const { champions, version } = useOutletContext();
  return <BestDraftsRoute champions={champions} version={version} />;
}

function ChampionsWrapper() {
  const { champions, version, dataRev } = useOutletContext();
  return <ChampionsOverview champions={champions} version={version} dataRev={dataRev} />;
}

const AppRoutes = () => {
  return (
    <Routes>
      {/* Redirect root to /home */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* DraftMaster layout shell — wraps all tabs */}
      <Route element={<DraftMaster />}>
        {/* Home / draft flow */}
        <Route path="/home" element={<HomeIndex />} />
        <Route path="/home/draft" element={<DraftRouteWrapper />} />
        <Route path="/home/matchup" element={<MatchupRoute />} />
        <Route path="/home/tips" element={<TipsRoute />} />
        <Route path="/home/best-drafts" element={<BestDraftsWrapper />} />

        {/* Champions tab */}
        <Route path="/champions" element={<ChampionsWrapper />} />

        {/* Profile tab */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Pool (accessible from profile) */}
        <Route path="/pool" element={<PoolRoute />} />

        {/* Team tab */}
        <Route path="/team" element={<TeamRoute />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppRoutes />
      </Router>
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}

export default App;