// Données de l'utilisateur, gardées dans ce navigateur (localStorage).
// Remplace les entités Base44 Player / Friend / User (pas de compte, pas de serveur).
import { COACH_BASE_DEFAULT, RELAY_DEFAULT } from '@/lib/gameData';

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
export function setProfile(p) { write('dm_profile', p); }

// Réglages
export function getSettings() {
  const s = read('dm_settings', {});
  return { relay: s.relay || RELAY_DEFAULT, coachBase: s.coachBase || COACH_BASE_DEFAULT, platform: s.platform || 'euw1' };
}
export function setSettings(s) { write('dm_settings', { ...read('dm_settings', {}), ...s }); }

export function clearAll() {
  ['userChampionPool', 'draftmaster_pool', 'dm_players', 'dm_profile', 'dm_settings', 'riotId', 'draftmaster_champions_cache', 'draftmaster_cache_version', 'dm_coach_cache'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* rien */ } });
}

// ------------------------------------------------------------
// Partage du pool sans compte : le pool est encodé dans un lien (…/draftmaster/home?add=CODE)
// CODE = base64url de JSON { v:1, n: pseudo, p: { TOP: [ids], ... } } (ids Data Dragon, plus courts que les noms)
// ------------------------------------------------------------
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

export function encodeShare(name, pool) {
  const p = {};
  (pool || []).forEach(e => Object.keys(e.roles || {}).forEach(r => { (p[r] = p[r] || []).push(e.championId); }));
  return b64url(JSON.stringify({ v: 1, n: (name || '').slice(0, 24), p }));
}
export function decodeShare(code) {
  try {
    const o = JSON.parse(unb64url(String(code).trim()));
    if (!o || o.v !== 1 || typeof o.p !== 'object') return null;
    const pools = { TOP: [], JUNGLE: [], MID: [], ADC: [], SUPPORT: [] };
    Object.keys(pools).forEach(r => { pools[r] = (o.p[r] || []).filter(x => typeof x === 'string').slice(0, 60); });
    return { name: String(o.n || '').slice(0, 24), poolsIds: pools };
  } catch (e) { return null; }
}
export function shareUrl(code) {
  const base = window.location.origin + (import.meta.env.BASE_URL || '/');
  return base.replace(/\/$/, '') + '/home?add=' + code;
}
