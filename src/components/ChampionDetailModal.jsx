import React, { useState, useEffect } from 'react';
import { championStat, championDetails } from '@/lib/gameData';
import { loadChampionSpells } from '@/lib/dataLoader';
import { X, Loader2, Shield, Swords, Heart, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };
const SPELL_KEYS = ['P', 'Q', 'W', 'E', 'R'];
const SPELL_COLORS = { P: 'bg-secondary', Q: 'bg-blue-500/20 text-blue-300', W: 'bg-green-500/20 text-green-300', E: 'bg-purple-500/20 text-purple-300', R: 'bg-yellow-500/20 text-yellow-300' };

const TIER_STYLES = {
  'S+': 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  'S':  'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
  'A':  'bg-blue-500/20 text-blue-300 border-blue-400/40',
  'B':  'bg-green-500/20 text-green-300 border-green-400/40',
  'C':  'bg-yellow-700/20 text-yellow-500 border-yellow-600/40',
};

function getChampionByIdOrName(champions, idOrName) {
  if (!idOrName || !champions) return null;
  const normalized = idOrName.toLowerCase().replace(/[' ]/g, '');
  return champions.find(c =>
    c.id.toLowerCase() === normalized ||
    c.id.toLowerCase().replace(/[' ]/g, '') === normalized ||
    c.name.toLowerCase() === idOrName.toLowerCase()
  );
}

function MiniChamp({ idOrName, champions, label, gap }) {
  const champ = getChampionByIdOrName(champions, idOrName);
  if (!champ) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-[11px] text-muted-foreground">{idOrName?.slice(0,2)}</div>
      <span className="text-[11px] text-muted-foreground text-center leading-tight w-12 truncate">{idOrName}</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <img src={champ.iconUrl} alt={champ.name} className="w-10 h-10 rounded-lg object-cover border border-border" onError={e => { e.target.style.display='none'; }} />
      <span className="text-[11px] text-muted-foreground text-center leading-tight w-12 truncate">{champ.name}</span>
      {label && <span className="text-[11px] text-primary font-medium">{label}</span>}
      {gap && <span className="text-[11px] text-muted-foreground leading-none">{gap}</span>}
    </div>
  );
}

export default function ChampionDetailModal({ champion, role, champions, version, onClose }) {
  const [details, setDetails] = useState(null);
  const [stat, setStat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('spells');

  useEffect(() => {
    if (!champion || !role) return;
    let alive = true;
    setLoading(true);
    setActiveTab('spells');
    // Statistiques et fiche : data/builds.json et data/counters.json — plus d'appel IA
    setStat(championStat(champion.id, role));
    const d = championDetails(champion.id, role);
    setDetails({ ...d, spells: [] });
    // Sorts : Data Dragon fr_FR
    loadChampionSpells(champion.id, version)
      .then(spells => { if (alive) setDetails(prev => ({ ...(prev || d), spells })); })
      .catch(e => console.warn('Sorts indisponibles', e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [champion?.id, role]);

  const showSynergies = role === 'ADC' || role === 'SUPPORT';
  const tabs = [
    { key: 'spells', label: 'Sorts' },
    { key: 'counters', label: 'Counters' },
    ...(showSynergies ? [{ key: 'synergies', label: 'Synergies' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-lg animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card/80">
        <div className="relative shrink-0">
          <img
            src={champion.iconUrl}
            alt={champion.name}
            className="w-12 h-12 rounded-xl object-cover border border-border"
            onError={e => { e.target.style.display='none'; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-grotesk font-bold text-base truncate">{champion.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{ROLE_LABELS[role]}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {stat?.tier && (
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', TIER_STYLES[stat.tier] || TIER_STYLES['C'])}>
                Tier {stat.tier}
              </span>
            )}
            {stat?.winRate != null && (
              <span className="text-[11px] text-green-win">{stat.winRate.toFixed(1)}% WR</span>
            )}
            {stat?.pickRate != null && (
              <span className="text-[11px] text-muted-foreground">{stat.pickRate.toFixed(1)}% Pick</span>
            )}
            {stat?.games > 0 && (
              <span className="text-[11px] text-muted-foreground">{stat.games} parties</span>
            )}
            {!stat && (
              <span className="text-[11px] text-muted-foreground">Pas de statistiques à ce poste</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary shrink-0" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-40">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement des données…</p>
          </div>
        ) : (
          <>
            {/* SPELLS TAB */}
            {activeTab === 'spells' && (
              <div className="space-y-3">
                {details?.spells?.length > 0 ? (
                  details.spells.map((spell, i) => (
                    <div key={i} className="flex gap-3 items-start glass rounded-xl p-3 border border-border">
                      <div className={cn('w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-grotesk font-bold', SPELL_COLORS[SPELL_KEYS[i]] || 'bg-secondary text-foreground')}>
                        {spell.icon ? (
                          <img src={spell.icon} alt="" className="w-8 h-8 rounded-lg object-cover" onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML = SPELL_KEYS[i]; }} />
                        ) : SPELL_KEYS[i]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">{spell.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{spell.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">Sorts non disponibles.</p>
                )}

                {/* Skill Order */}
                {details?.skillOrder?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent" />
                      Ordre de montée
                    </p>
                    <div className="glass rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-1 flex-wrap">
                        {details.skillOrder.map((key, i) => (
                          <React.Fragment key={i}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] text-muted-foreground">{i + 1}</span>
                              <span className={cn('w-7 h-7 rounded-md flex items-center justify-center text-xs font-grotesk font-bold', SPELL_COLORS[key] || 'bg-secondary text-foreground')}>
                                {key}
                              </span>
                            </div>
                            {i < details.skillOrder.length - 1 && (
                              <span className="text-muted-foreground text-[11px] mb-0.5">›</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      {details.skillNote && <p className="text-xs text-muted-foreground leading-relaxed mt-2">{details.skillNote}</p>}
                    </div>
                  </div>
                )}

                {/* Combos */}
                {details?.combos?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Combos
                    </p>
                    <div className="space-y-3">
                      {details.combos.map((combo, i) => (
                        <div key={i} className="glass rounded-xl p-3 border border-border space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-grotesk font-bold text-muted-foreground w-4">{i + 1}.</span>
                            <span className="text-sm font-semibold">{combo.label}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap pl-6">
                            {combo.sequence.map((key, j) => (
                              <React.Fragment key={j}>
                                <span className={cn('px-2 py-0.5 rounded-md text-xs font-grotesk font-bold', SPELL_COLORS[key] || 'bg-secondary text-foreground')}>
                                  {key}
                                </span>
                                {j < combo.sequence.length - 1 && (
                                  <span className="text-muted-foreground text-xs">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed pl-6">{combo.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* COUNTERS TAB */}
            {activeTab === 'counters' && (
              <div className="space-y-4">
                {/* CounteredBy */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-red-lose" />
                    <p className="text-sm font-semibold">Difficile contre</p>
                  </div>
                  {details?.counteredBy?.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {details.counteredBy.map((id, i) => (
                        <MiniChamp key={i} idOrName={id} champions={champions} label={details?.counterLabels?.[id]} gap={details?.counterGaps?.[id]} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">Pas assez de parties pour ce champion à ce poste dans les statistiques du patch.</p>
                  )}
                </div>

                {/* Counters */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="w-4 h-4 text-green-win" />
                    <p className="text-sm font-semibold">Fort contre</p>
                  </div>
                  {details?.counters?.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {details.counters.map((id, i) => (
                        <MiniChamp key={i} idOrName={id} champions={champions} label={details?.counterLabels?.[id]} gap={details?.counterGaps?.[id]} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">Pas assez de parties pour ce champion à ce poste dans les statistiques du patch.</p>
                  )}
                </div>

                {/* Source des chiffres */}
                {details?.counterTips && (
                  <div className="glass rounded-xl p-3 border border-border mt-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">{details.counterTips}</p>
                  </div>
                )}
              </div>
            )}

            {/* SYNERGIES TAB */}
            {activeTab === 'synergies' && showSynergies && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">
                    {role === 'ADC' ? 'Meilleurs Supports' : 'Meilleurs ADC'}
                  </p>
                </div>
                {details?.synergies?.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {details.synergies.map((s, i) => (
                      <MiniChamp key={i} idOrName={s.championId} champions={champions} label={s.reason} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">Pas assez de parties en duo dans les statistiques du patch.</p>
                )}
                {details?.synergyTips && (
                  <div className="glass rounded-xl p-3 border border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed">{details.synergyTips}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}