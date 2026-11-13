// Historique de parties via le relais Riot (worker/ de ce dépôt, Cloudflare Worker).
// Remplace la fonction Base44 getMatchHistory. La clé Riot reste dans le worker, jamais ici.
// Routes utilisées : /matches (existe), /match?lite=2 (worker/riot-proxy.js),
// /rank (patch proposé). Sans le patch, /match renvoie la partie complète (avec chronologie) : ça marche, en plus lourd.
import { DD, DATA, norm } from '@/lib/gameData';
import { getSettings } from '@/lib/localStore';

const ERRORS = {
  account_not_found: 'Riot ID introuvable : vérifie le pseudo et le tag.',
  origin_not_allowed: "Le relais refuse cette adresse (ALLOWED_ORIGIN du worker).",
  missing_key: "Le relais n'a pas de clé Riot configurée.",
  riot_error: "L'API Riot a refusé la demande (clé expirée ou limite atteinte).",
  bad_request: 'Demande invalide.',
};

// Limite de la clé Riot (environ 100 demandes / 2 min, partagée avec la collecte automatique des builds)
export function limitMessage(r, action = 'appuie de nouveau sur Actualiser') {
  const s = Math.ceil(Number(r && r.headers && r.headers.get('Retry-After')) || 0);
  const wait = s > 90 ? 'dans ' + Math.ceil(s / 60) + ' min' : s > 0 ? 'dans ' + s + ' s' : 'dans 1 ou 2 minutes';
  return 'Limite de l\'API Riot atteinte : ' + action + ' ' + wait + '.';
}

// « il y a 5 min (13/11 à 16:02) » : date des dernières données Riot affichées
export function updatedFr(ts) {
  if (!ts) return 'jamais';
  const d = new Date(ts), m = Math.round((Date.now() - ts) / 60000);
  const ago = m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
  const day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), hour = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${ago} (${day} à ${hour})`;
}

export async function relay(path, params) {
  const s = getSettings();
  const u = new URL(s.relay.replace(/\/$/, '') + path);
  Object.entries({ platform: s.platform, ...params }).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, v); });
  // Un seul essai : l'API Riot n'est appelée que quand le joueur appuie sur un bouton, jamais en réessai automatique
  let r;
  try { r = await fetch(u.toString()); } catch (e) { throw new Error('Relais Riot injoignable (' + s.relay + ').'); }
  let body = null; try { body = await r.json(); } catch (e) { /* rien */ }
  if (!r.ok) {
    const code = body && body.error;
    const err = new Error(r.status === 429 ? limitMessage(r) + ' Ce qui était déjà chargé est gardé.' : (ERRORS[code] || ('Erreur du relais (' + r.status + ').')));
    err.code = code; err.status = r.status; throw err;
  }
  return body;
}

const fmtDur = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
function champIcon(name) {
  const v = DATA.version;
  const c = DATA.champs[name] || Object.values(DATA.champs).find(x => norm(x.id) === norm(name) || norm(x.name) === norm(name));
  return { id: c ? c.id : name, name: c ? c.name : name, icon: v ? `${DD}/cdn/${v}/img/champion/${c ? c.id : name}.png` : '' };
}

function toMatch(m, puuid) {
  const ps = m.participants || [];
  const me = ps.find(p => p.puuid === puuid);
  if (!me) return null;
  const min = Math.max(1, (m.gameDuration || 0) / 60);
  const cs = (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0);
  const ch = me.challenges || {};
  const teamDmg = ps.filter(p => p.teamId === me.teamId).reduce((s, p) => s + (p.totalDamageDealtToChampions || 0), 0);
  const row = p => { const c = champIcon(p.championName); return { championName: c.name, championId: c.id, championIcon: c.icon, summonerName: p.riotIdGameName || null, kills: p.kills, deaths: p.deaths, assists: p.assists, isMe: p.puuid === puuid, role: p.teamPosition }; };
  const c = champIcon(me.championName);
  return {
    matchId: m.id, win: !!me.win, championName: c.name, championId: c.id, championIcon: c.icon,
    level: me.champLevel, gameDuration: fmtDur(m.gameDuration || 0), durationMin: min, role: me.teamPosition || '',
    kills: me.kills, deaths: me.deaths, assists: me.assists, cs, csPerMin: (cs / min).toFixed(1),
    visionScore: me.visionScore || 0, vspm: (me.visionScore || 0) / min,
    ctrlWards: me.detectorWardsPlaced != null ? me.detectorWardsPlaced : (me.visionWardsBoughtInGame || 0),
    wardsKilled: me.wardsKilled || 0,
    kp: ch.killParticipation != null ? ch.killParticipation : null,
    dmgShare: ch.teamDamagePercentage != null ? ch.teamDamagePercentage : (teamDmg ? (me.totalDamageDealtToChampions || 0) / teamDmg : null),
    items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6].filter(Boolean),
    allies: ps.filter(p => p.teamId === me.teamId).map(row),
    enemies: ps.filter(p => p.teamId !== me.teamId).map(row),
    damageDealt: me.totalDamageDealtToChampions, goldEarned: me.goldEarned,
    gameDate: m.gameCreation ? new Date(m.gameCreation).toLocaleDateString('fr-FR') : '',
  };
}

// known : parties déjà affichées (cache du profil) ; elles ne sont pas retéléchargées, seules les nouvelles coûtent un appel
export async function fetchMatchHistory(riotId, count = 10, onProgress, known = []) {
  const { puuid, ids } = await relay('/matches', { riotId, count });
  const list = (ids || []).slice(0, count);
  const have = {}; (known || []).forEach(m => { if (m && m.matchId) have[m.matchId] = m; });
  const out = [];
  let i = 0;
  // 2 parties à la fois : reste sous la limite de l'API Riot (clé de développement)
  async function worker() {
    while (i < list.length) {
      const id = list[i++];
      try {
        const x = have[id] || toMatch(await relay('/match', { id, lite: 2 }), puuid);
        if (x) out.push({ x, at: list.indexOf(id) });
      } catch (e) { if (e.status === 429) { i = list.length; throw e; } }
      if (onProgress) onProgress(out.length, list.length);
    }
  }
  await Promise.all([worker(), worker()]);
  return { puuid, matches: out.sort((a, b) => a.at - b.at).map(o => o.x) };
}

// Rang classé : route /rank (patch du worker). Sans elle, ou en cas d'erreur, on renvoie null (le rang déjà affiché est gardé).
export async function fetchRank(puuid) {
  try { const r = await relay('/rank', { puuid }); return r.entries || []; } catch (e) { return null; }
}

// Partie complète avec la chronologie (route /match sans « lite », 2 appels Riot) : sert à l'analyse du profil
export async function fetchFullMatch(id) {
  return relay('/match', { id });
}
// Liste des dernières parties classées (ids) et puuid du joueur
export async function fetchMatchIds(riotId, count = 50) {
  return relay('/matches', { riotId, count });
}
