import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, X, Check, ChevronRight, Trash2, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionIcon from '@/components/ChampionIcon';
import PullToRefresh from '@/components/PullToRefresh';
import DeleteAccountModal from '@/components/DeleteAccountModal';

const MASTERIES = [
  { key: 'main', label: 'Main', color: 'bg-green-win/20 text-green-win border-green-win/40', dot: 'bg-green-win' },
  { key: 'comfortable', label: 'À l\'aise', color: 'bg-blue-info/20 text-blue-info border-blue-info/40', dot: 'bg-blue-info' },
  { key: 'beginner', label: 'Débutant', color: 'bg-gold/20 text-gold border-gold/40', dot: 'bg-gold' },
];

const ROLES = [
  { key: 'TOP', label: 'Top', icon: '🗡️' },
  { key: 'JUNGLE', label: 'Jungle', icon: '🌿' },
  { key: 'MID', label: 'Mid', icon: '⚡' },
  { key: 'ADC', label: 'ADC', icon: '🏹' },
  { key: 'SUPPORT', label: 'Support', icon: '💫' },
];

function ChampionConfigModal({ champion, entry, onSave, onRemove, onClose }) {
  const [roles, setRoles] = useState(entry?.roles || {});

  const toggleRole = (roleKey) => {
    setRoles(prev => {
      if (prev[roleKey]) {
        const next = { ...prev };
        delete next[roleKey];
        return next;
      }
      return { ...prev, [roleKey]: 'comfortable' };
    });
  };

  const setRoleMastery = (roleKey, mastery) => {
    setRoles(prev => ({ ...prev, [roleKey]: mastery }));
  };

  const handleSave = () => {
    if (Object.keys(roles).length === 0) return;
    const masteryPriority = { main: 3, comfortable: 2, beginner: 1 };
    const topMastery = Object.values(roles).sort((a, b) => masteryPriority[b] - masteryPriority[a])[0];
    onSave({ championId: champion.id, mastery: topMastery, roles });
    onClose();
  };

  const selectedRoleKeys = Object.keys(roles);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card rounded-t-2xl p-5 space-y-5 animate-slide-up" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <ChampionIcon champion={champion} size="md" />
          <div className="flex-1">
            <p className="font-grotesk font-bold text-base">{champion.name}</p>
            <p className="text-xs text-muted-foreground">{champion.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Postes joués</p>
          <div className="space-y-2">
            {ROLES.map(role => {
              const active = !!roles[role.key];
              const mastery = roles[role.key];
              return (
                <div
                  key={role.key}
                  className={cn(
                    'rounded-xl border transition-all',
                    active ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/50'
                  )}
                >
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    onClick={() => toggleRole(role.key)}
                  >
                    <span className="text-base">{role.icon}</span>
                    <span className={cn('text-sm font-medium flex-1', active ? 'text-foreground' : 'text-muted-foreground')}>
                      {role.label}
                    </span>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                      active ? 'bg-primary border-primary' : 'border-border'
                    )}>
                      {active && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </div>
                  {active && (
                    <div className="flex gap-1.5 px-3 pb-2.5 pt-0">
                      {MASTERIES.map(m => (
                        <button
                          key={m.key}
                          onClick={e => { e.stopPropagation(); setRoleMastery(role.key, m.key); }}
                          className={cn(
                            'flex-1 py-1 rounded-lg text-[11px] font-medium border transition-all',
                            mastery === m.key ? m.color : 'bg-transparent border-border text-muted-foreground'
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          {entry && (
            <button
              onClick={() => { onRemove(champion.id); onClose(); }}
              className="px-4 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium"
            >
              Retirer
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={selectedRoleKeys.length === 0}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
              selectedRoleKeys.length > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            )}
          >
            <span>{entry ? 'Mettre à jour' : 'Ajouter au pool'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PoolManager({ champions, pool, onSave, onClose, embedded = false }) {
  // Use pool prop if provided (from DraftContext), else fall back to localStorage
  const [localPool, setLocalPool] = useState(() => {
    if (pool && pool.length > 0) return pool;
    const saved = localStorage.getItem('userChampionPool');
    return saved ? JSON.parse(saved) : [];
  });

  // Keep in sync if pool prop changes (e.g. after cloud load)
  useEffect(() => {
    if (pool && pool.length > 0) setLocalPool(pool);
  }, [pool]);
  const [search, setSearch] = useState('');
  const [configChampion, setConfigChampion] = useState(null);
  const [showMyPool, setShowMyPool] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [roleFilter, setRoleFilter] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const handlePullRefresh = useCallback(async () => {
    // Pool data is local — no remote refresh needed
  }, []);

  const filtered = useMemo(() =>
    champions.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [champions, search]
  );

  const isInPool = (id) => localPool.some(p => p.championId === id);
  const getEntry = (id) => localPool.find(p => p.championId === id);

  const updatePool = (newPool) => {
    setLocalPool(newPool);
    // Enregistré dans ce navigateur (onSave → localStore.setPool). Le partage passe par le lien / QR du profil.
    onSave(newPool);
  };

  const handleConfigSave = (entry) => {
    const existing = localPool.findIndex(p => p.championId === entry.championId);
    let newPool;
    if (existing >= 0) {
      newPool = [...localPool];
      newPool[existing] = entry;
    } else {
      newPool = [...localPool, entry];
    }
    updatePool(newPool);
  };

  const handleRemove = (championId) => {
    updatePool(localPool.filter(p => p.championId !== championId));
  };

  return (
    <div className={embedded ? "flex flex-col bg-background overflow-hidden" : "fixed inset-0 z-50 flex flex-col bg-background animate-fade-in"} style={embedded ? { height: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' } : {}}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur-lg z-10">
        {!embedded && (
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary tap-target" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        )}
        <h2 className="font-grotesk font-semibold text-lg flex-1">Mon Pool</h2>
        {localPool.length > 0 && (
          <button
            onClick={() => setShowMyPool(true)}
            className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-xl border border-primary/20"
          >
            <Check className="w-3 h-3" />
            {localPool.length} champion{localPool.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-4">
        <div className="flex gap-3">
          {MASTERIES.map(m => (
            <div key={m.key} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', m.dot)} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un champion..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>



      {/* All champions grid */}
      <PullToRefresh onRefresh={handlePullRefresh} className="">
        <div className="grid grid-cols-5 gap-2 p-4 pb-8">
          {filtered.map(c => {
            const inPool = isInPool(c.id);
            const entry = getEntry(c.id);
            return (
              <div
                key={c.id}
                className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                onClick={() => setConfigChampion(c)}
              >
                <div className="relative">
                  <ChampionIcon champion={c} size="md" isPool={inPool} poolMastery={entry?.mastery} />
                  {inPool && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <span className={cn('text-xs text-center leading-tight w-14 truncate', inPool ? 'text-primary' : 'text-muted-foreground')}>
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Theme toggle + Delete account button */}
        <div className="px-4 pb-10 space-y-2">
          <button
            onClick={() => setIsDark(d => !d)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-secondary/50 text-sm font-medium transition-all"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {isDark ? 'Mode sombre' : 'Mode clair'}
            </span>
            <div className={cn('w-10 h-5 rounded-full transition-colors relative', isDark ? 'bg-primary' : 'bg-border')}>
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', isDark ? 'translate-x-5' : 'translate-x-0.5')} />
            </div>
          </button>
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive/70 text-sm hover:bg-destructive/5 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Effacer mes données locales
          </button>
        </div>
      </PullToRefresh>

      {/* My Pool drawer */}
      {showMyPool && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={() => setShowMyPool(false)}>
          <div className="w-full max-w-md bg-card rounded-t-2xl pb-8 animate-slide-up max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <p className="font-grotesk font-semibold flex-1">Mes champions ({localPool.length})</p>
              <button onClick={() => setShowMyPool(false)} className="p-2 rounded-full hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-border flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => setRoleFilter(null)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  !roleFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                )}
              >
                Tous
              </button>
              {ROLES.map(role => (
                <button
                  key={role.key}
                  onClick={() => setRoleFilter(role.key)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    roleFilter === role.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {role.icon} {role.label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1.5" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px) + 64px)' }}>
              {localPool.filter(entry => !roleFilter || entry.roles?.[roleFilter]).map(entry => {
                const champ = champions.find(c => c.id === entry.championId);
                if (!champ) return null;
                const roleEntries = Object.entries(entry.roles || {});
                return (
                  <button
                    key={entry.championId}
                    onClick={() => { setShowMyPool(false); setConfigChampion(champ); }}
                    className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 text-left hover:bg-secondary/80 transition-colors w-full"
                  >
                    <ChampionIcon champion={champ} size="xs" isPool poolMastery={entry.mastery} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold block">{champ.name}</span>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {roleEntries.map(([role, mastery]) => {
                          const r = ROLES.find(r => r.key === role);
                          const m = MASTERIES.find(m => m.key === mastery);
                          if (!r || !m) return null;
                          return (
                            <span key={role} className={cn('text-xs px-1.5 py-0.5 rounded-full border', m.color)}>
                              {r.icon} {r.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {configChampion && (
        <ChampionConfigModal
          champion={configChampion}
          entry={getEntry(configChampion.id)}
          onSave={handleConfigSave}
          onRemove={handleRemove}
          onClose={() => setConfigChampion(null)}
        />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal onClose={() => setShowDeleteAccount(false)} />
      )}
    </div>
  );
}