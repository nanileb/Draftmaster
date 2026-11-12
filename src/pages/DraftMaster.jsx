import React, { useEffect, useState, useRef, useMemo } from 'react';
import { startPoolSync, refreshFriends, schedulePush } from '@/lib/poolSync';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useChampions } from '@/hooks/useChampions';
import { useGameData } from '@/lib/dataLoader';
import { enrichChampion } from '@/lib/championEngine';
import { DraftProvider } from '@/lib/DraftContext';
import BottomTabBar from '@/components/BottomTabBar';
import ScreenTransition from '@/components/ScreenTransition';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// Path depth for slide direction
const PATH_DEPTH = { '/home': 0, '/profile': 0, '/pool': 0, '/team': 0, '/champions': 0, '/home/draft': 1, '/home/matchup': 2, '/home/tips': 3, '/home/best-drafts': 1, '/home/patch': 1 };

// Root path for each tab
const TAB_ROOTS = { home: '/home', profile: '/profile', team: '/team', champions: '/champions' };

// Derive which tab is active from a pathname
function getActiveTab(pathname) {
  if (pathname.startsWith('/home')) return 'home';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/pool')) return 'profile'; // pool is nested under profile
  if (pathname.startsWith('/team')) return 'team';
  if (pathname.startsWith('/champions')) return 'champions';
  return 'home';
}

export default function DraftMaster() {
  const { champions: rawChampions, loading, error, version, reload } = useChampions();
  // Données partagées du coach (builds, counters, meta) : les profils de champions sont recalculés à leur arrivée
  const dataRev = useGameData(version);
  const champions = useMemo(() => rawChampions.map(enrichChampion), [rawChampions, dataRev]);
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);
  const [slideDir, setSlideDir] = useState('forward');
  // Remember the last visited path for each tab
  const tabStackRef = useRef({ home: '/home', profile: '/profile', team: '/team' });

  // Synchro des pools entre amis : j'envoie le mien quand il change, je relis ceux des amis au retour dans l'app
  useEffect(() => { startPoolSync(); }, []);
  useEffect(() => {
    if (!champions.length) return;
    refreshFriends(champions);
    const onVisible = () => { if (document.visibilityState === 'visible') { refreshFriends(champions); schedulePush(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [champions]);

  useEffect(() => {
    const prev = prevPathRef.current;
    const cur = location.pathname;
    const prevDepth = PATH_DEPTH[prev] ?? 0;
    const curDepth = PATH_DEPTH[cur] ?? 0;
    setSlideDir(curDepth >= prevDepth ? 'forward' : 'back');
    prevPathRef.current = cur;

    // Update stack memory for the current tab
    const tab = getActiveTab(cur);
    tabStackRef.current[tab] = cur;
  }, [location.pathname]);

  const handleTabPress = (tabKey) => {
    const currentTab = getActiveTab(location.pathname);
    if (tabKey === currentTab) {
      // Already on this tab — reset to root
      navigate(TAB_ROOTS[tabKey], { replace: true });
    } else {
      // Switch to last visited path for this tab
      navigate(tabStackRef.current[tabKey] || TAB_ROOTS[tabKey]);
    }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-background">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-grotesk font-bold text-xl">DraftMaster</p>
          <p className="text-muted-foreground text-sm mt-1">Chargement des champions...</p>
          <p className="text-muted-foreground text-xs mt-0.5 opacity-60">Data Dragon · Riot Games</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error && champions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <p className="font-grotesk font-bold text-xl">Connexion impossible</p>
          <p className="text-muted-foreground text-sm mt-1">Impossible de contacter l'API Riot Games</p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold tap-target"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </button>
      </div>
    );
  }

  const activeTab = getActiveTab(location.pathname);
  const pathDepth = PATH_DEPTH[location.pathname] ?? 0;
  const showTabBar = pathDepth === 0;
  const contentPb = showTabBar ? 'pb-[calc(64px+env(safe-area-inset-bottom,0px))]' : '';

  return (
    <DraftProvider champions={champions}>
      <div className="min-h-screen bg-background max-w-md mx-auto relative overflow-x-hidden supports-[overflow:clip]:overflow-x-clip">
        <ScreenTransition direction={slideDir} id={location.pathname}>
          <div className={contentPb}>
            <Outlet context={{ champions, version, dataRev }} />
          </div>
        </ScreenTransition>

        {showTabBar && <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />}
      </div>
    </DraftProvider>
  );
}