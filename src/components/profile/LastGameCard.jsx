import React from 'react';
import { cname, fmtTime } from '@/lib/gameData';
import { diagnose, champIdByName, agoFr, RIOT_TO_ROLE, ROLE_FR } from '@/lib/coachAnalysis';
import ChampImg from '@/components/profile/ChampImg';
import { cn } from '@/lib/utils';
import { X, Check } from 'lucide-react';

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}

// Analyse d'une partie, comme la carte « Dernière partie » du coach LoL
export default function LastGameCard({ game, label = 'Dernière partie' }) {
  const d = diagnose(game);
  const meC = champIdByName(game.me.champ);
  const opC = game.opp && champIdByName(game.opp.champ);
  const role = RIOT_TO_ROLE[game.pos];
  return (
    <div className={cn('glass rounded-xl border p-3', game.win ? 'border-green-win/40' : 'border-red-lose/40')}>
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1">{label} · {agoFr(game.at)}{role ? ` · ${ROLE_FR[role]}` : ''}</p>
        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', game.win ? 'bg-green-win/15 text-green-win' : 'bg-red-lose/15 text-red-lose')}>
          {game.win ? 'Victoire' : 'Défaite'}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <ChampImg id={meC} className="w-12 h-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold">{cname(meC)}</span>
            <span className="text-sm font-bold tabular-nums">{game.me.kda.join(' / ')}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {Math.round(game.dur)} min · côté {game.side}
            {game.pos === 'UTILITY' && game.adc ? ` · avec ${cname(champIdByName(game.adc))}` : ''}
            {opC ? ` · contre ${cname(opC)}` : ''}
            {game.pos === 'UTILITY' && game.eAdc ? ` + ${cname(champIdByName(game.eAdc))}` : ''}
          </p>
        </div>
      </div>

      <Section title="Ce que tu as raté">
        {d.bad.length ? (
          <ul className="space-y-2.5">
            {d.bad.slice(0, 5).map((x, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-5 h-5 shrink-0 rounded bg-red-lose text-white grid place-items-center mt-0.5"><X className="w-3.5 h-3.5" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{x.t}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{x.a}</p>
                  {x.linked && x.linked.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5">Lié : {x.linked.join(' · ')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Rien de marquant, belle partie.</p>}
      </Section>

      {d.good.length > 0 && (
        <Section title="Bien joué">
          <ul className="space-y-2">
            {d.good.slice(0, 3).map((x, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 shrink-0 rounded bg-green-win text-background grid place-items-center"><Check className="w-3.5 h-3.5" /></span>
                <span className="text-sm leading-snug">{x}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {game.deaths.length > 0 && (
        <Section title={`Tes morts (${game.deaths.length})`}>
          <div className="divide-y divide-border">
            {game.deaths.map((x, i) => (
              <div key={i} className="flex gap-3 py-2 text-sm">
                <span className="w-11 shrink-0 font-bold tabular-nums text-red-lose">{fmtTime(x.t)}</span>
                <div className="min-w-0">
                  <p className="leading-snug">{x.tags.join(' · ') || 'en lane'}</p>
                  {x.fix && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{x.fix}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {!game.hasTimeline && (
        <p className="text-[11px] text-muted-foreground mt-3">Chronologie indisponible pour cette partie : morts, vision avant objectifs et or à 14:00 ne sont pas analysés.</p>
      )}
    </div>
  );
}
