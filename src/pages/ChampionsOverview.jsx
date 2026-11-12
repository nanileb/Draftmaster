import React, { useState, useMemo } from 'react';
import { championStat, DATA } from '@/lib/gameData';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionDetailModal from '@/components/ChampionDetailModal';

const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };
const TIERS = ['S+', 'S', 'A', 'B', 'C'];

const TIER_STYLES = {
  'S+': { border: 'border-purple-400', glow: 'shadow-purple-400/40', badge: 'bg-purple-500/20 text-purple-300', label: 'text-purple-300' },
  'S':  { border: 'border-yellow-400', glow: 'shadow-yellow-400/30', badge: 'bg-yellow-500/20 text-yellow-300', label: 'text-yellow-300' },
  'A':  { border: 'border-blue-400',   glow: 'shadow-blue-400/30',   badge: 'bg-blue-500/20 text-blue-300',   label: 'text-blue-300' },
  'B':  { border: 'border-green-400',  glow: 'shadow-green-400/30',  badge: 'bg-green-500/20 text-green-300', label: 'text-green-300' },
  'C':  { border: 'border-yellow-600', glow: 'shadow-yellow-600/20', badge: 'bg-yellow-700/20 text-yellow-500',label: 'text-yellow-500' },
};

function getChampionById(champions, id) {
  if (!id || !champions) return null;
  return champions.find(c =>
    c.id.toLowerCase() === id.toLowerCase() ||
    c.id.toLowerCase() === id.toLowerCase().replace(/[' ]/g, '')
  );
}

function TierBadge({ tier }) {
  const style = TIER_STYLES[tier] || TIER_STYLES['C'];
  return (
    <span className={cn('text-[11px] font-grotesk font-bold px-1.5 py-0.5 rounded-full border border-transparent', style.badge)}>
      {tier}
    </span>
  );
}

function ChampCard({ champ, stat, onClick }) {
  const tier = stat?.tier || 'C';
  const style = TIER_STYLES[tier] || TIER_STYLES['C'];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all active:scale-95',
        'bg-card hover:bg-card/80',
        style.border,
        `shadow-md ${style.glow}`
      )}
    >
      <div className="relative">
        <img
          src={champ.iconUrl}
          alt={champ.name}
          className="w-12 h-12 rounded-lg object-cover"
          onError={e => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="w-12 h-12 rounded-lg bg-secondary hidden items-center justify-center text-xs text-muted-foreground">
          {champ.name?.slice(0, 2)}
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5 w-full">
        <span className="text-[11px] font-medium truncate w-full text-center leading-tight">{champ.name}</span>
        <TierBadge tier={tier} />
        {stat?.winRate && (
          <span className="text-[11px] text-muted-foreground">{stat.winRate.toFixed(1)}%</span>
        )}
      </div>
    </button>
  );
}

export default function ChampionsOverview({ champions, version, dataRev }) {
  const [activeRole, setActiveRole] = useState('TOP');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState(null);
  const [selectedChampion, setSelectedChampion] = useState(null); // { champion, role }
  const loadingStats = false;

  // Statistiques réelles : data/builds.json (Challenger / GM / Master). Pas de données = « Autres ».
  const statsMap = useMemo(() => {
    const map = {};
    champions.forEach(c => ROLES.forEach(r => { const s = championStat(c.id, r); if (s) map[`${c.id}_${r}`] = s; }));
    return map;
  }, [champions, dataRev]);
  const sourceNote = DATA.builds
    ? `Tiers et taux de victoire : parties Challenger / GM / Master (patch ${DATA.builds.patch || '?'}, ${DATA.builds.games || '?'} parties), lissés vers 50 % quand l'échantillon est petit. Supports : tier calculé sur les parties dès 200 parties, sinon tier de la méta du coach.`
    : 'Statistiques indisponibles : aucun tier affiché.';

  // Build champion list for current role — ALL champions, stats optional
  const championsForRole = useMemo(() => {
    const result = [];
    champions.forEach(champ => {
      const stat = statsMap[`${champ.id}_${activeRole}`] || null;
      if (search && !champ.name.toLowerCase().includes(search.toLowerCase())) return;
      if (tierFilter && stat?.tier !== tierFilter) return;
      result.push({ champ, stat });
    });
    // Sort: champions with stats first (by tier then WR), then alphabetical
    result.sort((a, b) => {
      if (a.stat && b.stat) {
        const tierOrder = TIERS.indexOf(a.stat.tier) - TIERS.indexOf(b.stat.tier);
        if (tierOrder !== 0) return tierOrder;
        return (b.stat.winRate || 0) - (a.stat.winRate || 0);
      }
      if (a.stat && !b.stat) return -1;
      if (!a.stat && b.stat) return 1;
      return a.champ.name.localeCompare(b.champ.name);
    });
    return result;
  }, [champions, statsMap, activeRole, search, tierFilter]);

  return (
    <div className="flex flex-col bg-background" style={{ minHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border px-4 pt-4 pb-2">
        <h1 className="font-grotesk font-bold text-xl mb-3">Champions</h1>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un champion…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-secondary border border-border text-sm outline-none focus:border-primary transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Role tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 pr-6 fade-right">
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={cn(
                'px-3 py-2.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                activeRole === role
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              )}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        {/* Tier filters */}
        <div className="flex gap-1.5 mt-2 pb-1">
          <button
            onClick={() => setTierFilter(null)}
            className={cn(
              'px-3 py-2.5 rounded-full text-xs font-medium transition-colors',
              !tierFilter ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'
            )}
          >
            Tous
          </button>
          {TIERS.map(t => {
            const style = TIER_STYLES[t];
            return (
              <button
                key={t}
                onClick={() => setTierFilter(tierFilter === t ? null : t)}
                className={cn(
                  'px-3 py-2.5 rounded-full text-xs font-bold transition-colors border',
                  tierFilter === t ? `${style.badge} ${style.border}` : 'bg-secondary text-muted-foreground border-transparent'
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        <p className="text-[11px] text-muted-foreground mb-3 leading-snug">{sourceNote}</p>
        {loadingStats ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement des statistiques…</p>
          </div>
        ) : championsForRole.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-muted-foreground text-sm">Aucun champion trouvé.</p>
          </div>
        ) : (
          <>
            {/* Champions with stats, grouped by tier */}
            {TIERS.map(tier => {
              const tierChamps = championsForRole.filter(({ stat }) => stat?.tier === tier);
              if (tierChamps.length === 0) return null;
              const style = TIER_STYLES[tier];
              return (
                <div key={tier} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('font-grotesk font-bold text-sm', style.label)}>Tier {tier}</span>
                    <span className="text-xs text-muted-foreground">({tierChamps.length})</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {tierChamps.map(({ champ, stat }) => (
                      <ChampCard
                        key={champ.id}
                        champ={champ}
                        stat={stat}
                        onClick={() => setSelectedChampion({ champion: champ, role: activeRole })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Champions without stats */}
            {(() => {
              const noStats = championsForRole.filter(({ stat }) => !stat);
              if (noStats.length === 0) return null;
              return (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-grotesk font-bold text-sm text-muted-foreground">Autres</span>
                    <span className="text-xs text-muted-foreground">({noStats.length})</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {noStats.map(({ champ }) => (
                      <ChampCard
                        key={champ.id}
                        champ={champ}
                        stat={null}
                        onClick={() => setSelectedChampion({ champion: champ, role: activeRole })}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedChampion && (
        <ChampionDetailModal
          champion={selectedChampion.champion}
          role={selectedChampion.role}
          champions={champions}
          version={version}
          onClose={() => setSelectedChampion(null)}
        />
      )}
    </div>
  );
}