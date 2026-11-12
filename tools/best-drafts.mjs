// Calcule les 10 meilleures drafts du patch et les écrit dans public/data/best-drafts.json.
// Remplace le workflow Base44 « Actualiser les meilleures drafts quotidiennement » (qui faisait inventer
// les compos et les taux de victoire par une IA). Ici : données réelles du Coach Support.
// Usage : node tools/best-drafts.mjs
//   COACH_BASE  (défaut https://nanileb.github.io/lol-support-coach/) : où lire builds.json, counters.json, meta.json
//   COACH_DIR   (facultatif) : dossier local contenant ces 3 fichiers (prioritaire sur COACH_BASE)
//   MIN_GAMES   (défaut 100) : parties minimum d'un champion à son poste pour entrer dans une draft
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA, DD, setData, fixIds } from '../src/lib/gameData.js';
import { buildChampion, enrichChampion } from '../src/lib/championEngine.js';
import { computeBestDrafts, BEST_DRAFT_MIN_GAMES } from '../src/lib/bestDraftsEngine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.COACH_BASE || 'https://nanileb.github.io/lol-support-coach/').replace(/\/?$/, '/');
const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const coach = async f => process.env.COACH_DIR ? JSON.parse(readFileSync(join(process.env.COACH_DIR, f + '.json'), 'utf8')) : getJSON(BASE + f + '.json');

const version = (await getJSON(`${DD}/api/versions.json`))[0];
const [champs, items] = await Promise.all([
  getJSON(`${DD}/cdn/${version}/data/fr_FR/champion.json`),
  getJSON(`${DD}/cdn/${version}/data/fr_FR/item.json`),
]);
const it = {}; Object.entries(items.data).forEach(([id, x]) => { it[id] = { name: x.name, tags: x.tags || [] }; });
setData({ champs: champs.data, version, items: it });
const [builds, counters, meta] = await Promise.all([coach('builds'), coach('counters'), coach('meta')]);
setData({ builds: fixIds(builds), cnt: fixIds(counters), meta });

const byId = {};
Object.values(champs.data).forEach(c => { byId[c.id] = enrichChampion(buildChampion({ ...c, iconVersion: version })); });
const t0 = Date.now();
const minGames = +(process.env.MIN_GAMES || BEST_DRAFT_MIN_GAMES);
const drafts = computeBestDrafts(byId, 10, 60, minGames);
const out = {
  generated: new Date().toISOString(), patch: builds.patch, ddragon: version,
  minGames,
  source: `builds.json (${builds.games} parties ${builds.players || 'Challenger / GM / Master'}, ${(builds.regions || []).join(' + ')}), counters.json (${counters.source} ${counters.rank}, patch ${counters.patch}), meta.json (${meta.patch})`,
  drafts,
};
mkdirSync(join(ROOT, 'public/data'), { recursive: true });
writeFileSync(join(ROOT, 'public/data/best-drafts.json'), JSON.stringify(out, null, 1));
console.log(`${drafts.length} drafts en ${Date.now() - t0} ms · patch ${builds.patch}`);
drafts.forEach(d => console.log(`- ${d.playstyle} ${d.winRate} % · score ${d.draftScore} · ${d.champions.map(c => c.name).join(', ')}`));
