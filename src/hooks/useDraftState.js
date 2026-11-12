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

export function useDraftState(champions) {
  const [step, setStep] = useState(STEPS.ROLE);
  const [selectedRole, setSelectedRole] = useState(null);
  // allyByRole: { TOP: champion|null, ... }
  const [allyByRole, setAllyByRole] = useState({ ...EMPTY_BY_ROLE });
  // enemyByRole: { TOP: champion|null, ... }
  const [enemyByRole, setEnemyByRole] = useState({ ...EMPTY_BY_ROLE });
  const [myChampion, setMyChampion] = useState(null);
  const [userPool, setUserPool] = useState([]);
  const [poolLoaded, setPoolLoaded] = useState(false);

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
    return getRecommendations(selectedRole, champions, allyByRole, enemyByRole, userPool);
  }, [selectedRole, champions, allyByRole, enemyByRole, userPool]);

  // ── Actions ──────────────────────────────────────────────

  const selectRole = useCallback((role) => {
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

  const resetDraft = useCallback(() => {
    setAllyByRole({ ...EMPTY_BY_ROLE });
    setEnemyByRole({ ...EMPTY_BY_ROLE });
    setMyChampion(null);
    setStep(STEPS.ROLE);
    setSelectedRole(null);
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