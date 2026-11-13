// PC relié : la sélection des champions lue sur le PC par le compagnon « DraftMaster PC » arrive ici par le relais
// (route /pc, un code de 8 caractères affiché par le PC et saisi une fois dans Profil › PC relié).
// Le téléphone relit le relais tant que l'app est ouverte : toutes les 1,5 s pendant une sélection, toutes les 5 s sinon.
// Les données sont ensuite appliquées à la draft solo (Accueil) et à la draft d'équipe en direct (onglet Équipe).
import { useEffect, useState } from 'react';
import { getSettings } from '@/lib/localStore';

const KEY = 'dm_pc';
const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* stockage indisponible */ } };

export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const showCode = (c) => (c && c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c || '');
export function getPcCode() { return read().code || ''; }
export function setPcCode(code) {
  const c = normCode(code);
  write(c ? { code: c } : {});
  last = { status: c ? 'waiting' : 'off', data: null };
  emit(); kick();
}

// ------------------------------------------------------------
// État partagé : { status, data }
// status : 'off' (pas de PC relié), 'waiting' (le PC n'a encore rien envoyé ou ne répond plus),
//          'idle' (PC allumé, pas de sélection), 'select' (sélection en cours), 'game' (partie lancée),
//          'paused' (le PC s'est fermé tout seul au lancement de la partie), 'error'
// ------------------------------------------------------------
let last = { status: getPcCode() ? 'waiting' : 'off', data: null };
const listeners = new Set();
const emit = () => listeners.forEach(f => f(last));

const STALE = 60 * 1000; // le PC envoie un signe de vie toutes les 20 s
export function statusOf(j) {
  if (!j || j.error) return 'waiting';
  const ingame = ['GameStart', 'InProgress', 'Reconnect'].includes(j.phase);
  if ((j.now || Date.now()) - (j.seen || 0) > STALE || j.phase === 'Closed') return ingame ? 'paused' : 'waiting';
  if (j.phase === 'ChampSelect' && j.cs) return 'select';
  if (ingame) return 'game';
  return 'idle';
}

let timer = null, running = false, inflight = false;
async function poll() {
  clearTimeout(timer);
  const code = getPcCode();
  if (!code || document.visibilityState === 'hidden') { running = false; return; }
  running = true;
  if (!inflight) {
    inflight = true;
    try {
      const r = await fetch(getSettings().relay.replace(/\/+$/, '') + '/pc?id=' + code, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      const next = r.status === 404 ? { status: 'waiting', data: null }
        : !r.ok ? { status: 'error', data: last.data, error: (j && j.error) || 'http_' + r.status }
        : { status: statusOf(j), data: j };
      if (JSON.stringify(next) !== JSON.stringify(last)) { last = next; emit(); }
    } catch (e) {
      if (last.status !== 'error') { last = { ...last, status: 'error', error: 'offline' }; emit(); }
    } finally { inflight = false; }
  }
  timer = setTimeout(poll, last.status === 'select' ? 1500 : 5000);
}
function kick() { clearTimeout(timer); running = false; if (getPcCode()) poll(); }

let started = false;
export function startPcLink() {
  if (started) return;
  started = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  kick();
}

export function usePcLink() {
  const [s, setS] = useState(last);
  useEffect(() => { listeners.add(setS); setS(last); return () => listeners.delete(setS); }, []);
  return s;
}

// ------------------------------------------------------------
// Traduction : ids numériques du client League → ids Data Dragon de l'app
// ------------------------------------------------------------
// Renvoie { n, side, myRole, me, mine: [{ id, pos, lock, me }], bans: [ids], enemy: [{ id, pos }] } (verrouillés seulement en face)
export function readSelection(data, champions) {
  const cs = data && data.cs;
  if (!cs) return null;
  const byKey = {}; (champions || []).forEach(c => { byKey[String(c.key)] = c.id; });
  const id = k => (k ? byKey[String(k)] || null : null);
  const meCell = (cs.ally || []).find(m => m.me);
  const mine = (cs.ally || []).map(m => ({ id: id(m.c), pos: ROLES.includes(m.pos) ? m.pos : null, lock: !!m.lock, me: !!m.me }));
  const bans = [...new Set([...(cs.bans?.ally || []), ...(cs.bans?.enemy || [])].map(id).filter(Boolean))];
  const enemy = (cs.enemy || []).filter(m => m.lock && id(m.c)).map(m => ({ id: id(m.c), pos: ROLES.includes(m.pos) ? m.pos : null }));
  const meRow = mine.find(m => m.me);
  return {
    n: data.n || 0, side: cs.side || null, step: cs.step || null,
    myRole: meCell && ROLES.includes(meCell.pos) ? meCell.pos : null,
    me: meRow && meRow.lock ? meRow.id : null,
    hover: meRow && !meRow.lock ? meRow.id : null,
    mine, bans, enemy,
  };
}
