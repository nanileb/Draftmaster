import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, Loader2, Search, Star, TrendingUp, TrendingDown, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DD } from '@/lib/gameData';

// Nouveautés du patch courant : public/data/patch-notes.json, produit chaque jour par tools/patch-notes.mjs
// (notes officielles Riot en français + comparaison Data Dragon avec le patch précédent).
const FILE = (import.meta.env.BASE_URL || '/') + 'data/patch-notes.json';
const patchLabel = v => { const [a, b] = String(v || '').split('.').map(Number); return Number.isFinite(a) && Number.isFinite(b) ? `${a >= 15 ? a + 10 : a}.${b}` : null; };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const fmtDate = iso => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(+d) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); };

const TREND = {
  buff: { label: 'Renforcé', cls: 'bg-green-win/15 text-green-win border-green-win/30', Icon: TrendingUp },
  nerf: { label: 'Affaibli', cls: 'bg-destructive/15 text-destructive border-destructive/30', Icon: TrendingDown },
  ajust: { label: 'Ajusté', cls: 'bg-gold/15 text-gold border-gold/30', Icon: ArrowLeftRight },
};

function TrendBadge({ trend }) {
  const t = TREND[trend]; if (!t) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0', t.cls)}>
      <t.Icon className="w-3 h-3" />{t.label}
    </span>
  );
}

// Une ligne « libellé : avant ⇒ après » (ou un texte libre)
function ChangeLine({ c }) {
  if (c.from == null && c.to == null) return <li className="text-sm text-foreground/90 leading-snug">{c.text}</li>;
  const tone = c.dir > 0 ? 'text-green-win' : c.dir < 0 ? 'text-destructive' : 'text-foreground';
  return (
    <li className="text-sm leading-snug">
      {c.label && <span className="font-semibold text-foreground">{c.label} : </span>}
      <span className="text-muted-foreground line-through decoration-muted-foreground/40 break-words">{c.from || '—'}</span>
      <span className="text-primary font-bold mx-1">⇒</span>
      <span className={cn('font-semibold break-words', tone)}>{c.to || '—'}</span>
    </li>
  );
}

function Card({ children, highlight, className }) {
  return <div className={cn('glass rounded-2xl border p-4', highlight ? 'border-primary/50' : 'border-border', className)}>{children}</div>;
}

function GroupHeader({ name, icon, trend, mine }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {icon ? <img src={icon} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-grotesk font-bold text-base truncate">{name}</h3>
          {mine && <Star className="w-3.5 h-3.5 text-gold fill-gold shrink-0" aria-label="Dans ton pool" />}
        </div>
      </div>
      <TrendBadge trend={trend} />
    </div>
  );
}

// Bloc des notes officielles (champion, objet, ou sous-partie d'une section)
function OfficialGroup({ g, icon, trend, mine }) {
  const [more, setMore] = useState(false);
  return (
    <Card highlight={mine}>
      {g.name && <GroupHeader name={g.name} icon={icon || g.icon} trend={trend} mine={mine} />}
      {g.summary && <p className={cn('text-sm text-foreground/90 leading-snug', g.name && 'mt-2')}>{g.summary}</p>}
      {g.context?.length > 0 && (
        more
          ? g.context.map((t, i) => <p key={i} className="text-xs text-muted-foreground italic leading-snug mt-2 border-l-2 border-primary/30 pl-2">{t}</p>)
          : <button type="button" onClick={() => setMore(true)} className="text-xs text-primary mt-1.5 py-1">Pourquoi ce changement ?</button>
      )}
      {g.blocks.map((b, i) => (
        <div key={i} className={cn((i || g.name || g.summary) && 'mt-3')}>
          {b.title && (
            <div className="flex items-center gap-2 mb-1.5">
              {b.icon && <img src={b.icon} alt="" className="w-6 h-6 rounded-md border border-border" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{b.title}</p>
            </div>
          )}
          <ul className="space-y-1.5 list-none">{b.changes.map((c, j) => <ChangeLine key={j} c={c} />)}</ul>
        </div>
      ))}
    </Card>
  );
}

// Champion d'après Data Dragon (chiffres exacts : stats, délais, coûts, portées)
function DDChampion({ c, icon, mine, version }) {
  return (
    <Card highlight={mine}>
      <GroupHeader name={c.name} icon={icon} trend={c.trend} mine={mine} />
      {c.stats.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1.5">Statistiques de base</p>
          <ul className="space-y-1.5">{c.stats.map((s, i) => <ChangeLine key={i} c={s} />)}</ul>
        </div>
      )}
      {c.spells.map((s, i) => (
        <div key={i} className="mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            {s.icon && <img src={`${DD}/cdn/${version}/img/${s.icon}`} alt="" className="w-6 h-6 rounded-md border border-border" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{s.key === 'P' ? 'Passif' : s.key} · {s.name}</p>
          </div>
          <ul className="space-y-1.5">
            {s.changes.map((x, j) => <ChangeLine key={j} c={x} />)}
            {s.textChanged && <li className="text-sm text-muted-foreground">Effet de la compétence retouché (détail dans les notes officielles).</li>}
          </ul>
        </div>
      ))}
    </Card>
  );
}

function Collapsible({ title, count, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="glass rounded-2xl border border-border overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-secondary/40" aria-expanded={open}>
        <span className="flex-1 font-grotesk font-bold text-base">{title}</span>
        {count != null && <span className="text-xs text-muted-foreground">{count}</span>}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

const TABS = [
  { key: 'resume', label: 'Résumé' },
  { key: 'champions', label: 'Champions' },
  { key: 'objets', label: 'Objets' },
  { key: 'autres', label: 'Le reste' },
];

export default function PatchNotes({ champions = [], version, userPool = [], onBack }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [tab, setTab] = useState('resume');
  const [q, setQ] = useState('');

  useEffect(() => {
    let off = false;
    fetch(FILE, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(d => { if (!off) { setData(d); setState('ok'); } })
      .catch(() => { if (!off) setState('error'); });
    return () => { off = true; };
  }, []);

  const current = patchLabel(version);
  const stale = data && current && data.patch !== current;
  const officialUrl = (!stale && data?.officialUrl) || (current ? `https://www.leagueoflegends.com/fr-fr/news/game-updates/league-of-legends-patch-${current.replace('.', '-')}-notes/` : 'https://www.leagueoflegends.com/fr-fr/news/game-updates/');

  // Correspondance nom affiché → champion (icône) et pool du joueur
  const byName = useMemo(() => { const m = {}; champions.forEach(c => { m[norm(c.name)] = c; m[norm(c.id)] = c; }); return m; }, [champions]);
  const poolIds = useMemo(() => new Set((userPool || []).map(p => p.championId)), [userPool]);
  const champOf = name => byName[norm(name)] || null;

  const off = data?.official;
  const dd = data?.ddragon || { champions: [], items: [], runes: [], newChampions: [], newItems: [], removedItems: [] };
  const ddTrend = useMemo(() => Object.fromEntries((dd.champions || []).map(c => [c.id, c.trend])), [dd]);
  const sections = off?.sections || [];
  const champSec = sections.find(s => /^champions?$/i.test(s.title.trim())) || sections.find(s => /champion/i.test(s.title) && !/aram|arena|ar[èe]ne|classic/i.test(s.title));
  const itemSec = sections.find(s => /^objets?$/i.test(s.title.trim())) || sections.find(s => /objet/i.test(s.title) && !/aram|arena|ar[èe]ne|classic/i.test(s.title));
  const runeSec = sections.find(s => /^runes?$/i.test(s.title.trim()));
  const highlights = sections.find(s => /temps forts|highlights/i.test(s.title));
  const others = sections.filter(s => s !== champSec && s !== itemSec && s !== runeSec && s !== highlights);

  // Liste des champions (notes officielles si disponibles, sinon Data Dragon)
  const champList = useMemo(() => {
    if (champSec) return champSec.groups.filter(g => g.name).map(g => { const c = champOf(g.name); return { kind: 'off', key: g.name, name: g.name, g, champ: c, trend: c ? ddTrend[c.id] : null, mine: c ? poolIds.has(c.id) : false }; });
    return (dd.champions || []).map(c => ({ kind: 'dd', key: c.id, name: c.name, c, champ: byName[norm(c.id)], trend: c.trend, mine: poolIds.has(c.id) }));
  }, [champSec, dd, byName, poolIds, ddTrend]);
  const sortedChamps = useMemo(() => [...champList].sort((a, b) => (b.mine - a.mine)), [champList]);
  const shownChamps = q ? sortedChamps.filter(x => norm(x.name).includes(norm(q))) : sortedChamps;
  const mineList = champList.filter(x => x.mine);
  const newChamps = dd.newChampions || [];

  const header = (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-lg sticky top-0 z-20" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}>
      <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target" aria-label="Retour">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="font-grotesk font-bold text-base truncate">Nouveautés du patch {data && !stale ? data.patch : current || ''}</h2>
        <p className="text-xs text-muted-foreground truncate">
          {off?.date ? `Publié le ${fmtDate(off.date)}` : 'Notes de patch'}{data?.version && !stale ? ` · Data Dragon ${data.version}` : ''}
        </p>
      </div>
    </div>
  );

  if (state === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-background">
        {header}
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-sm">Chargement des nouveautés…</p>
        </div>
      </div>
    );
  }

  const officialLink = (
    <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-primary/30 bg-primary/10 text-primary font-semibold text-sm active:scale-[0.98] transition-all">
      Notes officielles de Riot <ExternalLink className="w-4 h-4" />
    </a>
  );

  if (state === 'error' || !data || stale) {
    return (
      <div className="min-h-[100dvh] bg-background">
        {header}
        <div className="px-4 py-8 space-y-4">
          <Card>
            <p className="font-grotesk font-bold">Récapitulatif en préparation</p>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">
              {stale
                ? `Le patch ${current} vient de sortir : son récapitulatif est généré automatiquement chaque jour et sera disponible ici après la prochaine mise à jour.`
                : 'Le récapitulatif du patch est indisponible pour le moment (connexion ?).'}
            </p>
          </Card>
          {officialLink}
        </div>
      </div>
    );
  }

  const counts = {
    champions: champList.length,
    items: itemSec ? itemSec.groups.filter(g => g.name).length : (dd.items || []).length,
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      {header}

      {/* Onglets */}
      <div className="sticky top-[calc(57px+env(safe-area-inset-top,0px))] z-10 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-2">
        <div className="grid grid-cols-4 gap-1 bg-secondary/40 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => { setTab(t.key); window.scrollTo({ top: 0 }); }}
              className={cn('py-2 rounded-lg text-xs font-semibold transition-all', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {tab === 'resume' && (
          <>
            {off?.image && <img src={off.image} alt="" className="w-full rounded-2xl border border-border object-cover aspect-video" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {off?.intro?.length > 0 && (
              <Card>{off.intro.map((t, i) => <p key={i} className={cn('text-sm leading-relaxed text-foreground/90', i && 'mt-2')}>{t}</p>)}</Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setTab('champions')} className="glass rounded-2xl border border-border p-4 text-left active:scale-[0.98] transition-all">
                <p className="font-grotesk font-extrabold text-2xl text-primary">{counts.champions}</p>
                <p className="text-xs text-muted-foreground">champions modifiés</p>
              </button>
              <button type="button" onClick={() => setTab('objets')} className="glass rounded-2xl border border-border p-4 text-left active:scale-[0.98] transition-all">
                <p className="font-grotesk font-extrabold text-2xl text-primary">{counts.items}</p>
                <p className="text-xs text-muted-foreground">objets modifiés</p>
              </button>
            </div>

            {newChamps.length > 0 && (
              <Card highlight>
                <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Nouveau champion</p>
                {newChamps.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <img src={`${DD}/cdn/${data.version}/img/champion/${c.id}.png`} alt="" className="w-12 h-12 rounded-xl border border-border" />
                    <div><p className="font-grotesk font-bold">{c.name}</p><p className="text-xs text-muted-foreground capitalize">{c.title}</p></div>
                  </div>
                ))}
              </Card>
            )}

            {mineList.length > 0 && (
              <Card highlight>
                <p className="text-xs font-bold uppercase tracking-wide text-gold mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-gold" />Ton pool est concerné</p>
                <div className="flex flex-wrap gap-2">
                  {mineList.map(x => (
                    <button key={x.key} type="button" onClick={() => { setQ(x.name); setTab('champions'); }} className="flex items-center gap-1.5 bg-secondary/50 rounded-full pl-1 pr-2.5 py-1 active:scale-95 transition-all">
                      {x.champ?.iconUrl && <img src={x.champ.iconUrl} alt="" className="w-6 h-6 rounded-full" />}
                      <span className="text-xs font-semibold">{x.name}</span>
                      {x.trend && <span className={cn('w-1.5 h-1.5 rounded-full', x.trend === 'buff' ? 'bg-green-win' : x.trend === 'nerf' ? 'bg-destructive' : 'bg-gold')} />}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {['buff', 'nerf', 'ajust'].map(tr => {
              const list = champList.filter(x => x.trend === tr);
              if (!list.length) return null;
              return (
                <Card key={tr}>
                  <div className="mb-2"><TrendBadge trend={tr} /></div>
                  <div className="flex flex-wrap gap-2">
                    {list.map(x => (
                      <button key={x.key} type="button" onClick={() => { setQ(x.name); setTab('champions'); }} className="flex flex-col items-center gap-1 w-14 active:scale-95 transition-all">
                        {x.champ?.iconUrl ? <img src={x.champ.iconUrl} alt="" className="w-11 h-11 rounded-xl border border-border" loading="lazy" /> : <div className="w-11 h-11 rounded-xl bg-secondary" />}
                        <span className="text-[11px] text-muted-foreground truncate w-full text-center">{x.name}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}

            {highlights?.images?.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">Temps forts</p>
                {highlights.images.map((src, i) => <img key={i} src={src} alt="" className="w-full rounded-2xl border border-border" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />)}
              </div>
            )}
            {highlights?.intro?.map((t, i) => <p key={i} className="text-sm text-foreground/90 leading-snug px-1">{t}</p>)}

            {!off && (
              <p className="text-xs text-muted-foreground leading-snug px-1">
                Le texte des notes officielles n'a pas pu être récupéré pour ce patch : les changements ci-dessus viennent de la comparaison des données du jeu (Data Dragon {data.previous} → {data.version}). Les dégâts des compétences n'y figurent pas : consulte les notes de Riot pour le détail.
              </p>
            )}
            {officialLink}
          </>
        )}

        {tab === 'champions' && (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un champion" inputMode="search"
                className="w-full bg-secondary/40 border border-border rounded-xl pl-9 pr-9 py-2.5 text-base focus:outline-none focus:border-primary/50" />
              {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs px-2 py-1">Effacer</button>}
            </div>
            {champSec?.intro?.map((t, i) => <p key={i} className="text-sm text-muted-foreground leading-snug px-1">{t}</p>)}
            {shownChamps.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun champion modifié{q ? ` ne correspond à « ${q} »` : ' à ce patch'}.</p>}
            {shownChamps.map(x => x.kind === 'off'
              ? <OfficialGroup key={x.key} g={x.g} icon={x.champ?.iconUrl} trend={x.trend} mine={x.mine} />
              : <DDChampion key={x.key} c={x.c} icon={x.champ?.iconUrl} mine={x.mine} version={data.version} />)}
          </>
        )}

        {tab === 'objets' && (
          <>
            {itemSec ? (
              <>
                {itemSec.intro.map((t, i) => <p key={i} className="text-sm text-muted-foreground leading-snug px-1">{t}</p>)}
                {itemSec.groups.map((g, i) => <OfficialGroup key={i} g={g} />)}
              </>
            ) : (
              <>
                {(dd.items || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun objet modifié à ce patch.</p>}
                {(dd.items || []).map(it => (
                  <Card key={it.id}>
                    <GroupHeader name={it.name} icon={`${DD}/cdn/${data.version}/img/item/${it.id}.png`} />
                    <ul className="space-y-1.5 mt-3">
                      {it.changes.map((c, j) => <ChangeLine key={j} c={c} />)}
                      {it.lines.map((l, j) => <ChangeLine key={'l' + j} c={l.from && l.to ? l : { text: l.to ? `Nouveau : ${l.to}` : `Retiré : ${l.from}` }} />)}
                    </ul>
                  </Card>
                ))}
              </>
            )}
            {(dd.newItems || []).length > 0 && (
              <Card>
                <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Nouveaux objets</p>
                <div className="space-y-2">{dd.newItems.map(it => (
                  <div key={it.id} className="flex items-center gap-2"><img src={`${DD}/cdn/${data.version}/img/item/${it.id}.png`} alt="" className="w-7 h-7 rounded-md border border-border" /><span className="text-sm">{it.name}</span><span className="text-xs text-gold ml-auto">{it.gold} PO</span></div>
                ))}</div>
              </Card>
            )}
            {(dd.removedItems || []).length > 0 && (
              <Card>
                <p className="text-xs font-bold uppercase tracking-wide text-destructive mb-2">Objets retirés</p>
                <p className="text-sm text-muted-foreground">{dd.removedItems.map(x => x.name).join(', ')}</p>
              </Card>
            )}
            {(runeSec || (dd.runes || []).length > 0) && <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1 pt-2">Runes</p>}
            {runeSec
              ? runeSec.groups.map((g, i) => <OfficialGroup key={i} g={g} />)
              : (dd.runes || []).map(r => (
                <Card key={r.id}>
                  <GroupHeader name={r.name} icon={r.icon ? `${DD}/cdn/img/${r.icon}` : null} />
                  <p className="text-xs text-muted-foreground mt-1">{r.tree}{r.isNew ? ' · nouvelle rune' : ''}</p>
                  <ul className="space-y-1.5 mt-2">{r.lines.map((l, j) => <ChangeLine key={j} c={l.from && l.to ? l : { text: l.to || l.from }} />)}</ul>
                </Card>
              ))}
          </>
        )}

        {tab === 'autres' && (
          <>
            {others.length === 0 && (
              <Card>
                <p className="text-sm text-muted-foreground leading-snug">Les autres nouveautés (modes de jeu, corrections de bugs, skins…) sont dans les notes officielles de Riot.</p>
              </Card>
            )}
            {others.map((s, i) => {
              const n = s.groups.reduce((t, g) => t + (g.name ? 1 : g.blocks.reduce((u, b) => u + b.changes.length, 0)), 0);
              return (
                <Collapsible key={i} title={s.title} count={n || null} defaultOpen={i === 0}>
                  {s.intro.map((t, j) => <p key={j} className="text-sm text-foreground/90 leading-snug">{t}</p>)}
                  {s.images.slice(0, 2).map((src, j) => <img key={j} src={src} alt="" className="w-full rounded-xl border border-border" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />)}
                  {s.groups.map((g, j) => <OfficialGroup key={j} g={g} icon={g.name ? champOf(g.name)?.iconUrl : null} />)}
                </Collapsible>
              );
            })}
            {officialLink}
          </>
        )}

        <p className="text-[11px] text-muted-foreground/60 text-center pt-2 leading-snug">
          Sources : {off ? 'notes de patch officielles de Riot Games, ' : ''}Data Dragon ({data.previous} → {data.version}). Mis à jour automatiquement chaque jour.
        </p>
      </div>
    </div>
  );
}
