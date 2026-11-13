import React, { useMemo, useState } from 'react';
import { X, Swords, ArrowRight, ChevronUp, ChevronDown, AlertTriangle, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionPicker from '@/components/ChampionPicker';
import { ROLES, ROLE_FR, analyzeLiveDraft } from '@/lib/teamDraft';
import { usePcLink } from '@/lib/pcLink';

const ROLE_ICON = { TOP: '🗡️', JUNGLE: '🌿', MID: '⚡', ADC: '🏹', SUPPORT: '💫' };
const TONE = { bad: 'text-red-lose', warn: 'text-gold', info: 'text-muted-foreground', good: 'text-green-win' };
const PC_DOT = { select: ['bg-green-win animate-pulse', 'Sélection lue sur le PC'], idle: ['bg-muted-foreground', 'PC relié, en attente'], noclient: ['bg-muted-foreground', 'PC relié, League fermé'], game: ['bg-muted-foreground', 'PC relié, partie en cours'], waiting: ['bg-gold', 'PC sans nouvelles'], error: ['bg-gold', 'Relais injoignable'] };

function Icon({ c, size = 'w-10 h-10', className = '', dim = false }) {
  if (!c) return <div className={cn(size, 'rounded-lg bg-secondary border border-dashed border-border shrink-0', className)} />;
  return <img src={c.iconUrl} alt={c.name} className={cn(size, 'rounded-lg border border-border shrink-0', dim && 'opacity-40 grayscale', className)} />;
}

// Suivi en direct d'une compo d'équipe pendant la sélection : tout se remplit depuis le PC relié
// (bans, picks adverses, nos verrouillages). Tout tient sur un écran de téléphone, sans défiler.
// Sans PC, on peut encore corriger en touchant un champion (le nôtre ou l'adverse) ou la ligne des bans.
export default function TeamLiveDraft({ live, setLive, champions, onClose, onGame }) {
  const byId = useMemo(() => Object.fromEntries(champions.map(c => [c.id, c])), [champions]);
  const A = useMemo(() => analyzeLiveDraft(live, byId), [live, byId]);
  const pc = usePcLink();
  // picker : { kind: 'ally' | 'enemy' | 'ban', role }
  const [picker, setPicker] = useState(null);
  const [detail, setDetail] = useState(false);

  const update = (fn) => setLive(prev => { const next = { ...prev, plan: { ...prev.plan }, locked: { ...prev.locked }, enemy: { ...prev.enemy }, bans: [...prev.bans], pools: { ...prev.pools } }; fn(next); return next; });
  const taken = [...live.bans, ...ROLES.map(r => live.enemy[r]), ...ROLES.map(r => live.locked[r])].filter(Boolean);
  const take = (r, id) => update(s => { s.plan[r] = id; });
  const onPick = (c) => {
    const p = picker; if (!p) return;
    update(s => {
      if (p.kind === 'ban') { s.bans = s.bans.includes(c.id) ? s.bans.filter(x => x !== c.id) : [...s.bans, c.id]; return; }
      if (p.kind === 'enemy') { ROLES.forEach(o => { if (s.enemy[o] === c.id) s.enemy[o] = null; }); s.enemy[p.role] = c.id; return; }
      // Correction à la main : le champion choisi est considéré comme sélectionné
      ROLES.forEach(o => { if (o !== p.role && s.locked[o] === c.id) s.locked[o] = null; });
      s.plan[p.role] = c.id; s.locked[p.role] = c.id;
      if (!(s.pools[p.role] || []).includes(c.id)) s.pools[p.role] = [...(s.pools[p.role] || []), c.id];
    });
  };

  const lockedCount = ROLES.filter(r => live.locked[r]).length;
  const T = A.totals, PJ = A.projected, B = A.breakdown;
  const anyPick = T.us.n + T.them.n > 0;
  const pickerPool = picker && picker.kind === 'ally' ? (live.pools[picker.role] || []).map(id => ({ championId: id })) : [];
  const dot = PC_DOT[pc.status];
  const me = live.myRole;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background max-w-md mx-auto" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* En-tête compact */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
        <button onClick={onClose} className="p-1.5 -ml-1 rounded-full hover:bg-secondary" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <h2 className="flex-1 min-w-0 font-grotesk font-bold text-sm truncate">{live.name}</h2>
        {dot && (
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0" title={dot[1]}>
            <Monitor className="w-3.5 h-3.5" /><span className={cn('w-2 h-2 rounded-full', dot[0])} />{dot[1]}
          </span>
        )}
      </div>

      {/* Bans, en petit */}
      <button onClick={() => setPicker({ kind: 'ban' })} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-border text-left" aria-label="Bans">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Bans</span>
        <div className="flex gap-1 overflow-hidden">
          {live.bans.length ? live.bans.slice(0, 10).map(id => <Icon key={id} c={byId[id]} size="w-6 h-6" dim className="rounded-md" />)
            : <span className="text-[10px] text-muted-foreground">aucun pour l'instant</span>}
        </div>
      </button>

      {/* Nos champions face à leur vis-à-vis */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 [@media(max-height:620px)]:py-1 flex flex-col gap-1.5 [@media(max-height:620px)]:gap-1">
        <div className="flex items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 [@media(max-height:620px)]:hidden">
          <span className="flex-1">Nous</span><span>Eux</span>
        </div>
        {ROLES.map(r => {
          const row = A.rows[r];
          const shown = live.locked[r] || row.current || live.plan[r];
          const c = byId[shown], e = byId[live.enemy[r]];
          const isLocked = row.status === 'locked';
          const out = row.status === 'banned' || row.status === 'taken';
          const sug = !isLocked && row.suggestion && byId[row.suggestion.id];
          const alert = row.alerts.find(a => a.tone === 'bad') || row.alerts.find(a => a.tone === 'warn');
          const mine = r === me;
          return (
            <div key={r} className={cn('rounded-xl border px-2 py-1.5 [@media(max-height:620px)]:py-1 shrink-0',
              mine ? 'border-gold ring-2 ring-gold/70 bg-gold/5' : alert && !isLocked ? 'border-red-lose/50' : 'border-border bg-card/40')}>
              <div className="flex items-center gap-2">
                <button onClick={() => setPicker({ kind: 'ally', role: r })} className="relative shrink-0" aria-label={`Champion ${ROLE_FR[r]}`}>
                  <Icon c={c} size="w-10 h-10 [@media(max-height:620px)]:w-8 [@media(max-height:620px)]:h-8" dim={out} className={cn(mine && 'border-gold border-2', isLocked && !mine && 'border-green-win/70 border-2')} />
                  <span className="absolute -bottom-1 -left-1 text-[11px] leading-none">{ROLE_ICON[r]}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-grotesk font-bold text-sm truncate leading-tight', out && 'line-through text-muted-foreground')}>{c ? c.name : 'À choisir'}</p>
                  <p className="text-[10px] truncate leading-tight mt-0.5">
                    <span className={mine ? 'text-gold font-bold' : 'text-muted-foreground'}>{mine ? 'Toi' : live.players[r]}</span>
                    <span className={cn('font-semibold', isLocked ? 'text-green-win' : out ? 'text-red-lose' : 'text-muted-foreground')}> · {isLocked ? 'Verrouillé' : row.status === 'banned' ? 'Banni' : row.status === 'taken' ? 'Pris en face' : 'Prévu'}{row.score != null && !out ? ` · ${row.score} %` : ''}</span>
                  </p>
                </div>
                <button onClick={() => setPicker({ kind: 'enemy', role: r })} className="shrink-0 flex items-center gap-1.5" aria-label={`Adversaire ${ROLE_FR[r]}`}>
                  <span className="text-[10px] text-muted-foreground text-right w-14 truncate">{e ? e.name : 'pas choisi'}</span>
                  {e ? <Icon c={e} size="w-10 h-10 [@media(max-height:620px)]:w-8 [@media(max-height:620px)]:h-8" className="border-red-lose/60" /> : <div className="w-10 h-10 [@media(max-height:620px)]:w-8 [@media(max-height:620px)]:h-8 rounded-lg border border-dashed border-red-lose/40 flex items-center justify-center text-sm text-muted-foreground">?</div>}
                </button>
              </div>
              {(alert || sug) && !isLocked && (
                <div className="flex items-center gap-1.5 mt-1">
                  {alert && <AlertTriangle className={cn('w-3 h-3 shrink-0', TONE[alert.tone])} />}
                  <p className={cn('text-[10px] leading-tight flex-1 min-w-0 truncate', alert ? TONE[alert.tone] : 'text-gold')}>
                    {alert ? alert.text : `Mieux : ${sug.name}${row.suggestion.gain != null ? ` (+${String(row.suggestion.gain).replace('.', ',')} pt)` : ''}`}
                  </p>
                  {sug && (
                    <button onClick={() => take(r, sug.id)} className="shrink-0 flex items-center gap-1 rounded-lg bg-gold text-background text-[10px] font-bold pl-0.5 pr-2 py-0.5">
                      <Icon c={sug} size="w-5 h-5" className="rounded-md border-0" /> {sug.name}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barre du bas : qui mène */}
      <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur-lg px-3 pt-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {detail && (
          <div className="max-h-[45vh] overflow-y-auto mb-2.5 space-y-3 pr-1">
            {!anyPick ? <p className="text-xs text-muted-foreground">Le détail se remplit dès le premier champion verrouillé chez nous ou choisi en face.</p> : (
              <>
                {B.duels.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Duels de lane mesurés</p>
                    <ul className="space-y-1">{B.duels.map((d, i) => <li key={i} className={cn('text-xs', TONE[d.tone])}>{d.text}</li>)}</ul>
                  </div>
                )}
                {[['Nous', B.us, B.soloUs], ['Eux', B.them, B.soloThem]].map(([label, items, solo]) => (solo.length > 0 &&
                  <div key={label}>
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label} · {solo.length}/5 sélectionnés</p>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {solo.map(x => (
                        <span key={x.id} className="flex items-center gap-1 text-[11px] bg-secondary rounded-lg pr-2">
                          <Icon c={byId[x.id]} size="w-6 h-6" /> {x.est ? `${x.score} %` : 'peu de parties'}
                        </span>
                      ))}
                    </div>
                    <ul className="space-y-0.5">{items.map((it, i) => <li key={i} className={cn('text-xs', TONE[it.tone])}>{it.tone === 'good' ? '+ ' : it.tone === 'bad' ? '− ' : ''}{it.text}</li>)}</ul>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Le % à côté de chaque champion est sa victoire estimée seul à son poste (parties Challenger / GM / Master). La victoire d'équipe ajoute les duels de lane et le duo bot, bornée entre 42 et 58 %.</p>
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mb-1.5" onClick={() => setDetail(d => !d)}>
          {[['us', 'Nous', T.us], ['them', 'Eux', T.them]].map(([k, label, t]) => (
            <div key={k} className={cn('rounded-xl border px-3 py-1.5 [@media(max-height:620px)]:py-1', k === 'us' ? 'border-primary/40' : 'border-red-lose/40')}>
              <p className="text-[11px] text-muted-foreground font-semibold leading-tight">{label} · {t.n}/5</p>
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('font-grotesk font-bold text-base', T.bestDraft === k ? 'text-green-win' : 'text-foreground')}>
                  {t.score != null ? t.score : '—'}<span className="text-[10px] text-muted-foreground font-normal"> draft</span>
                </span>
                <span className={cn('font-grotesk font-bold text-base', T.bestWin === k ? 'text-green-win' : T.bestWin === 'even' ? 'text-gold' : 'text-red-lose')}>
                  {anyPick ? `${t.win} %` : '—'}<span className="text-[10px] text-muted-foreground font-normal"> victoire</span>
                </span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setDetail(d => !d)} className="w-full flex items-center justify-between gap-2 mb-2" aria-expanded={detail}>
          <span className="text-[11px] text-muted-foreground text-left truncate">
            {T.us.n < 5 && PJ.us.score != null ? <>Compo prévue finie : <span className="font-semibold text-foreground">{PJ.us.score}</span> draft · <span className="font-semibold text-foreground">{PJ.us.win} %</span></> : 'Champions sélectionnés'}
          </span>
          <span className="text-[11px] text-primary font-semibold flex items-center gap-0.5 shrink-0">Détail {detail ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}</span>
        </button>
        <button onClick={onGame} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
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
          excludeIds={picker.kind === 'ally' ? taken.filter(id => id !== live.locked[picker.role]) : picker.kind === 'ban' ? taken.filter(id => !live.bans.includes(id)) : taken}
          userPool={pickerPool}
          initialPoolOnly={picker.kind === 'ally' && pickerPool.length > 0}
          poolLabel={picker.kind === 'ally' ? `Pool de ${live.players[picker.role]}` : undefined}
          title={picker.kind === 'ban' ? 'Ajouter ou retirer un ban' : picker.kind === 'enemy' ? `Pick adverse · ${ROLE_FR[picker.role]}` : `${live.players[picker.role]} · ${ROLE_FR[picker.role]}`}
          onSelect={onPick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
