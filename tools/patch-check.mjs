// Vérification du patch, utilisée par les deux batchs :
//  - patch-batch.yml : faut-il recalculer les meilleures drafts et les nouveautés du patch ?
//    Compare le patch Data Dragon et l'état des données de l'application (public/data : builds, counters, meta)
//    à ce qui a été enregistré lors du dernier calcul (public/data/best-drafts.json, champ « inputs »).
//  - collect.yml : builds.json est-il en retard sur le patch du moment (collecte à lancer) ?
//    counters.json / meta.json sont-ils en retard (données relevées à la main : ticket GitHub) ?
// Écrit dans $GITHUB_OUTPUT : changed, ddragon, patch, builds_late, counters_late, meta_late.
// Usage : node tools/patch-check.mjs   (FORCE=1 force changed=true ; DATA_DIR=… lit un autre dossier que public/data)
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'public/data');
const getJSON = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const readAt = p => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch (e) { return null; } };
const data = f => readAt(join(DATA_DIR, f + '.json')) || {};

export async function currentInputs() {
  const versions = await getJSON('https://ddragon.leagueoflegends.com/api/versions.json');
  const builds = data('builds'), counters = data('counters'), meta = data('meta');
  return {
    ddragon: versions[0],
    builds: `${builds.patch} ${builds.generated}`,
    counters: `${counters.patch} ${counters.generated}`,
    meta: `${meta.patch} ${meta.updated}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = await currentInputs();
  const saved = (readAt(join(ROOT, 'public/data/best-drafts.json')) || {}).inputs || {};
  const diff = Object.keys(now).filter(k => now[k] !== saved[k]);
  const noNotes = !existsSync(join(ROOT, 'tools/patch-notes.mjs')) ? false : !existsSync(join(ROOT, 'public/data/patch-notes.json'));
  const changed = process.env.FORCE === '1' || process.env.FORCE === 'true' || diff.length > 0 || noNotes;
  // Patch du moment (16.23) ; meta.json numérote à la façon Riot (26.23 = Data Dragon 16.23) : on compare le numéro après le point.
  const patch = now.ddragon.split('.').slice(0, 2).join('.');
  const minor = p => String(p || '').split('.')[1];
  const late = { builds_late: data('builds').patch !== patch, counters_late: data('counters').patch !== patch, meta_late: minor(data('meta').patch) !== minor(patch) };
  console.log(`Patch Data Dragon : ${now.ddragon} (enregistré : ${saved.ddragon || 'aucun'})`);
  for (const k of ['builds', 'counters', 'meta']) console.log(`${k} : ${now[k]}${saved[k] && saved[k] !== now[k] ? ` (avant : ${saved[k]})` : ''}${late[k + '_late'] ? ' — en retard sur le patch ' + patch : ''}`);
  console.log(changed ? `Drafts à recalculer : ${diff.join(', ') || (noNotes ? 'notes de patch absentes' : 'forcé')}` : 'Drafts à jour : on ne touche à rien.');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries({ changed, ddragon: now.ddragon, patch, ...late }).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}
