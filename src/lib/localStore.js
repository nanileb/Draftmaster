// Données de l'utilisateur, gardées dans ce navigateur (localStorage).
// Remplace les entités Base44 Player / Friend / User (pas de compte, pas de serveur).
import { RELAY_DEFAULT } from '@/lib/gameData';

const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };

// Pool : [{ championId, mastery: 'main'|'comfortable'|'beginner', roles: { TOP: 'main', ... } }]
export function getPool() {
  let p = read('userChampionPool', null);
  if (!p) { p = read('draftmaster_pool', []); if (p && p.length) write('userChampionPool', p); }
  return Array.isArray(p) ? p : [];
}
export function setPool(pool) { write('userChampionPool', pool); window.dispatchEvent(new CustomEvent('pool-updated')); }

// Pool au format « par poste » (noms de champions), utilisé par l'optimisation d'équipe
export function poolByRole(pool, champions) {
  const rolesMap = { TOP: [], JUNGLE: [], MID: [], ADC: [], SUPPORT: [] };
  (pool || []).forEach(entry => {
    const c = champions.find(x => x.id === entry.championId);
    if (c) Object.keys(entry.roles || {}).forEach(r => { if (rolesMap[r]) rolesMap[r].push(c.name); });
  });
  return rolesMap;
}

// Joueurs de l'optimisation d'équipe : [{ id, name, pools: { TOP: [noms], ... }, imported?: true }]
export function getPlayers() { return read('dm_players', []); }
export function setPlayers(list) { write('dm_players', list); }
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Profil local (pseudo affiché dans le partage)
export function getProfile() { return read('dm_profile', { name: '' }); }
export function setProfile(p) { write('dm_profile', p); window.dispatchEvent(new CustomEvent('profile-updated')); }

// ------------------------------------------------------------
// Identité de synchro, sans compte : un id public (mis dans le lien de partage) et une clé secrète
// qui ne quitte pas le téléphone, sauf par le code de récupération (changement de téléphone).
// shared = true dès que le joueur a ouvert « Partager » : avant ça, son pool n'est jamais envoyé.
// ------------------------------------------------------------
const rand = (n) => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = new Uint8Array(n); crypto.getRandomValues(b);
  return [...b].map(x => a[x % a.length]).join('');
};
export function getIdentity() {
  let o = read('dm_identity', null);
  if (!o || !/^[A-Za-z0-9]{10,32}$/.test(o.id || '') || typeof o.key !== 'string') { o = { id: rand(16), key: rand(32), shared: false }; write('dm_identity', o); }
  return o;
}
export function setIdentity(o) { write('dm_identity', o); }
export function exportIdentity() { const o = getIdentity(); return 'DM-' + o.id + '-' + o.key; }
export function importIdentity(code) {
  const m = String(code || '').trim().match(/^DM-([A-Za-z0-9]{10,32})-([A-Za-z0-9]{20,64})$/);
  if (!m) return false;
  write('dm_identity', { id: m[1], key: m[2], shared: true });
  write('dm_sync', {});
  return true;
}
export function getSyncState() { return read('dm_sync', {}); }
export function setSyncState(o) { write('dm_sync', { ...read('dm_sync', {}), ...o }); }

// Réglages
export function getSettings() {
  const s = read('dm_settings', {});
  return { relay: s.relay || RELAY_DEFAULT, platform: s.platform || 'euw1' };
}
// coachBase (ancienne adresse des données du coach) n'est plus utilisé : on l'efface au passage
export function setSettings(s) { const { coachBase, ...rest } = { ...read('dm_settings', {}), ...s }; write('dm_settings', rest); }

export function clearAll() {
  ['userChampionPool', 'draftmaster_pool', 'dm_players', 'dm_profile', 'dm_settings', 'dm_identity', 'dm_sync', 'riotId', 'draftmaster_champions_cache', 'draftmaster_cache_version', 'dm_coach_cache'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* rien */ } });
}

// ------------------------------------------------------------
// Partage du pool sans compte : le pool est encodé dans un lien (…/Draftmaster/home?add=CODE)
// CODE = base64url de JSON { v:2, n: pseudo, i: id de synchro, p: { TOP: [ids], ... } } (ids Data Dragon, plus courts que les noms)
// v:1 (sans i) = ancien lien : une simple copie du pool, qui ne se met pas à jour.
// ------------------------------------------------------------
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

export function poolIdsByRole(pool) {
  const p = {};
  (pool || []).forEach(e => Object.keys(e.roles || {}).forEach(r => { (p[r] = p[r] || []).push(e.championId); }));
  return p;
}
export function encodeShare(name, pool, syncId) {
  const o = { v: syncId ? 2 : 1, n: (name || '').slice(0, 24) };
  if (syncId) o.i = syncId;
  o.p = poolIdsByRole(pool);
  return b64url(JSON.stringify(o));
}
export function decodeShare(code) {
  try {
    const o = JSON.parse(unb64url(String(code).trim()));
    if (!o || (o.v !== 1 && o.v !== 2) || typeof o.p !== 'object') return null;
    const pools = { TOP: [], JUNGLE: [], MID: [], ADC: [], SUPPORT: [] };
    Object.keys(pools).forEach(r => { pools[r] = (o.p[r] || []).filter(x => typeof x === 'string').slice(0, 60); });
    const syncId = o.v === 2 && /^[A-Za-z0-9]{10,32}$/.test(o.i || '') ? o.i : null;
    return { name: String(o.n || '').slice(0, 24), poolsIds: pools, syncId };
  } catch (e) { return null; }
}
export function shareUrl(code) {
  const base = window.location.origin + (import.meta.env.BASE_URL || '/');
  return base.replace(/\/$/, '') + '/home?add=' + code;
}
