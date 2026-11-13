import React, { useEffect, useState, useCallback, useRef } from 'react';
import { analysedGames, loadLastGame, getAnalysis } from '@/lib/analysisStore';
import LastGameCard from '@/components/profile/LastGameCard';
import { Loader2, RefreshCw, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updatedFr } from '@/lib/riot';

// Onglet « Dernière game » : analyse détaillée de la dernière partie classée, quel que soit le poste
export default function LastGameTab({ riotId, refreshKey }) {
  const cachedLast = () => { const A = getAnalysis(); const g = analysedGames(riotId); return g.length && A.ids[0] === g[0].id ? g[0] : null; };
  const [game, setGame] = useState(cachedLast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const sameAccount = () => { const A = getAnalysis(); return !!A.riotId && A.riotId.toLowerCase().replace(/\s/g, '') === riotId.toLowerCase().replace(/\s/g, ''); };
  const [checkedAt, setCheckedAt] = useState(() => (sameAccount() ? getAnalysis().lastChecked || getAnalysis().updated || 0 : 0));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const g = await loadLastGame(riotId);
      setGame(g);
      setCheckedAt(Date.now());
      if (!g) setError('Aucune partie classée récente.');
    } catch (e) { setError(e.message || 'Impossible de charger la partie.'); }
    setLoading(false);
  }, [riotId]);

  // Pas de chargement à l'ouverture de l'onglet : seulement sur Actualiser (ici ou à côté du pseudo)
  const firstKey = useRef(refreshKey);
  useEffect(() => { if (refreshKey !== firstKey.current) load(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1 leading-snug">Ta dernière partie classée, analysée avec la chronologie : ce que tu as raté, ce qui a marché, et chacune de tes morts.</p>
        <button onClick={load} disabled={loading} aria-label="Actualiser depuis Riot" className="p-2 rounded-lg bg-secondary text-muted-foreground shrink-0">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{loading ? 'Actualisation depuis Riot…' : checkedAt ? `Vérifiée ${updatedFr(checkedAt)}` : ''}</p>
      {loading && !game && (
        <div className="flex flex-col items-center py-14 gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Analyse de ta dernière partie…</p>
        </div>
      )}
      {error && !loading && (
        <div className="glass rounded-xl p-4 border border-destructive/30 bg-destructive/5 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {game && <LastGameCard game={game} />}
      {!game && !loading && !error && (
        <div className="flex flex-col items-center py-14 gap-3 text-center text-muted-foreground">
          <Swords className="w-10 h-10" />
          <p className="text-sm">Aucune partie chargée pour l'instant.</p>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-semibold">
            <RefreshCw className="w-4 h-4" /> Charger ma dernière partie
          </button>
        </div>
      )}
    </div>
  );
}
