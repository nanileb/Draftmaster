import React, { useState, useEffect, useCallback } from 'react';
import { fetchMatchHistory, fetchRank } from '@/lib/riot';
import { getSettings, setSettings, getProfile, setProfile } from '@/lib/localStore';
import { COACH_BASE_DEFAULT, RELAY_DEFAULT } from '@/lib/gameData';
import { loadCoachData } from '@/lib/dataLoader';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import {
  User, Edit2, Check, X, RefreshCw, Loader2,
  Sword, Shield, BookUser, ChevronDown, ChevronUp,
  BarChart2, Clock, Medal, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AnalysisTab from '@/components/profile/AnalysisTab';

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
                <span className="text-[10px] text-muted-foreground">{q.leaguePoints} LP</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
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

function ParticipantRow({ p, ddVersion }) {
  return (
    <div className={cn('flex items-center gap-1.5 py-1', p.isMe && 'font-semibold')}>
      <img
        src={p.championIcon}
        alt={p.championName}
        className={cn('w-6 h-6 rounded', p.isMe && 'ring-1 ring-primary')}
        onError={e => { e.target.style.display = 'none'; }}
      />
      <span className={cn('text-[10px] w-20 truncate', p.isMe ? 'text-primary' : 'text-muted-foreground')}>
        {p.summonerName || p.championName}
      </span>
      <span className="text-[10px] text-muted-foreground ml-auto">
        {p.kills}/{p.deaths}/{p.assists}
      </span>
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
          <span className="absolute -bottom-1 -right-1 text-[9px] bg-card rounded px-0.5 font-bold border border-border">
            {match.level}
          </span>
        </div>

        {/* Middle info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold', match.win ? 'text-green-win' : 'text-red-lose')}>
              {match.win ? 'Victoire' : 'Défaite'}
            </span>
            <span className="text-[10px] text-muted-foreground">{match.gameDuration}</span>
            {match.role && ROLE_LABELS[match.role] && (
              <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                {ROLE_LABELS[match.role]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-bold">
              {match.kills}/{match.deaths}/{match.assists}
            </span>
            <KDABadge kills={match.kills} deaths={match.deaths} assists={match.assists} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{match.cs} CS ({match.csPerMin}/min)</span>
            <span className="text-[10px] text-muted-foreground">Vision: {match.visionScore}</span>
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
                <span className="text-[10px] font-semibold text-blue-info uppercase tracking-wider">Alliés</span>
              </div>
              {match.allies.map((p, i) => (
                <ParticipantRow key={i} p={p} ddVersion={ddVersion} />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Sword className="w-3 h-3 text-red-lose" />
                <span className="text-[10px] font-semibold text-red-lose uppercase tracking-wider">Ennemis</span>
              </div>
              {match.enemies.map((p, i) => (
                <ParticipantRow key={i} p={{ ...p, isMe: false }} ddVersion={ddVersion} />
              ))}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex gap-4 text-[10px] text-muted-foreground">
            <span>Dégâts: {match.damageDealt?.toLocaleString()}</span>
            <span>Or: {match.goldEarned?.toLocaleString()}</span>
            <span>{match.gameDate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const PLATFORMS = [['euw1', 'EUW'], ['eun1', 'EUNE'], ['tr1', 'TR'], ['na1', 'NA'], ['kr', 'KR'], ['br1', 'BR'], ['jp1', 'JP']];

// Réglages (pas de compte) : pseudo de partage, serveur, adresses du relais Riot et des données du coach
function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({ ...getSettings(), name: getProfile().name || '' }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    setProfile({ ...getProfile(), name: form.name.trim().slice(0, 24) });
    setSettings({ relay: form.relay.trim() || RELAY_DEFAULT, coachBase: form.coachBase.trim() || COACH_BASE_DEFAULT, platform: form.platform });
    const errs = await loadCoachData();
    if (errs.length) toast.error('Données du coach indisponibles : ' + errs.join(', '));
    else toast.success('Réglages enregistrés');
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
            <span className="text-xs text-muted-foreground">Relais Riot (worker du coach)</span>
            <input className={field} value={form.relay} onChange={e => set('relay', e.target.value)} placeholder={RELAY_DEFAULT} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Données du coach (builds, counters, méta)</span>
            <input className={field} value={form.coachBase} onChange={e => set('coachBase', e.target.value)} placeholder={COACH_BASE_DEFAULT} />
          </label>
          <button onClick={save} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Enregistrer</button>
          <p className="text-[10px] text-muted-foreground leading-snug">Tout est gardé dans ce navigateur. La clé Riot reste dans le relais, jamais dans l'application.</p>
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
  const [matches, setMatches] = useState([]);
  const [rankedStats, setRankedStats] = useState([]);
  const ddVersion = version || '14.1.1';
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('history');

  const fetchHistory = useCallback(async (id) => {
    const parts = id.split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const res = await fetchMatchHistory(parts[0].trim() + '#' + parts[1].trim(), 10, (d, t) => setProgress(`${d}/${t}`));
      setMatches(res.matches);
      setRankedStats(await fetchRank(res.puuid));
    } catch (e) {
      setError(e.message || 'Erreur lors de la récupération de l\'historique');
    }
    setProgress(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (riotId) fetchHistory(riotId);
  }, []);

  const handleSaveRiotId = () => {
    if (!editRiotId.includes('#')) return;
    localStorage.setItem('riotId', editRiotId);
    setRiotId(editRiotId);
    setIsEditing(false);
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
                      onClick={() => fetchHistory(riotId)}
                      disabled={loading}
                      className="p-1.5 rounded-lg bg-secondary text-muted-foreground"
                    >
                      <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
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
                  className="flex-1 text-left text-sm text-muted-foreground"
                >
                  Ajouter ton Riot ID (Pseudo#EUW)
                </button>
              )}
            </div>
          )}
        </div>
        {rankedStats.length > 0 && <EloDisplay rankedStats={rankedStats} />}
      </div>



      {/* Tabs */}
      {riotId && (
        <div className="flex border-b border-border px-4">
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Historique
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'analysis'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            )}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Analyse
          </button>
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

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement de l'historique…{progress ? ` (${progress})` : ''}</p>
          </div>
        )}

        {error && (
          <div className="glass rounded-xl p-4 border border-destructive/30 bg-destructive/5 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">Vérifie ton Riot ID et réessaie</p>
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
                Aucune partie classée trouvée.
              </div>
            )}
          </>
        )}

        {!loading && activeTab === 'analysis' && (
          <AnalysisTab matches={matches} ddVersion={ddVersion} champions={champions} rankedStats={rankedStats} />
        )}

        <SettingsPanel />
      </div>
    </div>
  );
}