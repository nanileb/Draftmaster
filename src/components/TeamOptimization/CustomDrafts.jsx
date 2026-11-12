import React, { useState, useEffect } from 'react';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeCustomDrafts } from '@/lib/bestDraftsEngine';

const ROLE_CONFIG = {
  TOP: { label: 'Top', icon: '🗡️' },
  JUNGLE: { label: 'Jungle', icon: '🌿' },
  MID: { label: 'Mid', icon: '⚡' },
  ADC: { label: 'ADC', icon: '🏹' },
  SUPPORT: { label: 'Support', icon: '💫' },
};

export default function CustomDrafts({ teamAssignment, champions, version }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedDraft, setExpandedDraft] = useState(null);

  useEffect(() => {
    if (Object.keys(teamAssignment).length < 5) { setDrafts([]); return; }
    setLoading(true);
    setError(null);
    // Calcul local (remplace la fonction Base44 generateCustomDrafts, qui appelait une IA)
    const t = setTimeout(() => {
      try {
        const byId = Object.fromEntries((champions || []).map(c => [c.id, c]));
        const res = computeCustomDrafts(teamAssignment, byId, 4);
        if (!res.length) setError('Pas de draft possible : chaque joueur doit avoir au moins un champion à son poste (et les statistiques doivent être chargées).');
        setDrafts(res);
      } catch (err) {
        setError('Erreur lors du calcul des drafts : ' + (err.message || 'erreur inconnue'));
        setDrafts([]);
      } finally {
        setLoading(false);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [teamAssignment, champions]);

  const getChampionIcon = (name) => {
    if (!name || !champions) return null;
    return champions.find(c =>
      c.id.toLowerCase() === name.toLowerCase().replace(/[' ]/g, '') ||
      c.name.toLowerCase() === name.toLowerCase()
    );
  };

  const getScoreColor = (score) => {
    if (score >= 75) {
      return 'bg-green-win/20 border-green-win text-green-win';
    } else if (score >= 50) {
      return 'bg-amber-500/20 border-amber-500 text-amber-500';
    } else {
      return 'bg-red-lose/20 border-red-lose text-red-lose';
    }
  };

  const sortedDrafts = [...drafts].sort((a, b) => (b.draftScore || 0) - (a.draftScore || 0));

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 border border-border flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Calcul des drafts personnalisées…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-4 border border-destructive/40 bg-destructive/5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (drafts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Drafts calculées avec vos pools ({drafts.length})
      </p>
      {sortedDrafts.map((draft, idx) => (
        <div key={idx} className="glass rounded-2xl border border-border overflow-hidden">
          <button
            onClick={() => setExpandedDraft(expandedDraft === idx ? null : idx)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/30 transition-all text-left"
          >
            <div className="flex flex-col items-start gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">
                  Draft {idx + 1}
                </span>
              </div>
              {(draft.draftScore || draft.score) && (
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${getScoreColor(draft.draftScore || draft.score)}`}>
                  <span className="text-xs font-bold">{Math.round((draft.draftScore || draft.score) * 10) / 10}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-grotesk font-bold text-foreground">{draft.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {Object.entries(ROLE_CONFIG).map(([roleKey]) => {
                  const champName = draft.composition?.[roleKey];
                  const champ = getChampionIcon(champName);
                  return champ?.iconUrl ? (
                    <img
                      key={roleKey}
                      src={champ.iconUrl}
                      alt={champName}
                      className="w-6 h-6 rounded border border-border/50"
                      title={champName}
                    />
                  ) : null;
                })}
              </div>
            </div>
            <div className="text-muted-foreground text-xs flex-shrink-0">
              {expandedDraft === idx ? '−' : '+'}
            </div>
          </button>

          {expandedDraft === idx && (
            <div className="px-4 py-4 border-t border-border bg-secondary/20 space-y-3">
              {/* Description */}
              {draft.description && (
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Description</p>
                  <p className="text-sm text-foreground/90">{draft.description}</p>
                </div>
              )}

              {draft.winRate != null && (
                <p className="text-xs text-muted-foreground">Victoire estimée : <span className="font-semibold text-foreground">{draft.winRate} %</span> (aide à la décision, pas une statistique officielle)</p>
              )}

              {/* Win condition */}
              {draft.winCondition && (
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Condition de victoire</p>
                  <p className="text-sm text-foreground/90">{draft.winCondition}</p>
                </div>
              )}

              {/* Composition */}
              <div>
                <p className="text-xs text-muted-foreground font-semibold mb-2">Composition</p>
                <div className="space-y-1.5">
                  {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
                    const champName = draft.composition?.[roleKey];
                    const champ = getChampionIcon(champName);

                    return (
                      <div key={roleKey} className="flex items-center gap-2.5 bg-secondary/50 rounded-lg px-2.5 py-1.5">
                        <span className="text-base w-5 text-center">{config.icon}</span>
                        <span className="text-xs text-muted-foreground w-10 shrink-0">{config.label}</span>
                        <div className="flex items-center gap-1.5 flex-1">
                          {champ?.iconUrl ? (
                            <img
                              src={champ.iconUrl}
                              alt={champName}
                              className="w-5 h-5 rounded border border-border shrink-0"
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-5 h-5 rounded bg-secondary border border-border flex items-center justify-center shrink-0 text-[7px]">
                              {champName?.slice(0, 1)}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-foreground">{champName || '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Synergies */}
              {draft.synergies?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1.5">Synergies</p>
                  <div className="flex flex-wrap gap-1">
                    {draft.synergies.map((s, i) => (
                      <span key={i} className="text-[11px] bg-primary/20 text-primary px-2 py-1 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-2 gap-2">
                {draft.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs text-green-win font-semibold mb-1">Forces</p>
                    <ul className="text-[11px] text-foreground/80 space-y-0.5">
                      {draft.strengths.map((s, i) => (
                        <li key={i} className="flex gap-1">
                          <span className="text-green-win">+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {draft.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-xs text-red-lose font-semibold mb-1">Faiblesses</p>
                    <ul className="text-[11px] text-foreground/80 space-y-0.5">
                      {draft.weaknesses.map((w, i) => (
                        <li key={i} className="flex gap-1">
                          <span className="text-red-lose">−</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}