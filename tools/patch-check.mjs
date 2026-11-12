// Vérification quotidienne du patch (batch .github/workflows/patch-batch.yml).
// Compare le patch du moment (Data Dragon) et l'état des données du coach (builds, counters, meta) à ce que
// l'application a enregistré lors du dernier calcul (public/data/best-drafts.json, champ « inputs »).
// Si quelque chose a changé, écrit changed=true dans $GITHUB_OUTPUT : le batch recalcule alors toute la base.
// Usage : node tools/patch-check.mjs   (FORCE=1 force l'actualisation ; COACH_DIR=../lol-support-coach lit une copie locale)
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.COACH_BASE || 'https://nanileb.github.io/lol-support-coach/').replace(/\/?$/, '/');
const getJSON = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const coach = async f => process.env.COACH_DIR ? JSON.parse(readFileSync(join(process.env.COACH_DIR, f + '.json'), 'utf8')) : getJSON(BASE + f + '.json');
const read = f => { const p = join(ROOT, f); try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch (e) { return null; } };

export async function currentInputs() {
  const [versions, builds, counters, meta] = await Promise.all([
    getJSON('https://ddragon.leagueoflegends.com/api/versions.json'),
    coach('builds'), coach('counters'), coach('meta'),
  ]);
  return {
    ddragon: versions[0],
    builds: `${builds.patch} ${builds.generated}`,
    counters: `${counters.patch} ${counters.generated}`,
    meta: `${meta.patch} ${meta.updated}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = await currentInputs();
  const saved = (read('public/data/best-drafts.json') || {}).inputs || {};
  const diff = Object.keys(now).filter(k => now[k] !== saved[k]);
  const noNotes = !existsSync(join(ROOT, 'tools/patch-notes.mjs')) ? false : !existsSync(join(ROOT, 'public/data/patch-notes.json'));
  const changed = process.env.FORCE === '1' || process.env.FORCE === 'true' || diff.length > 0 || noNotes;
  console.log(`Patch Data Dragon : ${now.ddragon} (enregistré : ${saved.ddragon || 'aucun'})`);
  for (const k of ['builds', 'counters', 'meta']) console.log(`${k} : ${now[k]}${saved[k] && saved[k] !== now[k] ? ` (avant : ${saved[k]})` : ''}`);
  console.log(changed ? `À actualiser : ${diff.join(', ') || (noNotes ? 'notes de patch absentes' : 'forcé')}` : 'Rien de nouveau : on ne touche à rien.');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nddragon=${now.ddragon}\n`);
}
