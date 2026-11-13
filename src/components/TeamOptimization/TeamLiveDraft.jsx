import React, { useMemo, useState } from 'react';
import { X, Lock, Unlock, Ban, RefreshCw, Plus, Swords, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionPicker from '@/components/ChampionPicker';
import { ROLES, ROLE_FR, analyzeLiveDraft } from '@/lib/teamDraft';

const ROLE_ICON = { TOP: '🗡️', JUNGLE: '🌿', MID: '⚡', ADC: '🏹', SUPPORT: '💫' };
const TONE = { bad: 'text-red-lose', warn: 'text-gold', info: 'text-muted-foreground', good: 'text-green-win' };
const fr = n => String(n).replace('.', ',');

function Icon({ c, size = 'w-10 h-10', className = '', dim = false }) {
  if (!c) return <div className={cn(size, 'rounded-lg bg-secondary border border-dashed border-border shrink-0', className)} />;
  return <img src={c.iconUrl} alt={c.name} className={cn(size, 'rounded-lg border border-border shrink-0', dim && 'opacity-40 grayscale', className)} />;
}

// Suivi en direct d'une compo d'équipe pendant la sélection des champions
export default function TeamLiveDraft({ live, setLive, champions, onClose, onGame }) {
  const byId = useMemo(() => Object.fromEntries(champions.map(c => [c.id, c])), [champions]);
  const A = useMemo(() => analyzeLiveDraft(live, byId), [live, byId]);
  // picker : { kind: 'ally' | 'enemy' | 'ban', role }
  const [picker, setPicker] = useState(null);
  const [enemyMenu, setEnemyMenu] = useState(null);

  const update = (fn) => setLive(prev => { const next = { ...prev, plan: { ...prev.plan }, locked: { ...prev.locked }, enemy: { ...prev.enemy }, bans: [...prev.bans], pools: { ...prev.pools } }; fn(next); return next; });
  const taken = [...live.bans, ...ROLES.map(r => live.enemy[r]), ...ROLES.map(r => live.locked[r])].filter(Boolean);

  const lock = (r) => {
    if (live.locked[r]) return update(s => { s.locked[r] = null; });
    const row = A.rows[r], id = row.current || (row.suggestion && row.suggestion.id);
    if (!id) return setPicker({ kind: 'ally', role: r });
    update(s => { s.locked[r] = id; s.plan[r] = id; });
  };
  const toggleBan = (r) => update(s => {
    const id = s.plan[r]; if (!id) return;
    s.bans = s.bans.includes(id) ? s.bans.filter(x => x !== id) : [...s.bans, id];
  });
  const take = (r, id) => update(s => { s.plan[r] = id; });

  const onPick = (c) => {
    const p = picker; if (!p) return;
    update(s => {
      if (p.kind === 'ban') { if (!s.bans.includes(c.id)) s.bans = [...s.bans, c.id]; return; }
      if (p.kind === 'enemy') { ROLES.forEach(o => { if (s.enemy[o] === c.id) s.enemy[o] = null; }); s.enemy[p.role] = c.id; return; }
      s.plan[p.role] = c.id;
      if (!(s.pools[p.role] || []).includes(c.id)) s.pools[p.role] = [...(s.pools[p.role] || []), c.id];
    });
  };
  const moveEnemy = (from, to) => update(s => { const a = s.enemy[from]; s.enemy[from] = s.enemy[to]; s.enemy[to] = a; });

  const lockedCount = ROLES.filter(r => live.locked[r]).length;
  const enemyCount = ROLES.filter(r => live.enemy[r]).length;
  const T = A.totals;
  const pickerPool = picker && picker.kind === 'ally' ? (live.pools[picker.role] || []).map(id => ({ championId: id })) : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background max-w-md mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-lg">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-grotesk font-bold text-base truncate">Draft en direct · {live.name}</h2>
          <p className="text-xs text-muted-foreground">{lockedCount}/5 verrouillés chez nous · {enemyCount}/5 en face</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ paddingBottom: 'calc(9.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Bans */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Bans ({live.bans.length})</p>
            <button onClick={() => setPicker({ kind: 'ban' })} className="text-xs font-semibold text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/10">
              <Plus className="w-3.5 h-3.5" /> Ban
            </button>
          </div>
          {live.bans.length ? (
            <div className="flex flex-wrap gap-2">
              {live.bans.map(id => (
                <button key={id} onClick={() => update(s => { s.bans = s.bans.filter(x => x !== id); })} className="relative" aria-label={`Retirer le ban de ${byId[id]?.name || id}`}>
                  <Icon c={byId[id]} size="w-9 h-9" dim />
                  <Ban className="w-4 h-4 text-red-lose absolute -top-1 -right-1 bg-background rounded-full" />
                </button>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Ajoute les bans des deux équipes : un champion prévu qui est banni est remplacé.</p>}
        </section>

        {/* Adversaires */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Picks adverses</p>
          <div className="grid grid-cols-5 gap-2">
            {ROLES.map(r => {
              const c = byId[live.enemy[r]];
              return (
                <button key={r} onClick={() => c ? setEnemyMenu(enemyMenu === r ? null : r) : setPicker({ kind: 'enemy', role: r })}
                  className={cn('flex flex-col items-center gap-1 rounded-xl p-1.5 border transition-all', enemyMenu === r ? 'border-red-lose bg-red-lose/10' : 'border-border')}>
                  {c ? <Icon c={c} size="w-11 h-11" className="border-red-lose/60" /> : <div className="w-11 h-11 rounded-lg border border-dashed border-red-lose/40 flex items-center justify-center text-lg">{ROLE_ICON[r]}</div>}
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">{c ? c.name : ROLE_FR[r]}</span>
                </button>
              );
            })}
          </div>
          {enemyMenu && live.enemy[enemyMenu] && (
            <div className="mt-2 glass rounded-xl border border-border p-2.5 space-y-2">
              <p className="text-xs text-muted-foreground">{byId[live.enemy[enemyMenu]]?.name} joue en fait :</p>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.filter(r => r !== enemyMenu).map(r => (
                  <button key={r} onClick={() => { moveEnemy(enemyMenu, r); setEnemyMenu(null); }} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary font-semibold">{ROLE_ICON[r]} {ROLE_FR[r]}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPicker({ kind: 'enemy', role: enemyMenu }); setEnemyMenu(null); }} className="flex-1 text-xs py-1.5 rounded-lg bg-secondary font-semibold">Changer</button>
                <button onClick={() => { update(s => { s.enemy[enemyMenu] = null; }); setEnemyMenu(null); }} className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/10 text-destructive font-semibold">Retirer</button>
              </div>
            </div>
          )}
        </section>

        {/* Notre équipe */}
        <section className="space-y-2.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Notre équipe</p>
          {ROLES.map(r => {
            const row = A.rows[r];
            const shown = live.locked[r] || row.current || live.plan[r];
            const c = byId[shown];
            const isLocked = row.status === 'locked';
            const out = row.status === 'banned' || row.status === 'taken';
            const sug = row.suggestion && byId[row.suggestion.id];
            const alarm = row.alerts.some(a => a.tone === 'bad') || out;
            return (
              <div key={r} className={cn('glass rounded-2xl border p-3 space-y-2.5', isLocked ? 'border-green-win/50' : alarm ? 'border-red-lose/60' : sug ? 'border-gold/50' : 'border-border')}>
                <div className="flex items-center gap-3">
                  <Icon c={c} size="w-12 h-12" dim={out} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground">{ROLE_ICON[r]} {ROLE_FR[r]} · {live.players[r]}</p>
                    <p className={cn('font-grotesk font-bold text-sm truncate', out && 'line-through text-muted-foreground')}>{c ? c.name : 'À choisir'}</p>
                    <p className={cn('text-[11px] font-semibold', isLocked ? 'text-green-win' : out ? 'text-red-lose' : 'text-muted-foreground')}>
                      {isLocked ? 'Verrouillé' : row.status === 'banned' ? 'Banni' : row.status === 'taken' ? 'Pris en face' : 'Prévu'}
                      {row.score != null && !out ? ` · ${row.score} % est.` : ''}
                    </p>
                  </div>
                </div>

                {row.alerts.length > 0 && (
                  <ul className="space-y-1">
                    {row.alerts.map((a, i) => (
                      <li key={i} className={cn('text-xs flex gap-1.5', TONE[a.tone])}>
                        {a.tone === 'bad' || a.tone === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <span className="w-3.5 shrink-0" />}
                        <span>{a.text}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {sug && !isLocked && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-gold/10 border border-gold/40 p-2">
                    <Icon c={sug} size="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {out || !row.current ? 'Remplaçant' : 'Meilleur choix'} : {sug.name}
                        {row.suggestion.gain != null && <span className="text-green-win"> (+{fr(row.suggestion.gain)} pt)</span>}
                      </p>
                      {row.suggestion.why.length > 0 && <p className="text-[11px] text-muted-foreground leading-snug">{row.suggestion.why.join(' · ')}</p>}
                    </div>
                    <button onClick={() => take(r, sug.id)} className="text-xs font-bold px-3 py-2 rounded-lg bg-gold text-background shrink-0">Prendre</button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => lock(r)} className={cn('text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1', isLocked ? 'bg-secondary text-muted-foreground' : 'bg-green-win/15 text-green-win')}>
                    {isLocked ? <><Unlock className="w-3.5 h-3.5" /> Annuler</> : <><Lock className="w-3.5 h-3.5" /> Verrouiller</>}
                  </button>
                  <button onClick={() => toggleBan(r)} disabled={isLocked || !live.plan[r]} className={cn('text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 disabled:opacity-30', live.bans.includes(live.plan[r]) ? 'bg-red-lose text-white' : 'bg-red-lose/10 text-red-lose')}>
                    <Ban className="w-3.5 h-3.5" /> Banni
                  </button>
                  <button onClick={() => setPicker({ kind: 'ally', role: r })} disabled={isLocked} className="text-xs font-semibold py-2 rounded-lg bg-secondary flex items-center justify-center gap-1 disabled:opacity-30">
                    <RefreshCw className="w-3.5 h-3.5" /> Autre
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <button onClick={() => { if (window.confirm('Effacer les bans et les picks de cette draft ?')) update(s => { s.locked = { TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null }; s.enemy = { TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null }; s.bans = []; }); }}
          className="w-full text-xs text-muted-foreground py-2 flex items-center justify-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Recommencer la sélection
        </button>
      </div>

      {/* Barre du bas : qui mène */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-lg px-4 pt-2.5" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          {[['us', 'Nous', T.us], ['them', 'Eux', T.them]].map(([k, label, t]) => (
            <div key={k} className={cn('rounded-xl border px-3 py-1.5', k === 'us' ? 'border-primary/40' : 'border-red-lose/40')}>
              <p className="text-[11px] text-muted-foreground font-semibold">{label}</p>
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('font-grotesk font-bold text-base', T.bestDraft === k ? 'text-green-win' : 'text-foreground')}>
                  {t.score != null ? t.score : '—'}<span className="text-[10px] text-muted-foreground font-normal"> draft</span>
                </span>
                <span className={cn('font-grotesk font-bold text-base', T.bestWin === k ? 'text-green-win' : T.bestWin === 'even' ? 'text-gold' : 'text-red-lose')}>
                  {t.n ? `${t.win} %` : '—'}<span className="text-[10px] text-muted-foreground font-normal"> victoire</span>
                </span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onGame} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
          <Swords className="w-4 h-4" />
          {lockedCount === 5 ? 'Draft validée : passer en jeu' : `Passer en jeu (${lockedCount}/5 verrouillés)`}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {picker && (
        <ChampionPicker
          champions={champions}
          role={picker.role}
          lockedRole={picker.kind === 'ally'}
          excludeIds={picker.kind === 'ally' ? taken.filter(id => id !== live.locked[picker.role]) : taken}
          userPool={pickerPool}
          initialPoolOnly={picker.kind === 'ally' && pickerPool.length > 0}
          poolLabel={picker.kind === 'ally' ? `Pool de ${live.players[picker.role]}` : undefined}
          title={picker.kind === 'ban' ? 'Champion banni' : picker.kind === 'enemy' ? `Pick adverse · ${ROLE_FR[picker.role]}` : `${live.players[picker.role]} · ${ROLE_FR[picker.role]}`}
          onSelect={onPick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
