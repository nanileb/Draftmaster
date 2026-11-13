import React, { useMemo } from 'react';
import { ArrowLeft, Trophy, Map, Trees, Clock, Swords, Split, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_FR, teamGamePlan } from '@/lib/teamDraft';

const SIDE = {
  us: { label: 'Avantage nous', cls: 'bg-green-win/15 text-green-win border-green-win/40' },
  them: { label: 'Avantage eux', cls: 'bg-red-lose/15 text-red-lose border-red-lose/40' },
  even: { label: 'Équilibré', cls: 'bg-gold/15 text-gold border-gold/40' },
  unknown: { label: 'À compléter', cls: 'bg-secondary text-muted-foreground border-border' },
};
const TONE = { bad: 'text-red-lose', warn: 'text-gold', info: 'text-foreground/85', good: 'text-green-win' };
const DOT = { bad: 'bg-red-lose', warn: 'bg-gold', info: 'bg-muted-foreground', good: 'bg-green-win' };

function Card({ icon: I, title, children, className }) {
  return (
    <section className={cn('glass rounded-2xl border border-border p-4 space-y-3', className)}>
      <h3 className="font-grotesk font-bold text-sm flex items-center gap-2"><I className="w-4 h-4 text-primary" />{title}</h3>
      {children}
    </section>
  );
}
const Img = ({ c, size = 'w-8 h-8' }) => c ? <img src={c.iconUrl} alt={c.name} className={cn(size, 'rounded-lg border border-border shrink-0')} /> : <div className={cn(size, 'rounded-lg bg-secondary shrink-0')} />;

// Plan de jeu d'équipe une fois la draft validée : lanes, jungle, timings, rôles en combat, split push, win condition
export default function TeamGamePlan({ live, ours, champions, onBack }) {
  const byId = useMemo(() => Object.fromEntries(champions.map(c => [c.id, c])), [champions]);
  const plan = useMemo(() => teamGamePlan(ours, live.enemy, live.players, byId), [ours, live, byId]);
  const missing = ROLES.filter(r => !live.enemy[r]).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background max-w-md mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-lg">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target" aria-label="Retour à la draft">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-grotesk font-bold text-base">Plan de jeu d'équipe</h2>
          <p className="text-xs text-muted-foreground truncate">{live.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Les deux compos */}
        <div className="glass rounded-2xl border border-border p-3 space-y-2">
          {[['Nous', ours, 'text-primary'], ['Eux', live.enemy, 'text-red-lose']].map(([label, team, cls]) => (
            <div key={label} className="flex items-center gap-2">
              <span className={cn('text-xs font-bold w-9', cls)}>{label}</span>
              <div className="flex gap-1.5">{ROLES.map(r => <Img key={r} c={byId[team[r]]} />)}</div>
            </div>
          ))}
          {missing > 0 && <p className="text-[11px] text-gold">{missing} pick{missing > 1 ? 's' : ''} adverse{missing > 1 ? 's' : ''} manquant{missing > 1 ? 's' : ''} : retourne à la draft pour un plan complet.</p>}
        </div>

        {/* Win condition */}
        <Card icon={Trophy} title="Comment on gagne" className="border-primary/40">
          <p className="text-sm text-foreground leading-relaxed">{plan.winCondition.us}</p>
          {plan.winCondition.them && <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-semibold text-red-lose">À casser : </span>{plan.winCondition.them}</p>}
        </Card>

        {/* Teamfight ou split push */}
        <Card icon={plan.strategy.kind === 'split' ? Split : Swords} title={plan.strategy.title}>
          <p className="text-sm text-foreground/90 leading-relaxed">{plan.strategy.text}</p>
        </Card>

        {/* Lanes */}
        <Card icon={Map} title="Qui gagne quelle lane, et quand">
          <div className="space-y-3">
            {plan.lanes.map(l => (
              <div key={l.role} className="rounded-xl bg-secondary/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-9">{l.role === 'BOT' ? 'Bot' : ROLE_FR[l.role]}</span>
                  <Img c={byId[l.ally]} size="w-7 h-7" />
                  <span className="text-[11px] text-muted-foreground">vs</span>
                  <Img c={byId[l.enemy]} size="w-7 h-7" />
                  <span className={cn('ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border', SIDE[l.side].cls)}>{SIDE[l.side].label}</span>
                </div>
                {l.reason && <p className="text-[11px] text-muted-foreground">{l.reason}</p>}
                {l.phases && (
                  <div className="flex gap-1.5">
                    {l.phases.map(p => <span key={p.label} className={cn('flex-1 text-center text-[10px] font-semibold py-1 rounded-md border', SIDE[p.c].cls)}>{p.label}</span>)}
                  </div>
                )}
                {l.when && <p className="text-xs"><span className="text-muted-foreground">Quand : </span><span className="font-semibold">{l.when}</span></p>}
                <p className="text-xs text-foreground/90">{l.tip}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Jungle */}
        <Card icon={Trees} title="Jungle : risques et côté à jouer">
          {plan.jungle.length ? (
            <ul className="space-y-2">
              {plan.jungle.map((j, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed">
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', DOT[j.tone])} />
                  <span className={TONE[j.tone]}>{j.text}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">Ajoute leur jungler pour voir les risques.</p>}
        </Card>

        {/* Timing */}
        <Card icon={Clock} title={plan.timing.title}>
          <p className="text-sm text-foreground/90 leading-relaxed">{plan.timing.text}</p>
        </Card>

        {/* Rôles en combat */}
        <Card icon={Target} title="En teamfight : qui fait quoi">
          <div className="space-y-2">
            {plan.fight.map(f => (
              <div key={f.role} className="flex items-start gap-2.5">
                <Img c={byId[f.champ]} size="w-9 h-9" />
                <div className="min-w-0">
                  <p className="text-xs font-bold">{f.player} <span className="font-normal text-muted-foreground">· {byId[f.champ]?.name}</span></p>
                  <p className="text-xs text-foreground/90 leading-snug">{f.job}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center px-4">Verdicts tirés des duels mesurés (Lolalytics, parties Challenger / GM / Master) et des profils des champions. Aides à la décision, pas des certitudes.</p>
      </div>
    </div>
  );
}
