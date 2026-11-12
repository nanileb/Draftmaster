import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { DATA, cname, iname, iimg } from '@/lib/gameData';
import { loadChampionSpells } from '@/lib/dataLoader';
import { laneAnalysis } from '@/lib/inGame';

const firstSentence = s => ((String(s || '').match(/^.*?[.!?](\s|$)/) || [s || ''])[0] || '').trim();

function useSpells(ids) {
  const [map, setMap] = useState({});
  const key = ids.filter(Boolean).join(',');
  useEffect(() => {
    let on = true;
    ids.filter(Boolean).forEach(id => {
      loadChampionSpells(id, DATA.version).then(list => { if (on) setMap(m => ({ ...m, [id]: list })); }).catch(() => { });
    });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

function SpellRow({ s, spells }) {
  const sp = (spells[s.champ] || []).find(x => x.key === s.key);
  const cd = sp && sp.cooldown && sp.cooldown !== '0' ? String(sp.cooldown).split('/') : null;
  const tip = s.tip || (sp ? firstSentence(sp.description) : '') || s.fallback || '';
  return (
    <div className="flex gap-3 items-start">
      {sp ? <img src={sp.icon} alt="" className="w-10 h-10 rounded-lg border border-border shrink-0" loading="lazy" />
        : <span className="w-10 h-10 rounded-lg bg-secondary border border-border shrink-0 grid place-items-center font-grotesk font-bold text-sm">{s.key}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight">
          <b>{cname(s.champ)} · {s.key}</b>{sp ? <span className="text-muted-foreground"> {sp.name}</span> : null}
          {cd && <span className="ml-1.5 text-[11px] tabular-nums text-accent whitespace-nowrap">{cd[0]} s{cd.length > 1 ? ` → ${cd[cd.length - 1]} s` : ''}</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{tip}</p>
      </div>
    </div>
  );
}

const TONE = {
  good: 'bg-green-win/15 text-green-win border-green-win/40',
  bad: 'bg-red-lose/15 text-red-lose border-red-lose/40',
  warn: 'bg-gold/15 text-gold border-gold/40',
};

export default function LanePanel({ match, build }) {
  const A = laneAnalysis(match);
  const spells = useSpells(A.spells ? [...new Set(A.spells.map(s => s.champ))] : []);

  if (A.missing) {
    return (
      <div className="glass rounded-xl p-4 space-y-1">
        <p className="text-sm">Complète la lane pour avoir les conseils.</p>
        <p className="text-xs text-muted-foreground">Manque : {A.missing.join(', ')}.</p>
      </div>
    );
  }
  const opp = match.enemy[match.role];
  const laneItems = opp && build ? (build.situational || []).filter(x => String(x.why || '').startsWith('contre ' + cname(opp))) : [];

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 space-y-2">
        <span className={cn('inline-block text-sm font-semibold px-3 py-1 rounded-full border', TONE[A.verdict[0]])}>{A.verdict[1]}</span>
        <p className="text-xs text-muted-foreground">{A.verdictSrc}</p>
        {A.phases && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {A.phases.map((p, i) => (
              <div key={i} className={cn('rounded-lg border p-2 text-center bg-secondary/40',
                p.c === 'adv' ? 'border-green-win/50' : p.c === 'dis' ? 'border-red-lose/50' : 'border-border')}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</p>
                <p className={cn('font-grotesk font-bold text-sm', p.c === 'adv' ? 'text-green-win' : p.c === 'dis' ? 'text-red-lose' : 'text-gold')}>
                  {p.c === 'adv' ? 'Avantage' : p.c === 'dis' ? 'Désavant.' : 'Égal'}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{p.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {laneItems.length > 0 && (
        <div className="glass rounded-xl p-3 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Objet clé contre {cname(opp)}</h3>
          {laneItems.map((x, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <img src={iimg(x.id)} alt="" className="w-9 h-9 rounded-lg border border-gold/60" loading="lazy" />
              <div className="min-w-0"><p className="text-sm font-semibold">{iname(x.id)}</p><p className="text-xs text-muted-foreground">{x.why}</p></div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Déjà placé dans ton build (onglet Build).</p>
        </div>
      )}

      <div className="glass rounded-xl p-3 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{A.spellsTitle}</h3>
        {A.spells.length ? A.spells.map((s, i) => <SpellRow key={i} s={s} spells={spells} />) : <p className="text-xs text-muted-foreground">Pas de fiche pour ces champions.</p>}
        <p className="text-[11px] text-muted-foreground">Recharges du patch en cours, du niveau 1 au rang max.</p>
      </div>

      <div className="glass rounded-xl p-3 space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-green-win font-semibold">{A.doTitle}</h3>
        <ul className="space-y-1.5">
          {A.do.map((t, i) => <li key={i} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-green-win shrink-0 mt-0.5" /><span>{t}</span></li>)}
        </ul>
      </div>
      <div className="glass rounded-xl p-3 space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-red-lose font-semibold">À éviter</h3>
        <ul className="space-y-1.5">
          {A.dont.map((t, i) => <li key={i} className="flex gap-2 text-sm"><X className="w-4 h-4 text-red-lose shrink-0 mt-0.5" /><span>{t}</span></li>)}
        </ul>
      </div>
    </div>
  );
}
