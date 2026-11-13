import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DATA, shrink, cname, blindKind } from '@/lib/gameData';
import { getPool } from '@/lib/localStore';
import { analysedGames, loadRoleGames, getAnalysis } from '@/lib/analysisStore';
import { updatedFr } from '@/lib/riot';
import { AN_ROLES, ROLE_FR, POS_OF, trends, hasChallengerTargets, agoFr, champIdByName } from '@/lib/coachAnalysis';
import ChampImg from '@/components/profile/ChampImg';
import LastGameCard from '@/components/profile/LastGameCard';
import { Loader2, RefreshCw, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_KEY = 'dm_an_role';
const readRole = () => { try { return localStorage.getItem(ROLE_KEY); } catch (e) { return null; } };
const writeRole = r => { try { localStorage.setItem(ROLE_KEY, r); } catch (e) { /* rien */ } };

function Card({ title, children, right }) {
  return (
    <div className="glass rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-semibold flex-1">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function WrRow({ id, n, w }) {
  const wr = Math.round(w / n * 100);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <ChampImg id={id} className="w-8 h-8 rounded-md" />
      <span className="text-sm flex-1 truncate">{cname(id)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{n} p.</span>
      <span className={cn('text-sm font-bold tabular-nums w-12 text-right', wr >= 50 ? 'text-green-win' : 'text-red-lose')}>{wr} %</span>
    </div>
  );
}

// Champions solides au patch à ce poste, absents du pool et des parties analysées
function poolSuggestions(ROLE, games) {
  const pos = POS_OF[ROLE];
  if (!DATA.builds || !DATA.builds.builds) return [];
  const owned = new Set([...getPool().map(p => p.championId), ...games.map(g => champIdByName(g.me.champ))]);
  return Object.entries(DATA.builds.builds)
    .filter(([k, b]) => k.endsWith('|' + pos) && b.n >= 40)
    .map(([k, b]) => ({ id: k.split('|')[0], b, sw: shrink(b.wr, b.n, 300), safe: blindKind(k.split('|')[0], ROLE) === 'safe' }))
    .filter(x => !owned.has(x.id))
    .sort((a, b) => (b.sw + (b.safe ? 0.5 : 0)) - (a.sw + (a.safe ? 0.5 : 0)))
    .slice(0, 3);
}

export default function FullAnalysisTab({ riotId, defaultRole }) {
  const [role, setRole] = useState(() => { const r = readRole(); return AN_ROLES.includes(r) ? r : (defaultRole || 'SUPPORT'); });
  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(null);
  const busyRef = useRef(false);

  const all = useMemo(() => analysedGames(riotId), [riotId, rev]);
  const games = useMemo(() => all.filter(g => g.pos === POS_OF[role]).slice(0, 15), [all, role]);
  const T = useMemo(() => games.length ? trends(games, role) : null, [games, role]);
  const sugg = useMemo(() => poolSuggestions(role, games), [role, games, DATA.rev]);

  const run = async (force = false) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    setStatus({ kind: 'info', text: 'Récupération de tes parties…' });
    try {
      const r = await loadRoleGames(riotId, role, s => { setStatus({ kind: 'info', text: `Recherche de tes parties en ${ROLE_FR[role]}… ${s.found}/${s.want}` }); setRev(x => x + 1); }, force);
      const more = r.more ? ' D\'autres parties restent à analyser : appuie de nouveau sur le bouton dans 2 minutes pour continuer.' : '';
      setStatus(r.found
        ? { kind: 'ok', text: `${r.found} partie${r.found > 1 ? 's' : ''} classée${r.found > 1 ? 's' : ''} en ${ROLE_FR[role]} analysée${r.found > 1 ? 's' : ''}.${more}` }
        : r.more ? { kind: 'info', text: `Pas encore de partie en ${ROLE_FR[role]} trouvée.${more}` }
        : { kind: 'err', text: `Aucune partie classée en ${ROLE_FR[role]} dans tes ${r.total} dernières parties.` });
    } catch (e) {
      setStatus({ kind: 'err', text: e.message || 'Impossible de joindre le relais.' });
    }
    busyRef.current = false; setBusy(false); setRev(x => x + 1);
  };

  // Aucun lancement automatique : l'API Riot n'est appelée que sur le bouton ci-dessous
  const A = getAnalysis();
  const updated = A.riotId && all.length ? A.updated : 0;

  // Pas de poste choisi auparavant : on suit le poste le plus joué dès que l'historique est chargé
  useEffect(() => {
    if (!readRole() && defaultRole && defaultRole !== role && !busyRef.current) setRole(defaultRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRole]);

  const pick = r => { if (busy) return; setRole(r); writeRole(r); setStatus(null); setOpen(null); };

  return (
    <div className="space-y-3 pb-6">
      {/* Choix du poste */}
      <div>
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Poste analysé</p>
        <div className="grid grid-cols-5 gap-1.5">
          {AN_ROLES.map(r => (
            <button
              key={r}
              onClick={() => pick(r)}
              disabled={busy && r !== role}
              className={cn('py-2 rounded-lg text-xs font-semibold border transition-colors min-h-[40px]',
                r === role ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border disabled:opacity-50')}
            >
              {ROLE_FR[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => run(false)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {games.length ? 'Mettre à jour' : 'Analyser mes parties'}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{updated ? `Analyse mise à jour ${updatedFr(updated)}` : 'Pas encore analysé : appuie sur le bouton pour lancer l\'analyse.'}</p>
      {status && (
        <p className={cn('text-xs leading-snug', status.kind === 'err' ? 'text-red-lose' : status.kind === 'ok' ? 'text-green-win' : 'text-muted-foreground')}>{status.text}</p>
      )}

      {!games.length && !busy && (
        <div className="glass rounded-xl border border-border p-4 text-center">
          <p className="text-sm">{all.length ? `Aucune partie en ${ROLE_FR[role]} parmi tes parties analysées.` : 'Aucune partie analysée pour l\'instant.'}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">L'analyse cherche tes 15 dernières parties classées jouées en {ROLE_FR[role]}, quand tu appuies sur « {all.length ? 'Mettre à jour' : 'Analyser mes parties'} ». Les parties à d'autres postes sont ignorées.</p>
        </div>
      )}

      {T && (
        <>
          {T.prio.length > 0 && (
            <Card title={`Tes 3 priorités (${games.length} parties)`}>
              <ol className="space-y-2.5">
                {T.prio.map((x, i) => (
                  <li key={x.k} className="flex gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gold/20 text-gold text-[11px] font-bold grid place-items-center mt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm leading-snug"><b className="text-gold">{x.l} : {x.fmt(x.v)}</b> <span className="text-xs text-muted-foreground">objectif {x.fmt(x.t)}</span></p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{x.a}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card title={`Toi vs ${role === 'JUNGLE' ? 'junglers' : ROLE_FR[role] + 's'} adverses`}>
            <div className="text-[13px]">
              <div className="grid grid-cols-[1fr_52px_52px_52px] gap-1 pb-1.5 border-b border-border text-[10px] font-bold uppercase tracking-wider text-gold">
                <span />
                <span className="text-right">Toi</span>
                <span className="text-right">Eux</span>
                <span className="text-right">Cible</span>
              </div>
              {T.axes.map(x => (
                <div key={x.k} className="grid grid-cols-[1fr_52px_52px_52px] gap-1 py-1.5 border-b border-border last:border-0 items-center">
                  <span className="leading-tight">{x.l}</span>
                  <b className={cn('text-right tabular-nums', x.v == null ? 'text-muted-foreground' : x.score < 0.9 ? 'text-red-lose' : 'text-green-win')}>{x.v == null ? '–' : x.fmt(x.v)}</b>
                  <span className="text-right tabular-nums text-muted-foreground">{x.o == null ? '–' : x.fmt(x.o)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{x.fmt(x.t)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mt-2">
              Rouge = sous l'objectif. « Eux » = moyenne de tes adversaires directs.{hasChallengerTargets() ? ' « Cible » = médiane des joueurs Challenger / GM à ce poste.' : ''} Uniquement tes {games.length} dernières parties en {ROLE_FR[role]}.
            </p>
          </Card>

          <Card title={`Tes champions ${ROLE_FR[role]} · ${T.wins}V ${games.length - T.wins}D`}>
            <div className="divide-y divide-border">
              {T.champs.map(c => <WrRow key={c.id} {...c} />)}
            </div>
            {T.adcs.length > 0 && (
              <>
                <p className="text-sm font-semibold mt-3 mb-1">Avec tes ADC</p>
                <div className="divide-y divide-border">
                  {T.adcs.map(c => <WrRow key={c.id} {...c} />)}
                </div>
              </>
            )}
          </Card>

          {sugg.length > 0 && (
            <Card title="Champions à ajouter au pool" right={<Lightbulb className="w-4 h-4 text-primary" />}>
              <div className="space-y-2">
                {sugg.map(s => (
                  <div key={s.id} className="flex items-start gap-2.5">
                    <ChampImg id={s.id} className="w-8 h-8 rounded-md mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{cname(s.id)}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{s.b.wr} % de victoires sur {s.b.n} parties Challenger / GM / Master{s.safe ? ', facile à prendre tôt dans la draft' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Parties analysées">
            <div className="divide-y divide-border">
              {games.map(g => {
                const id = champIdByName(g.me.champ), isOpen = open === g.id;
                return (
                  <div key={g.id}>
                    <button onClick={() => setOpen(isOpen ? null : g.id)} className="w-full flex items-center gap-3 py-2 text-left">
                      <ChampImg id={id} className="w-8 h-8 rounded-md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{cname(id)} <span className="tabular-nums text-muted-foreground">{g.me.kda.join('/')}</span></p>
                        <p className="text-[11px] text-muted-foreground">{agoFr(g.at)}{g.opp ? ` · contre ${cname(champIdByName(g.opp.champ))}` : ''}</p>
                      </div>
                      <span className={cn('text-xs font-bold', g.win ? 'text-green-win' : 'text-red-lose')}>{g.win ? 'V' : 'D'}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isOpen && <div className="pb-3"><LastGameCard game={g} label="Partie" /></div>}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
