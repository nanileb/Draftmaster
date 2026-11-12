// Chargement des données côté navigateur (remplace riotProxy, fetchAllChampionStats, preloadAllSpells…)
import { useEffect, useState } from 'react';
import { DATA, DD, setData, fixIds } from '@/lib/gameData';

const LOCAL = (p) => (import.meta.env.BASE_URL || '/') + p;

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
const cacheGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const cacheSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota : on se passe du cache */ } };

// Objets et runes en français (Data Dragon), une fois par version
export async function loadDDragonExtras(version) {
  if (!version || DATA._extras === version) return;
  try {
    const [it, ru] = await Promise.all([
      getJSON(`${DD}/cdn/${version}/data/fr_FR/item.json`),
      getJSON(`${DD}/cdn/${version}/data/fr_FR/runesReforged.json`),
    ]);
    const items = {};
    Object.entries(it.data || {}).forEach(([id, x]) => {
      const p = (String(x.description).match(/<passive>[^<]*<\/passive>/g) || []).map(s => s.replace(/<[^>]+>/g, '').trim());
      const grp = p.includes('Lien vital') ? 'lifeline' : p.includes('Lame enchantée') ? 'spellblade' : p.includes('Immolation') ? 'immolate' : p.includes('Effroi') ? 'mana' : p.includes('Fendoir') ? 'hydra' : null;
      items[id] = { name: x.name, tags: x.tags || [], gold: (x.gold || {}).total || 0, grp, into: x.into || [], from: x.from || [], depth: x.depth || 1, gw: /Hémorragie/.test(String(x.description)) ? 1 : 0 };
    });
    const runes = {};
    (ru || []).forEach(st => { runes[st.id] = st.name; (st.slots || []).forEach(sl => (sl.runes || []).forEach(r => { runes[r.id] = r.name; })); });
    setData({ items, runes, _extras: version });
  } catch (e) { console.warn('Objets / runes indisponibles', e.message); }
}

// Statistiques (builds, counters, meta) : publiées avec l'application (public/data), puis cache local hors ligne
export async function loadStatsData() {
  const out = {}; const errors = [];
  await Promise.all(['builds', 'counters', 'meta'].map(async (f) => {
    try {
      out[f] = await getJSON(LOCAL('data/' + f + '.json'), { cache: 'no-cache' });
      cacheSet('dm_coach_' + f, out[f]);
    } catch (e) {
      const c = cacheGet('dm_coach_' + f);
      if (c) out[f] = c; else errors.push(f);
    }
  }));
  setData({ builds: fixIds(out.builds || null), cnt: fixIds(out.counters || null), meta: out.meta || null, statsErrors: errors });
  return errors;
}

export async function loadLocalData() {
  try { const c = await getJSON(LOCAL('data/combos.json')); setData({ combos: c.combos || {} }); } catch (e) { /* facultatif */ }
}

// Sorts d'un champion (Data Dragon fr_FR), avec les icônes
const spellCache = {};
export async function loadChampionSpells(id, version) {
  if (spellCache[id]) return spellCache[id];
  const v = version || DATA.version;
  const d = await getJSON(`${DD}/cdn/${v}/data/fr_FR/champion/${id}.json`);
  const c = d.data && d.data[id]; if (!c) return [];
  const strip = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const spells = [];
  if (c.passive) spells.push({ key: 'P', name: c.passive.name, description: strip(c.passive.description).slice(0, 220), icon: `${DD}/cdn/${v}/img/passive/${c.passive.image.full}` });
  ['Q', 'W', 'E', 'R'].forEach((k, i) => { const s = (c.spells || [])[i]; if (s) spells.push({ key: k, name: s.name, description: strip(s.description).slice(0, 220), icon: `${DD}/cdn/${v}/img/spell/${s.image.full}`, cooldown: s.cooldownBurn }); });
  spellCache[id] = spells;
  return spells;
}

// Meilleures drafts pré-calculées (tools/best-drafts.mjs) : data/best-drafts.json
export async function loadBestDraftsFile() {
  try { return await getJSON(LOCAL('data/best-drafts.json'), { cache: 'no-cache' }); } catch (e) { return null; }
}

// Hook : charge les données une fois et rend un numéro de révision
let started = null;
export function useGameData(version) {
  const [rev, setRev] = useState(DATA.rev);
  useEffect(() => {
    if (!started) started = Promise.all([loadStatsData(), loadLocalData()]);
    let alive = true;
    started.then(() => { if (alive) setRev(DATA.rev); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!version) return;
    let alive = true;
    loadDDragonExtras(version).then(() => { if (alive) setRev(DATA.rev); });
    return () => { alive = false; };
  }, [version]);
  return rev;
}

// Après le chargement des champions : recaler les clés des données du coach sur les ids Data Dragon
export function refixIds() {
  if (!DATA.builds && !DATA.cnt) return;
  setData({ builds: fixIds(DATA.builds), cnt: fixIds(DATA.cnt) });
}
