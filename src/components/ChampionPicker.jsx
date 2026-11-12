import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionIcon from '@/components/ChampionIcon';

const ROLE_FILTERS = [
  { key: 'All', label: 'Tous', icon: '⚡' },
  { key: 'TOP', label: 'Top', icon: '🗡️' },
  { key: 'JUNGLE', label: 'Jungle', icon: '🌿' },
  { key: 'MID', label: 'Mid', icon: '🔮' },
  { key: 'ADC', label: 'ADC', icon: '🏹' },
  { key: 'SUPPORT', label: 'Support', icon: '💫' },
];

export default function ChampionPicker({
  champions,
  role,
  lockedRole = false,
  onSelect,
  onClose,
  excludeIds = [],
  userPool = [],
  title = 'Choisir un champion',
  topPickNames = [],
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(role || 'All');
  const [showPoolOnly, setShowPoolOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = champions.filter(c => {
      if (excludeIds.includes(c.id)) return false;
      // Ne filtre plus par rôle — on trie seulement les champions du rôle en premier
      if (showPoolOnly && !userPool.some(p => p.championId === c.id)) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      // Si un filtre de rôle est actif (hors "Tous"), les champions du rôle passent en premier
      const aInRole = roleFilter !== 'All' ? (a.roles?.includes(roleFilter) ? 1 : 0) : 0;
      const bInRole = roleFilter !== 'All' ? (b.roles?.includes(roleFilter) ? 1 : 0) : 0;
      if (bInRole !== aInRole) return bInRole - aInRole;

      // Ensuite trier par topPickNames
      const aIndex = topPickNames.indexOf(a.name);
      const bIndex = topPickNames.indexOf(b.name);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [champions, roleFilter, showPoolOnly, search, excludeIds, userPool, topPickNames]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-border">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-grotesk font-semibold text-lg flex-1">{title}</h2>
        {userPool.length > 0 && (
          <button
            onClick={() => setShowPoolOnly(!showPoolOnly)}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-all',
              showPoolOnly
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground'
            )}
          >
            Mon Pool
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Role filters — masqués si rôle verrouillé */}
      {!lockedRole && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-border">
          {ROLE_FILTERS.map(r => (
            <button
              key={r.key}
              onClick={() => setRoleFilter(r.key)}
              className={cn(
                'flex-shrink-0 text-base px-3 py-1.5 rounded-full transition-all',
                roleFilter === r.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {r.icon}
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      <div className="px-4 py-1.5">
        <span className="text-xs text-muted-foreground">{filtered.length} champion{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-5 gap-2 p-4 pb-safe pb-8">
          {filtered.map(c => {
            const poolEntry = userPool.find(p => p.championId === c.id);
            return (
              <div
                key={c.id}
                className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                onClick={() => { onSelect(c); onClose(); }}
                role="button"
              >
                <ChampionIcon
                  champion={c}
                  size="md"
                  isPool={!!poolEntry}
                  poolMastery={poolEntry?.mastery}
                  showName={false}
                />
                <span className="text-[9px] text-muted-foreground text-center leading-tight w-14 truncate">
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}