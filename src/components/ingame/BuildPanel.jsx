import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DATA, BUILD, iname, iimg, cname } from '@/lib/gameData';
import { planBuys, buildOrder, enemyThreats, loadInGameExtras, runeIcon, runeName, sumIcon, sumName } from '@/lib/inGame';

const SUPPORT_UPGRADE_NOTE = 'Chaque retour : 1 pink';

// Une case d'objet : icône, quantité, prix (achat complet ou assemblage seul)
function Tile({ st }) {
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0" title={iname(st.id)}>
      <div className={cn('relative w-10 h-10 rounded-lg overflow-hidden border bg-secondary', st.kind === 'finish' ? 'border-gold shadow-[0_0_8px_hsl(var(--gold)/0.35)]' : 'border-border')}>
        <img src={iimg(st.id)} alt={iname(st.id)} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        {st.qty > 1 && <span className="absolute bottom-0 right-0 text-[10px] font-bold bg-background/85 px-1 rounded-tl">×{st.qty}</span>}
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground leading-none">{st.cost || ''}</span>
    </div>
  );
}
const Sep = () => <span className="text-muted-foreground/60 text-sm self-start mt-2.5 shrink-0">›</span>;
const VBar = () => <span className="w-px self-stretch bg-border mx-1 shrink-0" />;

function Row({ label, sub, tag, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-b-0">
      <div className="w-[5.5rem] shrink-0 pt-0.5 min-w-0">
        <p className="text-xs font-semibold leading-tight">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 break-words">{sub}</p>}
        {tag && <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-lose bg-red-lose/10 border border-red-lose/30 rounded px-1.5 py-0.5">{tag}</span>}
      </div>
      <div className="flex-1 min-w-0 flex flex-wrap items-start gap-1.5">{children}</div>
    </div>
  );
}

export default function BuildPanel({ tips, champion, role, match }) {
  const [, setRev] = useState(0);
  useEffect(() => { let on = true; loadInGameExtras(DATA.version).then(() => { if (on) setRev(x => x + 1); }); return () => { on = false; }; }, []);

  const chips = enemyThreats(match);
  const build = tips.build && tips.build.ids;
  const raw = BUILD(champion.id, role);

  const Threats = chips.length ? (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span key={i} className={cn('text-xs px-2.5 py-1 rounded-full border bg-secondary/60',
          c.tone === 'bad' ? 'text-red-lose border-red-lose/40' : c.tone === 'warn' ? 'text-gold border-gold/40' : 'text-muted-foreground border-border')}>{c.text}</span>
      ))}
    </div>
  ) : null;

  // Pas assez de parties à ce poste : build type de la classe (texte), comme avant
  if (!build) {
    return (
      <div className="space-y-3">
        {Threats}
        <div className="glass rounded-xl p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground italic">{tips.build.source}</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-lg">{tips.build.starter}</span>
            {tips.build.core.map((it, i) => <span key={i} className="text-sm font-medium bg-gold/10 text-gold px-3 py-1.5 rounded-lg">{it}</span>)}
          </div>
          {tips.runes && <p className="text-sm"><span className="text-muted-foreground">Runes :</span> <b>{tips.runes.keystone}</b> · {tips.runes.primary} / {tips.runes.secondary}</p>}
        </div>
      </div>
    );
  }

  const order = buildOrder(build, role);
  const groups = planBuys(order.map(x => x.id), { start: build.start, boots: build.boots, support: role === 'SUPPORT', order });
  const g0 = groups.find(g => g.key === 'Départ'), g1 = groups.find(g => g.key === '1er retour');
  const rest = groups.filter(g => g !== g0 && g !== g1);
  const whyOf = id => (order.find(x => x.id === String(id)) || {});
  let n = 0;

  // Runes (ids bruts de builds.json) : « style:clé,r1,r2,r3|style:r1,r2 »
  let keystone = null, prim = [], sec = [];
  if (raw && raw.runes) {
    const [p, q] = String(raw.runes).split('|');
    const pr = ((p || '').split(':')[1] || '').split(',').filter(Boolean), sr = ((q || '').split(':')[1] || '').split(',').filter(Boolean);
    keystone = pr[0]; prim = pr.slice(1); sec = sr;
  }
  const RuneImg = ({ id, big }) => runeIcon(id)
    ? <img src={runeIcon(id)} alt={runeName(id)} title={runeName(id)} className={cn('rounded-full bg-background/60', big ? 'w-10 h-10' : 'w-6 h-6')} />
    : <span className={cn('inline-block rounded-full bg-secondary', big ? 'w-10 h-10' : 'w-6 h-6')} />;
  const skills = raw && raw.skills ? raw.skills.split('').join(' › ') : '';
  const sit = (build.situational || []);

  return (
    <div className="space-y-3">
      {Threats}
      <div className="glass rounded-xl px-3 py-1">
        {g0 && g1 ? (
          <Row label="Départ" sub="puis 1er retour">
            {g0.items.map(st => <Tile key={st.grp + st.id} st={st} />)}
            <VBar />
            {g1.items.map(st => <Tile key={st.grp + st.id} st={st} />)}
          </Row>
        ) : g0 ? (
          <Row label="Départ">{g0.items.map(st => <Tile key={st.grp + st.id} st={st} />)}</Row>
        ) : null}
        {rest.map(g => {
          const last = g.items[g.items.length - 1];
          const info = whyOf(last.id);
          const isBoots = g.key === 'boots';
          if (!isBoots) n++;
          return (
            <Row key={g.key} label={isBoots ? 'Bottes' : `Objet ${n}`} sub={iname(last.id)} tag={info.vs ? 'contre eux' : null}>
              {g.items.map((st, i) => (
                <React.Fragment key={st.grp + st.id + i}>
                  {i > 0 && <Sep />}
                  <Tile st={st} />
                </React.Fragment>
              ))}
            </Row>
          );
        })}
      </div>

      <div className="glass rounded-xl p-3 space-y-2.5 text-sm">
        {role === 'SUPPORT' && <p><b>{SUPPORT_UPGRADE_NOTE}</b> <span className="text-muted-foreground">(vision de la rivière)</span></p>}
        {sit.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Contre eux</p>
            <ul className="space-y-1">
              {sit.map((x, i) => (
                <li key={i} className="flex items-center gap-2">
                  <img src={iimg(x.id)} alt="" className="w-6 h-6 rounded border border-border shrink-0" loading="lazy" />
                  <span className="min-w-0"><b>{iname(x.id)}</b> <span className="text-muted-foreground text-xs">({x.why})</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {keystone && (
          <div className="flex items-center gap-3">
            <RuneImg id={keystone} big />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{runeName(keystone) || (build.runes && build.runes.keystone)}</p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {prim.map(id => <RuneImg key={id} id={id} />)}
                <VBar />
                {sec.map(id => <RuneImg key={id} id={id} />)}
              </div>
            </div>
          </div>
        )}
        {((build.spellIds || []).length > 0 || skills) && (
          <div className="flex items-center gap-2 flex-wrap">
            {(build.spellIds || []).map(k => sumIcon(k)
              ? <img key={k} src={sumIcon(k)} alt={sumName(k)} title={sumName(k)} className="w-8 h-8 rounded-md border border-border" />
              : null)}
            {skills && <span className="text-sm"><b>Sorts :</b> {skills}{raw.early ? <span className="text-muted-foreground text-xs"> (début {raw.early.split('').join(' ')})</span> : ''}</span>}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {build.games} parties de {cname(champion.id)} chez les Challenger / GM / Master (EUW + Corée).
          {!match || !Object.values(match.enemy).some(Boolean) ? ' Ajoute l\'équipe adverse pour adapter les objets.' : ''}
        </p>
      </div>
    </div>
  );
}
