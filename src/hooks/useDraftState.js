import { useState, useCallback, useMemo, useEffect } from 'react';
import { getPool, setPool } from '@/lib/localStore';
import {
  calculateDraftScore,
  calculateWinProbability,
  detectSynergies,
  getRecommendations,
  getWinCondition,
  getDraftScoreLabel,
} from '../lib/championEngine';

export const STEPS = {
  ROLE: 'role',
  DRAFT: 'draft',
  MATCHUP: 'matchup',
  TIPS: 'tips',
};

const EMPTY_BY_ROLE = { TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null };
const ROLE_KEYS = Object.keys(EMPTY_BY_ROLE);

// Partie en cours gardée dans le navigateur : un rechargement (écran verrouillé, onglet purgé par iOS) ne perd ni la draft ni le chrono
const GAME_KEY = 'dm_game';
const readGame = () => { try { return JSON.parse(localStorage.getItem(GAME_KEY) || 'null'); } catch (e) { return null; } };
const writeGame = (o) => { try { if (o) localStorage.setItem(GAME_KEY, JSON.stringify(o)); else localStorage.removeItem(GAME_KEY); } catch (e) { /* stockage indisponible */ } };
const idsOf = (byRole) => Object.fromEntries(ROLE_KEYS.map(r => [r, byRole[r] ? byRole[r].id : null]));
const EMPTY_KILLS = { drakes: [], soul: null };

// Lit la partie gardée (null si absente, ancienne de plus de 3 h, ou champions pas encore chargés)
function restoreGame(champions) {
  if (!champions || !champions.length) return null;
  const g = readGame(); if (!g || !g.role) return null;
  if (g.savedAt && Date.now() - g.savedAt > 3 * 3600 * 1000) { writeGame(null); return null; }
  const byId = Object.fromEntries(champions.map(c => [c.id, c]));
  const back = (o) => Object.fromEntries(ROLE_KEYS.map(r => [r, (o && o[r] && byId[o[r]]) || null]));
  return {
    role: g.role, ally: back(g.ally), enemy: back(g.enemy), me: (g.me && byId[g.me]) || null,
    side: g.side === 'red' ? 'red' : 'blue', timerStart: g.timerStart || null, kills: g.kills || EMPTY_KILLS,
    bans: (g.bans || []).filter(id => byId[id]),
  };
}

export function useDraftState(champions) {
  // Reprise synchrone : un rechargement sur /home/tips retrouve tout de suite la partie
  const [init] = useState(() => restoreGame(champions));
  const [step, setStep] = useState(STEPS.ROLE);
  const [selectedRole, setSelectedRole] = useState(init ? init.role : null);
  // allyByRole: { TOP: champion|null, ... }
  const [allyByRole, setAllyByRole] = useState(init ? init.ally : { ...EMPTY_BY_ROLE });
  // enemyByRole: { TOP: champion|null, ... }
  const [enemyByRole, setEnemyByRole] = useState(init ? init.enemy : { ...EMPTY_BY_ROLE });
  const [myChampion, setMyChampion] = useState(init ? init.me : null);
  // Bans des deux équipes (ids), lus sur le PC relié ou ajoutés à la main
  const [bans, setBans] = useState(init ? init.bans : []);
  const [userPool, setUserPool] = useState([]);
  const [poolLoaded, setPoolLoaded] = useState(false);
  // En jeu : côté de la carte, début du chrono (horodatage) et objectifs tués
  const [side, setSide] = useState(init ? init.side : 'blue');
  const [timerStart, setTimerStart] = useState(init ? init.timerStart : null);
  const [kills, setKills] = useState(init ? init.kills : EMPTY_KILLS);
  const [restored, setRestored] = useState(!!(champions && champions.length));

  // Champions arrivés après le montage : reprise à ce moment-là
  useEffect(() => {
    if (restored || !champions.length) return;
    setRestored(true);
    const g = restoreGame(champions); if (!g) return;
    setSelectedRole(g.role); setAllyByRole(g.ally); setEnemyByRole(g.enemy); setMyChampion(g.me);
    setSide(g.side); setTimerStart(g.timerStart); setKills(g.kills); setBans(g.bans);
  }, [champions, restored]);
  useEffect(() => {
    if (!restored) return;
    if (!selectedRole) { writeGame(null); return; }
    writeGame({ role: selectedRole, ally: idsOf(allyByRole), enemy: idsOf(enemyByRole), me: myChampion ? myChampion.id : null, side, timerStart, kills, bans, savedAt: Date.now() });
  }, [restored, selectedRole, allyByRole, enemyByRole, myChampion, side, timerStart, kills, bans]);

  // Pool : gardé dans ce navigateur (plus de compte Base44)
  useEffect(() => {
    setUserPool(getPool());
    setPoolLoaded(true);
    const onUpd = () => setUserPool(getPool());
    window.addEventListener('pool-updated', onUpd);
    return () => window.removeEventListener('pool-updated', onUpd);
  }, []);

  // Flat arrays derived from role maps
  const allyTeam = useMemo(() =>
    Object.values(allyByRole).filter(Boolean),
    [allyByRole]
  );

  const enemyTeam = useMemo(() =>
    Object.values(enemyByRole).filter(Boolean),
    [enemyByRole]
  );

  // Draft analytics
  const draftScore = useMemo(() => calculateDraftScore(allyTeam, enemyTeam, allyByRole, enemyByRole), [allyTeam, enemyTeam, allyByRole, enemyByRole, champions]);
  const winProbability = useMemo(() => calculateWinProbability(allyByRole, enemyByRole), [allyByRole, enemyByRole, champions]);
  const allySynergies = useMemo(() => detectSynergies(allyTeam), [allyTeam]);
  const winCondition = useMemo(() => getWinCondition(allySynergies), [allySynergies]);
  const scoreInfo = useMemo(() => getDraftScoreLabel(draftScore), [draftScore]);

  const recommendations = useMemo(() => {
    if (!selectedRole || champions.length === 0) return { best: null, alternatives: [], risky: [] };
    return getRecommendations(selectedRole, champions, allyByRole, enemyByRole, userPool, bans);
  }, [selectedRole, champions, allyByRole, enemyByRole, userPool, bans]);

  // ── Actions ──────────────────────────────────────────────

  // Nouveau poste depuis l'accueil = nouvelle partie (l'ancienne draft gardée est oubliée)
  const selectRole = useCallback((role) => {
    setAllyByRole({ ...EMPTY_BY_ROLE });
    setEnemyByRole({ ...EMPTY_BY_ROLE });
    setMyChampion(null);
    setBans([]);
    setSide('blue');
    setTimerStart(null);
    setKills(EMPTY_KILLS);
    setSelectedRole(role);
    setStep(STEPS.DRAFT);
  }, []);

  const setAllyRole = useCallback((role, champion) => {
    // Prevent duplicate across all roles
    setAllyByRole(prev => {
      const next = { ...prev };
      // Remove this champion from any other slot
      Object.keys(next).forEach(r => {
        if (next[r]?.id === champion.id) next[r] = null;
      });
      next[role] = champion;
      return next;
    });
  }, []);

  const removeAllyRole = useCallback((role) => {
    setAllyByRole(prev => {
      const next = { ...prev, [role]: null };
      return next;
    });
    // If removing my champion's role
    setAllyByRole(prev => {
      if (prev[role]?.id === myChampion?.id) setMyChampion(null);
      return prev;
    });
  }, [myChampion]);

  const setEnemyRole = useCallback((role, champion) => {
    setEnemyByRole(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(r => {
        if (next[r]?.id === champion.id) next[r] = null;
      });
      next[role] = champion;
      return next;
    });
  }, []);

  const removeEnemyRole = useCallback((role) => {
    setEnemyByRole(prev => ({ ...prev, [role]: null }));
  }, []);

  // Revalidation des postes alliés : si mon champion change de poste, mon poste suit
  const swapAllyRoles = useCallback((roleA, roleB) => {
    setAllyByRole(prev => ({ ...prev, [roleA]: prev[roleB] || null, [roleB]: prev[roleA] || null }));
    setSelectedRole(cur => (cur === roleA ? roleB : cur === roleB ? roleA : cur));
  }, []);

  // Partie en cours chargée depuis le relais Riot (src/lib/liveGame.js)
  const loadLiveGame = useCallback((g) => {
    setSelectedRole(g.role);
    setAllyByRole({ ...EMPTY_BY_ROLE, ...g.allyByRole });
    setEnemyByRole({ ...EMPTY_BY_ROLE, ...g.enemyByRole });
    setMyChampion(g.me || null);
    setSide(g.side || 'blue');
    setKills(EMPTY_KILLS);
    setTimerStart(g.elapsed > 0 ? Date.now() - g.elapsed * 1000 : null);
    setStep(STEPS.MATCHUP);
  }, []);

  // PC relié (src/lib/pcLink.js) : sélection lue dans le client League. fresh = nouvelle sélection (on repart de zéro),
  // sinon on complète sans défaire les corrections faites à la main (un champion déjà placé n'est pas déplacé).
  // roleHint : poste à prendre si le client n'en donne pas (partie personnalisée, normale à l'aveugle)
  const syncFromPc = useCallback((sel, fresh, roleHint = null) => {
    const byId = Object.fromEntries((champions || []).map(c => [c.id, c]));
    const role = sel.myRole || roleHint || (fresh ? null : selectedRole);
    if (fresh) { setSide(sel.side || 'blue'); setTimerStart(null); setKills(EMPTY_KILLS); setStep(STEPS.DRAFT); }
    // Bans : ceux du client, plus ceux ajoutés à la main (sauf nouvelle sélection)
    const pcBans = (sel.bans || []).filter(id => byId[id]);
    setBans(prev => (fresh ? pcBans : [...new Set([...prev, ...pcBans])]));
    if (role !== selectedRole) setSelectedRole(role);
    const likely = (c) => [...(c.dataRoles || []), ...(c.roles || [])];
    setAllyByRole(prev => {
      const next = fresh ? { ...EMPTY_BY_ROLE } : { ...prev };
      const has = id => ROLE_KEYS.some(r => next[r] && next[r].id === id);
      // Les postes donnés par le client d'abord, puis les autres sur un poste libre plausible
      [...sel.mine].sort((a, b) => (b.pos ? 1 : 0) - (a.pos ? 1 : 0)).forEach(m => {
        const c = m.lock && byId[m.id]; if (!c || has(c.id)) return;
        const r = m.me && role ? role : m.pos && !next[m.pos] && m.pos !== (m.me ? null : role) ? m.pos
          : likely(c).find(x => ROLE_KEYS.includes(x) && !next[x] && x !== role) || ROLE_KEYS.find(x => !next[x] && x !== role);
        if (r) next[r] = c;
      });
      return next;
    });
    setEnemyByRole(prev => {
      const next = fresh ? { ...EMPTY_BY_ROLE } : { ...prev };
      sel.enemy.forEach(m => {
        const c = byId[m.id]; if (!c || ROLE_KEYS.some(r => next[r] && next[r].id === c.id)) return;
        const r = (m.pos && !next[m.pos] ? m.pos : null) || likely(c).find(x => ROLE_KEYS.includes(x) && !next[x]) || ROLE_KEYS.find(x => !next[x]);
        if (r) next[r] = c;
      });
      return next;
    });
    const me = sel.me && byId[sel.me];
    if (me) setMyChampion(me); else if (fresh) setMyChampion(null);
  }, [champions, selectedRole]);

  const swapEnemyRoles = useCallback((roleA, roleB) => {
    setEnemyByRole(prev => ({
      ...prev,
      [roleA]: prev[roleB] || null,
      [roleB]: prev[roleA] || null,
    }));
  }, []);

  const setMyPick = useCallback((champion) => {
    setMyChampion(champion);
    if (selectedRole) {
      setAllyRole(selectedRole, champion);
    }
  }, [selectedRole, setAllyRole]);

  // Legacy helpers for components that still use flat arrays
  const addToAlly = useCallback((champion) => {
    // Find first empty non-my role
    const roles = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    setAllyByRole(prev => {
      if (Object.values(prev).some(c => c?.id === champion.id)) return prev;
      const emptyRole = roles.find(r => r !== selectedRole && !prev[r]);
      if (!emptyRole) return prev;
      return { ...prev, [emptyRole]: champion };
    });
  }, [selectedRole]);

  const removeFromAlly = useCallback((championId) => {
    setAllyByRole(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(r => { if (next[r]?.id === championId) next[r] = null; });
      return next;
    });
    if (myChampion?.id === championId) setMyChampion(null);
  }, [myChampion]);

  const addToEnemy = useCallback((champion) => {
    const roles = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    setEnemyByRole(prev => {
      if (Object.values(prev).some(c => c?.id === champion.id)) return prev;
      // Poste le plus probable d'après les parties des meilleurs joueurs (puis les tags), sinon le premier libre
      const likely = [...(champion.dataRoles || []), ...(champion.roles || [])];
      const emptyRole = likely.find(r => roles.includes(r) && !prev[r]) || roles.find(r => !prev[r]);
      if (!emptyRole) return prev;
      return { ...prev, [emptyRole]: champion };
    });
  }, []);

  const removeFromEnemy = useCallback((championId) => {
    setEnemyByRole(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(r => { if (next[r]?.id === championId) next[r] = null; });
      return next;
    });
  }, []);

  const goToMatchup = useCallback(() => setStep(STEPS.MATCHUP), []);
  const goToTips = useCallback(() => setStep(STEPS.TIPS), []);

  const addBan = useCallback((champion) => {
    if (champion) setBans(prev => (prev.includes(champion.id) ? prev : [...prev, champion.id]));
  }, []);
  const removeBan = useCallback((id) => setBans(prev => prev.filter(x => x !== id)), []);

  const resetDraft = useCallback(() => {
    setBans([]);
    setAllyByRole({ ...EMPTY_BY_ROLE });
    setEnemyByRole({ ...EMPTY_BY_ROLE });
    setMyChampion(null);
    setStep(STEPS.ROLE);
    setSelectedRole(null);
    setSide('blue');
    setTimerStart(null);
    setKills(EMPTY_KILLS);
  }, []);

  const savePool = useCallback((pool) => {
    setUserPool(pool);
    setPool(pool);
  }, []);

  const canGoToMatchup = myChampion && allyTeam.length >= 1;

  return {
    step,
    setStep,
    selectedRole,
    allyTeam,
    enemyTeam,
    allyByRole,
    enemyByRole,
    myChampion,
    userPool,
    draftScore,
    winProbability,
    allySynergies,
    winCondition,
    scoreInfo,
    recommendations,
    selectRole,
    setAllyRole,
    removeAllyRole,
    setEnemyRole,
    removeEnemyRole,
    swapEnemyRoles,
    swapAllyRoles,
    loadLiveGame,
    syncFromPc,
    bans,
    addBan,
    removeBan,
    side,
    setSide,
    timerStart,
    setTimerStart,
    kills,
    setKills,
    addToAlly,
    addToEnemy,
    removeFromAlly,
    removeFromEnemy,
    setMyPick,
    goToMatchup,
    goToTips,
    resetDraft,
    savePool,
    canGoToMatchup,
    // legacy
    canGoToTips: myChampion && allyTeam.length >= 1,
  };
}