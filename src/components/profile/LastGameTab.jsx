import React, { useEffect, useState, useCallback } from 'react';
import { analysedGames, loadLastGame, getAnalysis } from '@/lib/analysisStore';
import LastGameCard from '@/components/profile/LastGameCard';
import { Loader2, RefreshCw, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

// Onglet « Dernière game » : analyse détaillée de la dernière partie classée, quel que soit le poste
export default function LastGameTab({ riotId, refreshKey }) {
  const cachedLast = () => { const A = getAnalysis(); const g = analysedGames(riotId); return g.length && A.ids[0] === g[0].id ? g[0] : null; };
  const [game, setGame] = useState(cachedLast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const g = await loadLastGame(riotId);
      setGame(g);
      if (!g) setError('Aucune partie classée récente.');
    } catch (e) { setError(e.message || 'Impossible de charger la partie.'); }
    setLoading(false);
  }, [riotId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1 leading-snug">Ta dernière partie classée, analysée avec la chronologie : ce que tu as raté, ce qui a marché, et chacune de tes morts.</p>
        <button onClick={load} disabled={loading} aria-label="Recharger" className="p-2 rounded-lg bg-secondary text-muted-foreground shrink-0">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>
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
          <p className="text-sm">Aucune partie à analyser.</p>
        </div>
      )}
    </div>
  );
}
