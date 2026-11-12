// Synchro des pools entre amis, sans compte, par le relais Cloudflare (routes /pool et /pools, espace KV « POOLS »).
// - Mon pool : envoyé au relais quand il change (seulement si j'ai déjà ouvert « Partager »).
// - Pools des amis : relus quand j'ouvre l'onglet Équipe ou que l'app revient au premier plan.
// Si le relais n'a pas encore ces routes, rien ne casse : les amis gardent la copie de leur lien.
import { getSettings, getIdentity, setIdentity, getPool, getProfile, poolIdsByRole, getPlayers, setPlayers, getSyncState, setSyncState } from '@/lib/localStore';

const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const base = () => getSettings().relay.replace(/\/$/, '');

async function call(method, path, body) {
  const r = await fetch(base() + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let j = null; try { j = await r.json(); } catch (e) { /* rien */ }
  if (!r.ok) { const e = new Error((j && j.error) || 'http_' + r.status); e.status = r.status; e.code = j && j.error; throw e; }
  return j;
}

// Envoie mon pool. Renvoie 'ok', 'skipped' (rien de neuf, ou jamais partagé) ou 'unavailable'.
export async function pushMyPool({ force = false } = {}) {
  let me = getIdentity();
  if (!me.shared && !force) return 'skipped';
  // Un partage ouvert active la synchro pour de bon, même si le relais ne répond pas tout de suite
  if (!me.shared) { me = { ...me, shared: true }; setIdentity(me); }
  const body = { key: me.key, n: (getProfile().name || '').slice(0, 24), p: poolIdsByRole(getPool()) };
  const sig = JSON.stringify([body.n, body.p]);
  const st = getSyncState();
  if (!force && st.lastSig === sig && st.ok) return 'skipped';
  try {
    await call('POST', '/pool?id=' + me.id, body);
    setSyncState({ lastSig: sig, ok: true, at: Date.now() });
    return 'ok';
  } catch (e) {
    setSyncState({ ok: false, error: e.code || e.message, at: Date.now() });
    return 'unavailable';
  }
}

export async function deleteMyPool() {
  const me = getIdentity();
  if (!me.shared) return;
  try { await call('DELETE', '/pool?id=' + me.id, { key: me.key }); } catch (e) { /* hors ligne : tant pis */ }
}

let timer = null;
export function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(() => { pushMyPool(); }, 1500);
}

let started = false;
export function startPoolSync() {
  if (started) return;
  started = true;
  window.addEventListener('pool-updated', schedulePush);
  window.addEventListener('profile-updated', schedulePush);
  schedulePush();
}

// Relit les pools des amis reliés (joueurs avec syncId) et met à jour ceux qui ont changé.
// champions : liste Data Dragon (id → nom). Renvoie le nombre d'amis mis à jour, ou null si le relais ne répond pas.
let lastRefresh = 0;
export async function refreshFriends(champions, { force = false } = {}) {
  if (!champions?.length) return 0;
  const list = getPlayers();
  const linked = list.filter(p => p.syncId);
  if (!linked.length) return 0;
  if (!force && Date.now() - lastRefresh < 20000) return 0;
  lastRefresh = Date.now();
  let res;
  try {
    const ids = [...new Set(linked.map(p => p.syncId))];
    const pools = {};
    for (let i = 0; i < ids.length; i += 30) Object.assign(pools, (await call('GET', '/pools?ids=' + ids.slice(i, i + 30).join(','))).pools || {});
    res = pools;
  } catch (e) { return null; }
  const byId = new Map(champions.map(c => [c.id, c.name]));
  let changed = 0;
  const now = Date.now();
  const next = list.map(p => {
    const r = p.syncId && res[p.syncId];
    if (!r) return p;
    const pools = {};
    ROLES.forEach(role => { pools[role] = (r.p?.[role] || []).map(id => byId.get(id)).filter(Boolean); });
    const same = JSON.stringify(pools) === JSON.stringify(p.pools);
    if (!same) changed++;
    return { ...p, pools, remoteName: r.n || p.remoteName, syncedAt: r.at || now, checkedAt: now };
  });
  setPlayers(next);
  window.dispatchEvent(new CustomEvent('friends-updated'));
  return changed;
}
