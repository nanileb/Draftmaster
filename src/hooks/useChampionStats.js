import { useCallback } from 'react';
import { ROLES, championStat } from '@/lib/gameData';

// Statistiques d'un champion (remplace l'entité Base44 ChampionStats et la fonction fetchChampionStats)
export function useChampionStats() {
  const getStats = useCallback(async (championId) => ROLES.map(r => championStat(championId, r)).filter(Boolean), []);
  const getStatsForRole = useCallback(async (championId, role) => championStat(championId, role), []);
  return { getStats, getStatsForRole, loading: false };
}
