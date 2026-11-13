// Partie en cours : route /live du relais Riot (spectator v5). Port de loadLive du coach LoL.
// Les postes sont devinés (Châtiment, profils, postes joués chez les meilleurs joueurs) puis revalidés par le joueur.
import { meta, tags, dataRoles } from '@/lib/gameData';
import { getSettings } from '@/lib/localStore';
import { limitMessage } from '@/lib/riot';

const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

export function getRiotId() { try { return localStorage.getItem('riotId') || ''; } catch (e) { return ''; } }

function roleScore(id, spells, role) {
  const M = meta(), t = tags(id), smite = spells.includes(11), dr = dataRoles(id);
  const played = dr[0] === role ? 8 : dr.includes(role) ? 4 : 0;
  if (role === 'JUNGLE') return (smite ? 100 : 0) + ((M.junglers || {})[id] ? 6 : 0) + played;
  let v = (smite ? -60 : 0) + played;
  if (role === 'SUPPORT') v += (M.supports[id] ? 10 : 0) + (t.includes('Support') ? 6 : 0) + (spells.includes(3) ? 3 : 0);
  if (role === 'ADC') v += (M.adcs[id] ? 10 : 0) + (t.includes('Marksman') ? 6 : 0) + (spells.includes(7) ? 4 : 0);
  if (role === 'MID') v += (t.includes('Mage') ? 6 : 0) + (t.includes('Assassin') ? 5 : 0);
  if (role === 'TOP') v += (t.includes('Fighter') ? 6 : 0) + (t.includes('Tank') ? 5 : 0) + (spells.includes(12) ? 3 : 0);
  return v;
}
// Meilleure répartition des champions sur les postes libres (toutes les permutations : 5! = 120 au plus)
function assignRoles(list, roles) {
  let best = null, bestV = -1e9;
  const used = [], acc = [];
  const perm = () => {
    if (acc.length === list.length) {
      const v = acc.reduce((s, r, i) => s + roleScore(list[i].id, list[i].spells, r), 0);
      if (v > bestV) { bestV = v; best = acc.slice(); }
      return;
    }
    roles.forEach((r, i) => { if (!used[i]) { used[i] = true; acc.push(r); perm(); acc.pop(); used[i] = false; } });
  };
  perm();
  const out = {}; (best || []).forEach((r, i) => { out[r] = list[i].id; }); return out;
}

// myRole : poste choisi par le joueur ; null = deviné avec le reste de l'équipe
export async function fetchLiveGame(champions, myRole = null) {
  const s = getSettings(), riotId = getRiotId();
  if (!/.+#.+/.test(riotId)) { const e = new Error('Renseigne ton Riot ID (Pseudo#TAG) dans l\'onglet Profil pour charger ta partie.'); e.code = 'no_riot_id'; throw e; }
  let r;
  try { r = await fetch(`${s.relay.replace(/\/+$/, '')}/live?riotId=${encodeURIComponent(riotId)}&platform=${encodeURIComponent(s.platform)}`); }
  catch (e) { throw new Error('Relais Riot injoignable : vérifie ta connexion.'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error(j.error === 'account_not_found' ? 'Compte introuvable : vérifie le Riot ID et le serveur dans ton profil.' : 'Pas de partie en cours pour l\'instant. Réessaie une fois l\'écran de chargement affiché.');
  if (r.status === 429) throw new Error(limitMessage(r, 'appuie de nouveau sur le bouton'));
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Clé Riot refusée ou expirée : il faut la mettre à jour dans le relais Cloudflare.' : 'Erreur du relais (' + r.status + ').');
  const g = j.game || {};
  const byKey = {}; champions.forEach(c => { byKey[String(c.key)] = c; });
  const P = (g.participants || []).map(p => ({ id: byKey[String(p.championId)] ? byKey[String(p.championId)].id : null, team: p.teamId, spells: [p.spell1Id, p.spell2Id], puuid: p.puuid }));
  const meP = P.find(p => p.puuid === j.puuid) || P[0];
  if (!meP) throw new Error('Partie trouvée mais illisible : réessaie dans un instant.');
  const mine = P.filter(p => p.team === meP.team && p.id), theirs = P.filter(p => p.team !== meP.team && p.id);
  // Mon poste : celui choisi, sinon deviné avec toute l'équipe
  let role = myRole;
  let ally;
  if (role) {
    ally = assignRoles(mine.filter(p => p !== meP), ROLES.filter(x => x !== role));
    if (meP.id) ally[role] = meP.id;
  } else {
    ally = assignRoles(mine, ROLES);
    role = Object.keys(ally).find(k => ally[k] === meP.id) || 'MID';
  }
  const enemy = assignRoles(theirs, ROLES);
  const start = Number(g.gameStartTime) || 0, len = Number(g.gameLength) || 0;
  // Chrono : durée annoncée par Riot (comme le coach), sinon depuis le début réel ; 0 pendant l'écran de chargement
  const elapsed = len > 0 ? len : start > 0 ? Math.max(0, (Date.now() - start) / 1000) : 0;
  const byId = Object.fromEntries(champions.map(c => [c.id, c]));
  const toObj = o => Object.fromEntries(ROLES.map(r => [r, o[r] ? byId[o[r]] || null : null]));
  return {
    role, me: meP.id ? byId[meP.id] : null, side: meP.team === 100 ? 'blue' : 'red',
    allyByRole: toObj(ally), enemyByRole: toObj(enemy), elapsed, riotId,
  };
}
