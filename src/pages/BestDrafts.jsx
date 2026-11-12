import React, { useState, useEffect, useCallback } from 'react';
import { loadBestDraftsFile } from '@/lib/dataLoader';
import { computeBestDrafts } from '@/lib/bestDraftsEngine';
import { DATA } from '@/lib/gameData';
import { X, Trophy, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import BestDraftDetail from '@/components/BestDraftDetail';
import PullToRefresh from '@/components/PullToRefresh';

function DraftCard({ draft, champions, onClick }) {
  const getChampionIcon = (name) => {
    if (!name || !champions) return null;
    return champions.find(c =>
      c.id.toLowerCase() === name.toLowerCase().replace(/[' ]/g, '') ||
      c.name.toLowerCase() === name.toLowerCase()
    );
  };

  const scoreColor = draft.draftScore >= 80 ? 'text-green-win' : draft.draftScore >= 65 ? 'text-gold' : 'text-primary';
  const winRateColor = draft.winRate >= 55 ? 'text-green-win' : draft.winRate >= 52 ? 'text-gold' : 'text-muted-foreground';

  const championsArray = Array.isArray(draft.champions) 
    ? draft.champions.map(c => c.name || c)
    : Object.values(draft.champions || {});

  return (
    <button
      onClick={onClick}
      className="w-full glass rounded-2xl border border-border p-4 text-left active:scale-[0.98] transition-all hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-grotesk font-bold text-base truncate">{draft.playstyle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">Patch {draft.patch}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={cn('rounded-full px-3 py-2 flex flex-col items-center justify-center', 
            draft.draftScore >= 80 ? 'bg-green-win/20' : draft.draftScore >= 65 ? 'bg-gold/20' : 'bg-primary/20')}>
            <span className={cn('font-grotesk font-extrabold text-sm leading-none', scoreColor)}>{draft.draftScore}</span>
            <span className="text-[9px] text-muted-foreground">score</span>
          </div>
          <div className={cn('rounded-full px-3 py-2 flex flex-col items-center justify-center',
            draft.winRate >= 55 ? 'bg-green-win/20' : draft.winRate >= 52 ? 'bg-gold/20' : 'bg-secondary/30')}>
            <span className={cn('font-grotesk font-extrabold text-sm leading-none', winRateColor)}>{draft.winRate}%</span>
            <span className="text-[9px] text-muted-foreground">victoire est.</span>
          </div>
        </div>
      </div>

      {/* Champion icons */}
      <div className="flex items-center gap-1.5 mb-3">
        {championsArray.map((name, i) => {
          const champ = getChampionIcon(name);
          return champ ? (
            <img
              key={i}
              src={champ.iconUrl}
              alt={name}
              className="w-9 h-9 rounded-lg object-cover border border-border"
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div key={i} className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground">{name?.slice(0, 2)}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-gold" />
          <span className="text-muted-foreground text-xs">{draft.winCondition}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
      </div>
    </button>
  );
}

export default function BestDrafts({ champions, version, onClose }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [info, setInfo] = useState(null);

  // 1) fichier calculé chaque jour (tools/best-drafts.mjs) ; 2) sinon calcul dans le navigateur avec les mêmes données
  const loadDrafts = useCallback(async (forceRefresh = false) => {
    if (!champions.length) return;
    setLoading(true);
    try {
      const file = forceRefresh ? null : await loadBestDraftsFile();
      const dataPatch = DATA.builds && DATA.builds.patch;
      if (file && file.drafts && file.drafts.length && (!dataPatch || file.patch === dataPatch)) {
        setDrafts(file.drafts.map(d => ({ ...d, created_date: file.generated })));
        setInfo({ generated: file.generated, source: file.source, mode: 'fichier' });
      } else if (DATA.builds) {
        await new Promise(r => setTimeout(r, 30));
        const byId = Object.fromEntries(champions.map(c => [c.id, c]));
        const now = new Date().toISOString();
        const list = computeBestDrafts(byId, 10, 30);
        setDrafts(list.map(d => ({ ...d, created_date: now })));
        setInfo({ generated: now, source: `builds.json (${DATA.builds.games} parties Challenger / GM / Master), counters.json, meta.json`, mode: 'navigateur' });
      } else {
        setDrafts([]);
        setInfo(null);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des drafts:', error);
    }
    setLoading(false);
  }, [champions]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  return (
    <div className="flex flex-col bg-background animate-fade-in" style={{ height: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-lg shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="font-grotesk font-bold text-base">Meilleures Drafts</h2>
          <p className="text-xs text-muted-foreground">Patch {version} · Meta SoloQ</p>
        </div>
      </div>

      {/* Content */}
      <PullToRefresh onRefresh={() => loadDrafts(true)} className="">
        {loading && drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-grotesk font-semibold text-base">Analyse du méta en cours</p>
              <p className="text-muted-foreground text-sm mt-1">Patch {version}…</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-5 space-y-3 pb-10">
            <p className="text-xs text-muted-foreground pb-1">
              {drafts.length} compositions{drafts[0]?.patch ? ` · stats du patch ${drafts[0].patch}` : ''} · victoire estimée face à une compo moyenne
            </p>
            {drafts[0]?.created_date && (
              <p className="text-xs text-muted-foreground/60 -mt-1 pb-1">
                Généré le {(() => {
                  const d = new Date(drafts[0].created_date);
                  const pad = n => String(n).padStart(2, '0');
                  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                })()}
              </p>
            )}
            {!loading && drafts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">Les statistiques des meilleurs joueurs ne sont pas disponibles pour l'instant (connexion ?). Tire vers le bas pour réessayer.</p>
            )}
            {info?.source && <p className="text-[10px] text-muted-foreground/60 -mt-1 pb-1">Source : {info.source}</p>}
            {drafts.map((draft, i) => (
              <DraftCard
                key={i}
                draft={draft}
                champions={champions}
                onClick={() => setSelectedDraft(draft)}
              />
            ))}
          </div>
        )}
      </PullToRefresh>

      {selectedDraft && (
        <BestDraftDetail
          draft={selectedDraft}
          champions={champions}
          onClose={() => setSelectedDraft(null)}
        />
      )}
    </div>
  );
}