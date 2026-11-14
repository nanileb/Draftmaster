import React, { useState, useEffect, useCallback } from 'react';
import { fetchMatchHistory, fetchRank, updatedFr } from '@/lib/riot';
import { getSettings, setSettings, getProfile, setProfile, getHistoryCache, setHistoryCache } from '@/lib/localStore';
import { RELAY_DEFAULT } from '@/lib/gameData';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import {
  User, Edit2, Check, X, RefreshCw, Loader2,
  Sword, Shield, BookUser, ChevronDown, ChevronUp,
  BarChart2, Clock, Medal, Settings, Crosshair, Crown, ThumbsDown, Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FullAnalysisTab from '@/components/profile/FullAnalysisTab';
import LastGameTab from '@/components/profile/LastGameTab';
import { RIOT_TO_ROLE } from '@/lib/coachAnalysis';
import PcLinkPanel from '@/components/PcLinkPanel';

const TIER_COLORS = {
  IRON: 'text-stone-400', BRONZE: 'text-amber-700', SILVER: 'text-slate-300',
  GOLD: 'text-yellow-400', PLATINUM: 'text-emerald-400', EMERALD: 'text-emerald-300',
  DIAMOND: 'text-blue-info', MASTER: 'text-purple-400', GRANDMASTER: 'text-red-lose', CHALLENGER: 'text-gold',
};
const QUEUE_LABELS = { RANKED_SOLO_5x5: 'Solo/Duo', RANKED_FLEX_SR: 'Flex' };

function EloDisplay({ rankedStats }) {
  if (!rankedStats || rankedStats.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {rankedStats.map(q => {
        const label = QUEUE_LABELS[q.queueType] || q.queueType;
        const tierColor = TIER_COLORS[q.tier] || 'text-foreground';
        const wr = Math.round((q.wins / (q.wins + q.losses)) * 100);
        return (
          <div key={q.queueType} className="flex items-center gap-2 bg-secondary/60 border border-border rounded-xl px-3 py-2 flex-1 min-w-0">
            <Medal className={cn('w-4 h-4 shrink-0', tierColor)} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn('text-sm font-bold capitalize', tierColor)}>
                  {q.tier.charAt(0) + q.tier.slice(1).toLowerCase()} {q.rank}
                </span>
                <span className="text-[11px] text-muted-foreground">{q.leaguePoints} LP</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{label}</span>
                <span>•</span>
                <span>{q.wins}V {q.losses}D</span>
                <span>•</span>
                <span className={wr >= 50 ? 'text-green-win' : 'text-red-lose'}>{wr}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ROLE_LABELS = {
  TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', MIDDLE: 'Mid', BOTTOM: 'ADC',
  UTILITY: 'Support', NONE: '', '': '',
};

function KDABadge({ kills, deaths, assists }) {
  const kda = deaths === 0 ? kills + assists : ((kills + assists) / deaths).toFixed(2);
  const kdaNum = parseFloat(kda);
  return (
    <span className={cn(
      'text-xs font-bold',
      kdaNum >= 4 ? 'text-yellow-400' : kdaNum >= 3 ? 'text-green-win' : kdaNum >= 2 ? 'text-blue-info' : 'text-muted-foreground'
    )}>
      {kda} KDA
    </span>
  );
}

function ItemIcon({ itemId, ddVersion }) {
  if (!itemId) return null;
  return (
    <img
      src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png`}
      alt=""
      className="w-6 h-6 rounded"
      onError={e => { e.target.style.display = 'none'; }}
    />
  );
}

// Classement 1 à 10 de la partie (lib/gameRanking.js) : 1 = le plus utile, 10 = le moins utile
const rankColor = r => r === 1 ? 'bg-gold text-background' : r <= 3 ? 'bg-green-win/80 text-background'
  : r >= 10 ? 'bg-red-lose text-white' : r >= 8 ? 'bg-red-lose/30 text-red-lose' : 'bg-secondary text-muted-foreground';
const rankText = r => r === 1 ? 'MVP' : r === 10 ? 'Dernier' : r + 'e';

function RankBadge({ rank, className }) {
  if (!rank) return null;
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md text-[10px] font-bold min-w-[18px] h-[18px] px-1 shrink-0', rankColor(rank), className)}>
      {rank}
    </span>
  );
}

function ParticipantRow({ p, ddVersion }) {
  return (
    <div className={cn('flex items-center gap-1.5 py-1', p.isMe && 'font-semibold')}>
      <RankBadge rank={p.rank} />
      <img
        src={p.championIcon}
        alt={p.championName}
        className={cn('w-6 h-6 rounded shrink-0', p.isMe && 'ring-1 ring-primary')}
        onError={e => { e.target.style.display = 'none'; }}
      />
      <span className={cn('text-[11px] flex-1 min-w-0 truncate', p.isMe ? 'text-primary' : 'text-muted-foreground')}>
        {p.summonerName || p.championName}
      </span>
      <span className="text-[11px] text-muted-foreground shrink-0">
        {p.kills}/{p.deaths}/{p.assists}
      </span>
    </div>
  );
}

// Les 10 joueurs du plus utile au moins utile, avec la note sur 10 et ce qui l'explique
function GameRanking({ match }) {
  const all = [...match.allies.map(p => ({ ...p, ally: true })), ...match.enemies.map(p => ({ ...p, ally: false, isMe: false }))]
    .filter(p => p.rank).sort((a, b) => a.rank - b.rank);
  if (all.length < 2) return null;
  const top = all[0], last = all[all.length - 1];
  const who = p => (p.isMe ? 'Toi' : (p.summonerName || p.championName)) + ' (' + p.championName + ')';
  return (
    <div className="mt-3 pt-2 border-t border-border">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-2 py-1.5 min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-gold uppercase tracking-wider"><Crown className="w-3 h-3" />Le plus utile</div>
          <div className="text-xs font-bold truncate">{who(top)}</div>
          <div className="text-[10px] text-muted-foreground truncate">{top.score}/10{top.best.length ? ' · ' + top.best.join(', ') : ''}</div>
        </div>
        <div className="rounded-lg border border-red-lose/40 bg-red-lose/10 px-2 py-1.5 min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-red-lose uppercase tracking-wider"><ThumbsDown className="w-3 h-3" />Le moins utile</div>
          <div className="text-xs font-bold truncate">{who(last)}</div>
          <div className="text-[10px] text-muted-foreground truncate">{last.score}/10{last.worst.length ? ' · ' + last.worst.join(', ') : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <Trophy className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Classement de la partie</span>
      </div>
      {all.map(p => (
        <div key={p.rank} className={cn('flex items-center gap-1.5 py-1', p.isMe && 'bg-primary/10 rounded-md -mx-1 px-1')}>
          <RankBadge rank={p.rank} />
          <img src={p.championIcon} alt={p.championName}
            className={cn('w-6 h-6 rounded shrink-0 border', p.ally ? 'border-blue-info/60' : 'border-red-lose/60')}
            onError={e => { e.target.style.display = 'none'; }} />
          <div className="flex-1 min-w-0">
            <div className={cn('text-[11px] truncate', p.isMe ? 'text-primary font-semibold' : 'text-foreground')}>
              {p.isMe ? 'Toi' : (p.summonerName || p.championName)}
              <span className="text-muted-foreground font-normal"> · {ROLE_LABELS[p.role] || p.championName}</span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {p.best.length ? '+ ' + p.best.join(', ') : ''}{p.best.length && p.worst.length ? '  ' : ''}{p.worst.length ? '− ' + p.worst.join(', ') : ''}
            </div>
          </div>
          <div className="w-14 shrink-0 text-right">
            <div className="text-[11px] font-bold">{p.score}<span className="text-muted-foreground font-normal">/10</span></div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div className={cn('h-full', p.rank === 1 ? 'bg-gold' : p.rank <= 3 ? 'bg-green-win' : p.rank >= 8 ? 'bg-red-lose' : 'bg-blue-info')} style={{ width: (p.score * 10) + '%' }} />
            </div>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground mt-1">
        Note comparée à ce qu'on attend du poste : KDA, morts, participation aux kills, dégâts, golds, farm, vision, objectifs, et pour un support les soins, boucliers et contrôles.
      </p>
    </div>
  );
}

function MatchCard({ match, ddVersion }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      match.win ? 'border-green-win/40 bg-green-win/5' : 'border-red-lose/40 bg-red-lose/5'
    )}>
      {/* Main row */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Champion icon */}
        <div className="relative shrink-0">
          <img
            src={match.championIcon}
            alt={match.championName}
            className="w-12 h-12 rounded-xl object-cover border border-border"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <span className="absolute -bottom-1 -right-1 text-[11px] bg-card rounded px-0.5 font-bold border border-border">
            {match.level}
          </span>
        </div>

        {/* Middle info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold', match.win ? 'text-green-win' : 'text-red-lose')}>
              {match.win ? 'Victoire' : 'Défaite'}
            </span>
            <span className="text-[11px] text-muted-foreground">{match.gameDuration}</span>
            {match.role && ROLE_LABELS[match.role] && (
              <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                {ROLE_LABELS[match.role]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-bold">
              {match.kills}/{match.deaths}/{match.assists}
            </span>
            <KDABadge kills={match.kills} deaths={match.deaths} assists={match.assists} />
            {match.myRank && (
              <span className={cn('ml-auto text-[10px] font-bold rounded-md px-1.5 py-0.5', rankColor(match.myRank))}>
                {rankText(match.myRank)}{match.myRank !== 1 && match.myRank !== 10 ? ' / 10' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">{match.cs} CS ({match.csPerMin}/min)</span>
            <span className="text-[11px] text-muted-foreground">Vision: {match.visionScore}</span>
          </div>
        </div>

        {/* Right: items + expand */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex gap-0.5 flex-wrap justify-end max-w-[80px]">
            {match.items.map((item, i) => (
              <ItemIcon key={i} itemId={item} ddVersion={ddVersion} />
            ))}
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Expanded: allies vs enemies */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Shield className="w-3 h-3 text-blue-info" />
                <span className="text-[11px] font-semibold text-blue-info uppercase tracking-wider">Alliés</span>
              </div>
              {match.allies.map((p, i) => (
                <ParticipantRow key={i} p={p} ddVersion={ddVersion} />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Sword className="w-3 h-3 text-red-lose" />
                <span className="text-[11px] font-semibold text-red-lose uppercase tracking-wider">Ennemis</span>
              </div>
              {match.enemies.map((p, i) => (
                <ParticipantRow key={i} p={{ ...p, isMe: false }} ddVersion={ddVersion} />
              ))}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex gap-4 text-[11px] text-muted-foreground">
            <span>Dégâts: {match.damageDealt?.toLocaleString()}</span>
            <span>Or: {match.goldEarned?.toLocaleString()}</span>
            <span>{match.gameDate}</span>
          </div>
          <GameRanking match={match} />
        </div>
      )}
    </div>
  );
}

const PLATFORMS = [['euw1', 'EUW'], ['eun1', 'EUNE'], ['tr1', 'TR'], ['na1', 'NA'], ['kr', 'KR'], ['br1', 'BR'], ['jp1', 'JP']];

// Réglages (pas de compte) : pseudo de partage, serveur, adresse du relais Riot
function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({ ...getSettings(), name: getProfile().name || '' }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    setProfile({ ...getProfile(), name: form.name.trim().slice(0, 24) });
    setSettings({ relay: form.relay.trim() || RELAY_DEFAULT, platform: form.platform });
    toast.success('Réglages enregistrés');
  };
  const field = 'w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary';
  return (
    <div className="glass rounded-xl border border-border mt-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 p-3 text-left">
        <Settings className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">Réglages</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Pseudo affiché quand tu partages ton pool</span>
            <input className={field} value={form.name} maxLength={24} onChange={e => set('name', e.target.value)} placeholder="Ton pseudo" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Serveur</span>
            <select className={field} value={form.platform} onChange={e => set('platform', e.target.value)}>
              {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Relais Riot</span>
            <input className={field} value={form.relay} onChange={e => set('relay', e.target.value)} placeholder={RELAY_DEFAULT} />
          </label>
          <button onClick={save} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Enregistrer</button>
          <p className="text-[11px] text-muted-foreground leading-snug">Tout est gardé dans ce navigateur. La clé Riot reste dans le relais, jamais dans l'application.</p>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { champions, version } = useOutletContext();
  const navigate = useNavigate();

  const [riotId, setRiotId] = useState(() => localStorage.getItem('riotId') || '');
  const [editRiotId, setEditRiotId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  // Dernières données Riot gardées dans ce navigateur : affichées telles quelles, l'API n'est appelée que sur Actualiser
  const cached = () => { const c = getHistoryCache(); return c && c.riotId === (localStorage.getItem('riotId') || '') ? c : null; };
  const [matches, setMatches] = useState(() => (cached() || {}).matches || []);
  const [rankedStats, setRankedStats] = useState(() => (cached() || {}).rank || []);
  const [updatedAt, setUpdatedAt] = useState(() => (cached() || {}).at || 0);
  const ddVersion = version || '14.1.1';
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTabState] = useState(() => { try { const t = localStorage.getItem('dm_profile_tab'); return ['history', 'analysis', 'last'].includes(t) ? t : 'history'; } catch (e) { return 'history'; } });
  const setActiveTab = t => { setActiveTabState(t); try { localStorage.setItem('dm_profile_tab', t); } catch (e) { /* rien */ } };
  const [refreshKey, setRefreshKey] = useState(0);
  // Poste le plus joué dans l'historique : poste proposé par défaut pour l'analyse complète
  const mainRole = React.useMemo(() => {
    const n = {}; matches.forEach(m => { const r = RIOT_TO_ROLE[m.role]; if (r) n[r] = (n[r] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
  }, [matches]);

  const fetchHistory = useCallback(async (id) => {
    const parts = id.split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const c = getHistoryCache();
      const same = c && c.riotId === id;
      // Parties déjà affichées : pas retéléchargées, seules les nouvelles coûtent un appel Riot
      const res = await fetchMatchHistory(parts[0].trim() + '#' + parts[1].trim(), 10, (d, t) => setProgress(`${d}/${t}`), same ? c.matches : []);
      const rank = await fetchRank(res.puuid);
      const keepRank = rank || (same ? c.rank || [] : []);
      const at = Date.now();
      setMatches(res.matches);
      setRankedStats(keepRank);
      setUpdatedAt(at);
      setHistoryCache({ riotId: id, matches: res.matches, rank: keepRank, at });
    } catch (e) {
      setError(e.message || 'Erreur lors de la récupération de l\'historique');
    }
    setProgress(null);
    setLoading(false);
  }, []);

  const handleSaveRiotId = () => {
    if (!editRiotId.includes('#')) return;
    if (editRiotId === riotId) { setIsEditing(false); return; }
    localStorage.setItem('riotId', editRiotId);
    setRiotId(editRiotId);
    setIsEditing(false);
    // Nouveau pseudo validé : on charge son historique une fois (c'est un appui du joueur), l'ancien n'est plus affiché
    setMatches([]); setRankedStats([]); setUpdatedAt(0); setError(null);
    fetchHistory(editRiotId);
  };

  return (
    <div className="flex flex-col bg-background" style={{ minHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-grotesk font-bold text-xl">Mon Profil</h1>
          <button
            onClick={() => navigate('/pool')}
            className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-xl border border-primary/20"
          >
            <BookUser className="w-3.5 h-3.5" />
            Mon Pool
          </button>
        </div>

        {/* Riot ID */}
        <div className="glass rounded-xl p-3 border border-border">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                type="text"
                value={editRiotId}
                onChange={e => setEditRiotId(e.target.value)}
                placeholder="Pseudo#EUW"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={e => { if (e.key === 'Enter') handleSaveRiotId(); if (e.key === 'Escape') setIsEditing(false); }}
              />
              <button onClick={handleSaveRiotId} className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-lg bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              {riotId ? (
                <>
                  <div className="flex-1">
                    <span className="text-sm font-semibold">{riotId.split('#')[0]}</span>
                    <span className="text-sm text-muted-foreground">#{riotId.split('#')[1]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { fetchHistory(riotId); if (activeTab === 'last') setRefreshKey(k => k + 1); }}
                      disabled={loading}
                      aria-label="Actualiser depuis Riot"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-semibold"
                    >
                      <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                      Actualiser
                    </button>
                    <button
                      onClick={() => { setEditRiotId(riotId); setIsEditing(true); }}
                      className="p-1.5 rounded-lg bg-secondary text-muted-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { setEditRiotId(''); setIsEditing(true); }}
                  className="flex-1 text-left text-sm text-muted-foreground py-3"
                >
                  Ajouter ton Riot ID (Pseudo#EUW)
                </button>
              )}
            </div>
          )}
        </div>
        {rankedStats.length > 0 && <EloDisplay rankedStats={rankedStats} />}
        {riotId && !isEditing && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {loading ? 'Actualisation depuis Riot…' : updatedAt ? `Historique et rang mis à jour ${updatedFr(updatedAt)}` : 'Pas encore chargé : appuie sur Actualiser.'}
          </p>
        )}
      </div>



      {/* Onglets */}
      {riotId && (
        <div className="grid grid-cols-3 border-b border-border px-2">
          {[['history', Clock, 'Historique'], ['analysis', BarChart2, 'Analyse complète'], ['last', Crosshair, 'Dernière game']].map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-1 py-2 min-h-[52px] text-[12px] leading-tight font-medium border-b-2 transition-colors',
                activeTab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-center">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!riotId && !isEditing && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-grotesk font-semibold text-base">Connecte ton compte LoL</p>
              <p className="text-muted-foreground text-sm mt-1">Ajoute ton Riot ID pour voir ton historique de parties</p>
            </div>
            <button
              onClick={() => { setEditRiotId(''); setIsEditing(true); }}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm"
            >
              Ajouter mon Riot ID
            </button>
          </div>
        )}

        {loading && activeTab === 'history' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement de l'historique…{progress ? ` (${progress})` : ''}</p>
          </div>
        )}

        {error && (
          <div className="glass rounded-xl p-4 border border-destructive/30 bg-destructive/5 text-center">
            <p className="text-sm text-destructive">{error}</p>
            {!/^Limite/.test(error) && <p className="text-xs text-muted-foreground mt-1">Vérifie ton Riot ID et réessaie</p>}
          </div>
        )}

        {!loading && activeTab === 'history' && (
          <>
            {matches.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {matches.length} dernières parties
                </p>
                {matches.map(match => (
                  <MatchCard key={match.matchId} match={match} ddVersion={ddVersion} />
                ))}
              </>
            )}
            {!error && riotId && matches.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {updatedAt ? 'Aucune partie classée trouvée.' : 'Appuie sur Actualiser, à côté de ton pseudo, pour charger tes dernières parties.'}
              </div>
            )}
          </>
        )}

        {riotId && activeTab === 'analysis' && (
          <FullAnalysisTab key={riotId} riotId={riotId} defaultRole={mainRole} />
        )}

        {riotId && activeTab === 'last' && (
          <LastGameTab key={riotId} riotId={riotId} refreshKey={refreshKey} />
        )}

        <PcLinkPanel />
        <SettingsPanel />
      </div>
    </div>
  );
}