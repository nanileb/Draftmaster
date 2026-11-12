import React, { useMemo, useState } from 'react';
import { DATA, BUILD, POS_TO_ROLE, shrink, cname, blindKind } from '@/lib/gameData';
import { getPool } from '@/lib/localStore';
import { Loader2, TrendingUp, Target, Lightbulb, Trophy, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS = {
  TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support', NONE: '-', '': '-',
};

function StatCard({ label, value, sub, color = 'text-foreground' }) {
  return (
    <div className="glass rounded-xl p-3 border border-border flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn('text-xl font-bold font-grotesk', color)}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ChampionPoolCard({ champ, ddVersion }) {
  const kda = champ.deaths === 0
    ? (champ.kills + champ.assists).toFixed(1)
    : ((champ.kills + champ.assists) / champ.deaths).toFixed(2);
  const kdaNum = parseFloat(kda);
  const wr = Math.round((champ.wins / champ.games) * 100);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${champ.championId || champ.championName}.png`}
        alt={champ.championName}
        className="w-10 h-10 rounded-lg border border-border"
        onError={e => { e.target.style.display = 'none'; }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{champ.championName}</span>
          {champ.role && ROLE_LABELS[champ.role] && (
            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">
              {ROLE_LABELS[champ.role]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-xs font-bold', wr >= 60 ? 'text-green-win' : wr >= 50 ? 'text-blue-info' : 'text-red-lose')}>
            {wr}% WR
          </span>
          <span className="text-xs text-muted-foreground">{champ.games} partie{champ.games > 1 ? 's' : ''}</span>
          <span className={cn('text-xs font-semibold', kdaNum >= 4 ? 'text-yellow-400' : kdaNum >= 3 ? 'text-green-win' : kdaNum >= 2 ? 'text-blue-info' : 'text-muted-foreground')}>
            {kda} KDA
          </span>
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <div>{champ.wins}V {champ.games - champ.wins}D</div>
        <div>{champ.avgCs} CS/min</div>
      </div>
    </div>
  );
}

function TipCard({ icon: Icon, title, text, color = 'text-primary' }) {
  return (
    <div className="glass rounded-xl p-3 border border-border">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

const avg = (arr) => { const v = arr.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const pct = x => Math.round(x * 100);

const fr = (x, d) => (d == null ? String(x) : x.toFixed(d)).replace('.', ',');

function buildTips(stats, matches, champions) {
  const mainRole = stats.champStats[0]?.role || '';
  const role = POS_TO_ROLE[mainRole] || null;
  const T = DATA.builds && DATA.builds.targets && DATA.builds.targets[mainRole];
  const me = {
    csm: avg(matches.map(m => parseFloat(m.csPerMin))),
    vspm: avg(matches.map(m => m.vspm)),
    ctrl: avg(matches.map(m => m.ctrlWards)),
    deaths: avg(matches.map(m => m.deaths)),
    kp: avg(matches.map(m => m.kp)),
    dmg: avg(matches.map(m => m.dmgShare)),
  };
  const ref = T ? ' (médiane Challenger / GM / Master au même poste : ' : '';
  const out = { source: T ? `Comparaison avec les médianes des parties Challenger / GM / Master (patch ${DATA.builds.patch}, ${T.n} parties au poste). Ce sont des repères, pas des objectifs à atteindre à tout elo.` : 'Données de référence du coach indisponibles : conseils généraux seulement.' };

  if (mainRole !== 'UTILITY' && me.csm != null) {
    out.csAdvice = T
      ? (me.csm >= T.csm * 0.9 ? `${fr(me.csm, 1)} CS/min, proche de la référence${ref}${fr(T.csm)}). Continue à placer tes retours après une vague poussée.` : `${fr(me.csm, 1)} CS/min${ref}${fr(T.csm)}). Chaque vague manquée est de l'or perdu : rentre après avoir poussé et récupère les vagues latérales en milieu de partie.`)
      : `${fr(me.csm, 1)} CS/min. Vise au moins 7 en laner, 5,5 en jungle.`;
  }
  if (me.vspm != null) {
    const ctrlTxt = me.ctrl != null && T ? ` Balises de contrôle : ${fr(me.ctrl, 1)} par partie (référence : ${fr(T.ctrl)}).` : '';
    out.visionAdvice = T
      ? `${fr(me.vspm, 2)} de score de vision par minute${ref}${fr(T.vspm)}).${ctrlTxt}` + (me.vspm < T.vspm * 0.75 ? (mainRole === 'UTILITY' ? ' Pose une balise à chaque retour et prépare la vision une minute avant chaque objectif.' : ' Achète une balise de contrôle à chaque retour et pose ton trinket avant de jouer loin de ta tour.') : ' Bonne habitude, garde-la.')
      : `${Math.round(stats.avgVision)} de score de vision par partie.`;
  }
  if (me.deaths != null) {
    const kpTxt = me.kp != null && T ? ` Participation aux kills : ${pct(me.kp)} % (référence : ${pct(T.kp)} %).` : '';
    out.kdaAdvice = (T ? `${fr(me.deaths, 1)} morts par partie${ref}${fr(T.deaths)}).` : `${fr(me.deaths, 1)} morts par partie.`) + kpTxt + (T && me.deaths > T.deaths + 1 ? ' Avant de t\'avancer, demande-toi où est la jungle adverse et quels sorts majeurs sont disponibles.' : '');
  }
  const wr = Math.round(stats.wins / (stats.wins + stats.losses) * 100);
  const top = stats.champStats[0];
  out.globalAdvice = stats.champStats.length > 4
    ? `${stats.champStats.length} champions différents sur ${matches.length} parties : resserre ton pool à 2-3 champions par poste pour progresser plus vite.`
    : top && top.games >= 3 ? `${top.championName} est ton champion le plus joué (${top.games} parties, ${Math.round(top.wins / top.games * 100)} % de victoires). Garde-le comme valeur sûre.` : `Winrate de ${wr} % sur ${matches.length} parties : l'échantillon est petit, juge sur la durée.`;

  // Champions à ajouter : solides au patch à ce poste, faciles à jouer en premier pick, absents du pool
  if (role && DATA.builds && DATA.builds.builds) {
    const pos = mainRole;
    const owned = new Set([...getPool().map(p => p.championId), ...stats.champStats.map(c => c.championId || c.championName)]);
    const cands = Object.entries(DATA.builds.builds)
      .filter(([k, b]) => k.endsWith('|' + pos) && b.n >= 40)
      .map(([k, b]) => ({ id: k.split('|')[0], b, sw: shrink(b.wr, b.n, 300) }))
      .filter(x => !owned.has(x.id))
      .sort((a, b) => (b.sw + (blindKind(b.id, role) === 'safe' ? 0.5 : 0)) - (a.sw + (blindKind(a.id, role) === 'safe' ? 0.5 : 0)))
      .slice(0, 3);
    out.poolSuggestions = cands.map(x => ({ championName: cname(x.id), championId: x.id, reason: `${x.b.wr} % de victoires sur ${x.b.n} parties Challenger / GM / Master` + (blindKind(x.id, role) === 'safe' ? ', facile à prendre tôt dans la draft' : '') }));
  }
  return out;
}

const QUEUE_LABELS = { RANKED_SOLO_5x5: 'Solo/Duo', RANKED_FLEX_SR: 'Flex' };

export default function AnalysisTab({ matches, ddVersion, champions, rankedStats = [] }) {
  const [aiTips, setAiTips] = useState(null);
  const [loadingTips, setLoadingTips] = useState(false);

  const stats = useMemo(() => {
    if (!matches || matches.length === 0) return null;

    const wins = matches.filter(m => m.win).length;
    const losses = matches.length - wins;
    const totalKills = matches.reduce((s, m) => s + m.kills, 0);
    const totalDeaths = matches.reduce((s, m) => s + m.deaths, 0);
    const totalAssists = matches.reduce((s, m) => s + m.assists, 0);
    const avgKDA = totalDeaths === 0
      ? (totalKills + totalAssists).toFixed(2)
      : ((totalKills + totalAssists) / totalDeaths).toFixed(2);
    const avgCs = (matches.reduce((s, m) => s + parseFloat(m.csPerMin), 0) / matches.length).toFixed(1);
    const avgVision = Math.round(matches.reduce((s, m) => s + m.visionScore, 0) / matches.length);

    // Champions played
    const champMap = {};
    matches.forEach(m => {
      const key = m.championName;
      if (!champMap[key]) {
        champMap[key] = { championName: key, championId: m.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, csArr: [], role: m.role };
      }
      champMap[key].games++;
      if (m.win) champMap[key].wins++;
      champMap[key].kills += m.kills;
      champMap[key].deaths += m.deaths;
      champMap[key].assists += m.assists;
      champMap[key].csArr.push(parseFloat(m.csPerMin));
    });

    const champStats = Object.values(champMap)
      .map(c => ({
        ...c,
        avgCs: (c.csArr.reduce((a, b) => a + b, 0) / c.csArr.length).toFixed(1),
      }))
      .sort((a, b) => b.games - a.games);

    // Roles played
    const roleMap = {};
    matches.forEach(m => {
      if (!m.role || !ROLE_LABELS[m.role]) return;
      if (!roleMap[m.role]) roleMap[m.role] = { games: 0, wins: 0 };
      roleMap[m.role].games++;
      if (m.win) roleMap[m.role].wins++;
    });

    return { wins, losses, avgKDA, avgCs, avgVision, champStats, roleMap, totalKills, totalDeaths, totalAssists };
  }, [matches]);

  // Conseils calculés (remplace l'appel IA) : comparaison aux médianes Challenger / GM / Master du poste
  // (builds.json du coach, champ « targets »), et champions solides du patch pour compléter le pool.
  const fetchAiTips = () => {
    if (!stats) return;
    setAiTips(buildTips(stats, matches, champions));
  };

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <TrendingUp className="w-12 h-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucune donnée disponible.<br />Charge ton historique d'abord.</p>
      </div>
    );
  }

  const wr = Math.round((stats.wins / (stats.wins + stats.losses)) * 100);
  const mainRole = stats.champStats[0]?.role || '';
  const isSupport = mainRole === 'UTILITY';
  const isJungle = mainRole === 'JUNGLE';

  // Role-aware thresholds
  const csColor = isSupport
    ? 'text-muted-foreground'
    : parseFloat(stats.avgCs) >= 7 ? 'text-green-win' : parseFloat(stats.avgCs) >= 5.5 ? 'text-blue-info' : 'text-red-lose';
  const csLabel = isSupport ? 'CS/min (Support)' : isJungle ? 'CS+Jungle/min' : 'CS/min';
  const csSub = isSupport ? 'Non prioritaire' : isJungle ? 'Objectif ≥ 5.5' : 'Objectif ≥ 7';
  const visionColor = isSupport
    ? (stats.avgVision >= 40 ? 'text-green-win' : stats.avgVision >= 30 ? 'text-blue-info' : 'text-red-lose')
    : (stats.avgVision >= 25 ? 'text-green-win' : stats.avgVision >= 18 ? 'text-blue-info' : 'text-red-lose');
  const visionSub = isSupport ? 'Objectif ≥ 40 (Support)' : 'Objectif ≥ 20 (Laner)';

  return (
    <div className="space-y-4 pb-10">
      {/* Global stats */}
      <div>
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Statistiques globales</p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Winrate"
            value={`${wr}%`}
            sub={`${stats.wins}V / ${stats.losses}D`}
            color={wr >= 55 ? 'text-green-win' : wr >= 50 ? 'text-blue-info' : 'text-red-lose'}
          />
          <StatCard label="KDA Moyen" value={stats.avgKDA} sub={`${(stats.totalKills / matches.length).toFixed(1)} / ${(stats.totalDeaths / matches.length).toFixed(1)} / ${(stats.totalAssists / matches.length).toFixed(1)}`} />
          <StatCard label={csLabel} value={isSupport ? '-' : stats.avgCs} sub={csSub} color={csColor} />
          <StatCard label="Vision Moyen" value={stats.avgVision} sub={visionSub} color={visionColor} />
        </div>
      </div>

      {/* Champions played */}
      <div>
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Champions joués</p>
        <div className="glass rounded-xl border border-border px-3 py-1">
          {stats.champStats.map(champ => (
            <ChampionPoolCard key={champ.championName} champ={champ} ddVersion={ddVersion} />
          ))}
        </div>
      </div>

      {/* AI Analysis */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Analyse & conseils</p>
          {!aiTips && !loadingTips && (
            <button
              onClick={fetchAiTips}
              className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl font-semibold"
            >
              Analyser
            </button>
          )}
        </div>

        {loadingTips && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Analyse en cours…</span>
          </div>
        )}

        {aiTips && (
          <div className="space-y-2">
            {aiTips.csAdvice && (
              <TipCard icon={Target} title="Farming (CS)" text={aiTips.csAdvice} color="text-yellow-400" />
            )}
            {aiTips.visionAdvice && (
              <TipCard icon={AlertTriangle} title="Vision & Wards" text={aiTips.visionAdvice} color="text-blue-info" />
            )}
            {aiTips.kdaAdvice && (
              <TipCard icon={TrendingUp} title="KDA & Régularité" text={aiTips.kdaAdvice} color="text-green-win" />
            )}
            {aiTips.globalAdvice && (
              <TipCard icon={Trophy} title="Conseil global" text={aiTips.globalAdvice} color="text-gold" />
            )}
            {aiTips.source && <p className="text-[10px] text-muted-foreground italic leading-snug">{aiTips.source}</p>}
            {aiTips.poolSuggestions && aiTips.poolSuggestions.length > 0 && (
              <div className="glass rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold">Champions à ajouter au pool</span>
                </div>
                <div className="space-y-2">
                  {aiTips.poolSuggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${s.championId || s.championName}.png`}
                        alt={s.championName}
                        className="w-8 h-8 rounded border border-border shrink-0 mt-0.5"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      <div>
                        <span className="text-xs font-semibold">{s.championName}</span>
                        <p className="text-[11px] text-muted-foreground">{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}