// Analyse du profil : résumés de parties gardés dans ce navigateur (clé dm_an), comme le coach LoL (an_sums).
// Une partie n'est téléchargée (avec sa chronologie) qu'une seule fois.
import { fetchMatchIds, fetchFullMatch } from '@/lib/riot';
import { summarize, SUM_VERSION, POS_OF } from '@/lib/coachAnalysis';

const KEY = 'dm_an';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* quota : on garde en mémoire */ } };

let mem = null;
export function getAnalysis() {
  if (!mem) { const o = read(); mem = { puuid: o.puuid || null, riotId: o.riotId || null, ids: o.ids || [], sums: o.sums || {}, updated: o.updated || 0 }; }
  return mem;
}
function save() {
  const A = getAnalysis(), keep = {};
  A.ids.forEach(id => { if (A.sums[id]) keep[id] = A.sums[id]; });
  A.sums = keep; write(A);
}
const sameId = (a, b) => String(a || '').toLowerCase().replace(/\s/g, '') === String(b || '').toLowerCase().replace(/\s/g, '');

// Parties analysées (les plus récentes d'abord)
export function analysedGames(riotId) {
  const A = getAnalysis();
  if (!sameId(A.riotId, riotId)) return [];
  return A.ids.map(id => A.sums[id]).filter(Boolean);
}

async function refreshIds(riotId) {
  const A = getAnalysis();
  const { puuid, ids } = await fetchMatchIds(riotId, 50);
  if (A.puuid !== puuid) { A.sums = {}; }
  A.puuid = puuid; A.riotId = riotId; A.ids = ids || [];
  save();
  return A;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function getSum(id, A, force) {
  const c = A.sums[id];
  if (c && c.v === SUM_VERSION && !force) return c;
  for (let tries = 0; tries < 3; tries++) {
    try {
      const s = summarize(await fetchFullMatch(id), A.puuid);
      if (s) { A.sums[id] = s; save(); }
      return s;
    } catch (e) {
      if (e.status === 429) { await wait(3000); continue; }
      if (e.status >= 500 || e.status === 404) return null;
      throw e;
    }
  }
  return null;
}

// Cherche jusqu'à 15 parties jouées au poste demandé (40 téléchargements au plus par passage)
export async function loadRoleGames(riotId, ROLE, onStatus, force = false) {
  const A = await refreshIds(riotId);
  const RP = POS_OF[ROLE], WANT = 15, MAXNEW = 40;
  let n = 0, found = 0;
  for (const id of A.ids) {
    if (found >= WANT) break;
    const c = A.sums[id];
    if (c && c.v === SUM_VERSION && !force) { if (c.pos === RP) found++; continue; }
    if (n >= MAXNEW) break;
    n++;
    if (onStatus) onStatus({ found, want: WANT, scanned: n });
    const s = await getSum(id, A, force);
    if (s && s.pos === RP) found++;
  }
  A.updated = Date.now(); save();
  return { found, total: A.ids.length };
}

// Dernière partie classée, quel que soit le poste
export async function loadLastGame(riotId) {
  const A = await refreshIds(riotId);
  if (!A.ids.length) return null;
  return getSum(A.ids[0], A);
}
