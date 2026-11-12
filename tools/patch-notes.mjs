// Nouveautés du patch courant → public/data/patch-notes.json (lu par la page /patch de l'app).
// Deux sources, toutes deux publiques et sans clé :
//  1. Data Dragon (Riot) : comparaison de la version actuelle avec la précédente (statistiques des champions,
//     délais de récupération, coûts, portées des sorts, objets, runes, nouveaux champions). Fiable : chiffres exacts.
//  2. Notes de patch officielles Riot en français (leagueoflegends.com) : texte des développeurs, temps forts,
//     changements détaillés (dégâts, etc.). Lecture du HTML de la page, au mieux : si la page est introuvable
//     ou illisible, official = null et l'app affiche quand même la partie Data Dragon et le lien vers Riot.
// Usage : node tools/patch-notes.mjs   (aucun argument, aucune variable ; sort toujours en code 0)
//   PATCH_NOTES_HTML (facultatif, tests) : fichier HTML local à lire à la place de la page Riot.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/data/patch-notes.json');
const DD = 'https://ddragon.leagueoflegends.com';
const RIOT = 'https://www.leagueoflegends.com/fr-fr/news/game-updates/';
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; DraftMaster patch-notes)', 'accept-language': 'fr-FR,fr;q=0.9' };

const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const getText = async u => { const r = await fetch(u, { headers: UA, redirect: 'follow' }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.text(); };

// Nom du patch affiché par Riot : Data Dragon 16.22.1 → patch 26.22 (depuis 2025, année + numéro)
export function patchLabel(v) {
  const [a, b] = String(v || '').split('.').map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `${a >= 15 ? a + 10 : a}.${b}`;
}

// ───────────────────────── Texte ─────────────────────────
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', rArr: '⇒', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘' };
export const decode = s => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m);
export const strip = s => decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// ───────────────────────── 1. Data Dragon ─────────────────────────
const STAT_LABELS = {
  hp: 'PV', hpperlevel: 'PV par niveau', mp: 'Mana', mpperlevel: 'Mana par niveau', movespeed: 'Vitesse de déplacement',
  armor: 'Armure', armorperlevel: 'Armure par niveau', spellblock: 'Résistance magique', spellblockperlevel: 'Résistance magique par niveau',
  attackrange: "Portée d'attaque", hpregen: 'Régénération de PV', hpregenperlevel: 'Régénération de PV par niveau',
  mpregen: 'Régénération de mana', mpregenperlevel: 'Régénération de mana par niveau', crit: 'Coups critiques', critperlevel: 'Coups critiques par niveau',
  attackdamage: "Dégâts d'attaque", attackdamageperlevel: "Dégâts d'attaque par niveau", attackspeedperlevel: "Vitesse d'attaque par niveau", attackspeed: "Vitesse d'attaque",
};
const ITEM_STAT = {
  FlatHPPoolMod: 'PV', FlatMPPoolMod: 'Mana', FlatPhysicalDamageMod: "Dégâts d'attaque", FlatMagicDamageMod: 'Puissance',
  FlatArmorMod: 'Armure', FlatSpellBlockMod: 'Résistance magique', PercentAttackSpeedMod: "Vitesse d'attaque", FlatCritChanceMod: 'Coups critiques',
  FlatMovementSpeedMod: 'Vitesse de déplacement', PercentMovementSpeedMod: 'Vitesse de déplacement (%)', PercentLifeStealMod: 'Vol de vie',
  FlatHPRegenMod: 'Régénération de PV', PercentHPRegenMod: 'Régénération de PV (%)',
};
const KEYS = ['Q', 'W', 'E', 'R'];
const fmtStat = (k, v) => (/^Percent|CritChance/.test(k) ? `${Math.round(v * 1000) / 10} %` : String(v));
const dir = (a, b, lowerIsBetter) => {
  const n = s => { const m = String(s).match(/-?\d+(?:[.,]\d+)?/g); return m ? m.map(x => +x.replace(',', '.')).reduce((x, y) => x + y, 0) : NaN; };
  const x = n(a), y = n(b); if (!Number.isFinite(x) || !Number.isFinite(y) || x === y) return 0;
  return (y > x ? 1 : -1) * (lowerIsBetter ? -1 : 1);
};
// Lignes d'une description d'objet / rune (sans balises), pour un diff ligne à ligne
const descLines = html => String(html || '').split(/<br\s*\/?>|<\/?(?:li|p|stats|mainText|passive|active)\b[^>]*>/i).map(strip).filter(Boolean);
function lineDiff(a, b) {
  const A = descLines(a), B = descLines(b);
  const setA = new Set(A), setB = new Set(B);
  const gone = A.filter(l => !setB.has(l)), added = B.filter(l => !setA.has(l));
  const out = [];
  const n = Math.max(gone.length, added.length);
  for (let i = 0; i < n; i++) out.push({ from: gone[i] || null, to: added[i] || null });
  return out.slice(0, 8);
}

export function diffDDragon(prev, cur) {
  const res = { champions: [], newChampions: [], items: [], newItems: [], removedItems: [], runes: [] };
  const pc = prev.champs, cc = cur.champs;
  for (const id of Object.keys(cc).sort()) {
    const b = cc[id], a = pc[id];
    if (!a) { res.newChampions.push({ id, name: b.name, title: b.title }); continue; }
    const stats = [];
    for (const k of Object.keys(b.stats || {})) if (a.stats?.[k] !== b.stats[k]) stats.push({ label: STAT_LABELS[k] || k, from: String(a.stats?.[k] ?? '—'), to: String(b.stats[k]), dir: dir(a.stats?.[k], b.stats[k]) });
    const spells = [];
    (b.spells || []).forEach((s, i) => {
      const o = (a.spells || [])[i]; if (!o) return;
      const ch = [];
      const push = (label, x, y, lower) => { if (x !== y && (x || y)) ch.push({ label, from: x || '—', to: y || '—', dir: dir(x, y, lower) }); };
      push('Délai de récupération', o.cooldownBurn, s.cooldownBurn, true);
      if (s.costType === o.costType) push('Coût', o.costBurn, s.costBurn, true);
      push('Portée', o.rangeBurn, s.rangeBurn);
      const textChanged = o.tooltip !== s.tooltip || o.description !== s.description;
      if (ch.length || textChanged) spells.push({ key: KEYS[i], name: s.name, icon: s.image?.full ? `spell/${s.image.full}` : null, changes: ch, textChanged: textChanged && !ch.length });
    });
    if (a.passive?.description !== b.passive?.description) spells.unshift({ key: 'P', name: b.passive?.name, icon: b.passive?.image?.full ? `passive/${b.passive.image.full}` : null, changes: [], textChanged: true });
    if (stats.length || spells.length) {
      const dirs = [...stats, ...spells.flatMap(s => s.changes)].map(c => c.dir);
      const up = dirs.some(d => d > 0), down = dirs.some(d => d < 0);
      res.champions.push({ id, name: b.name, stats, spells, trend: up && !down ? 'buff' : down && !up ? 'nerf' : 'ajust' });
    }
  }
  const pi = prev.items, ci = cur.items;
  const shopItem = x => x && x.gold?.purchasable !== false && x.maps?.['11'] !== false && !x.requiredChampion && x.inStore !== false;
  for (const id of Object.keys(ci)) {
    const b = ci[id], a = pi[id];
    if (!shopItem(b)) continue;
    if (!a) { if (!Object.values(pi).some(x => x.name === b.name)) res.newItems.push({ id, name: b.name, gold: b.gold?.total || 0 }); continue; }
    const ch = [];
    if (a.gold?.total !== b.gold?.total) ch.push({ label: 'Coût total', from: `${a.gold?.total} PO`, to: `${b.gold?.total} PO`, dir: dir(a.gold?.total, b.gold?.total, true) });
    const keys = new Set([...Object.keys(a.stats || {}), ...Object.keys(b.stats || {})]);
    for (const k of keys) { const x = a.stats?.[k], y = b.stats?.[k]; if (x !== y) ch.push({ label: ITEM_STAT[k] || k, from: x == null ? '—' : fmtStat(k, x), to: y == null ? '—' : fmtStat(k, y), dir: dir(x ?? 0, y ?? 0) }); }
    const lines = a.description !== b.description ? lineDiff(a.description, b.description).filter(l => !ch.some(c => (l.to || '').includes(c.to))) : [];
    if (ch.length || lines.length) res.items.push({ id, name: b.name, changes: ch, lines });
  }
  // Doublons d'objets (variantes de modes) : un seul par nom
  const seen = new Set(); res.items = res.items.filter(x => !seen.has(x.name) && seen.add(x.name));
  for (const id of Object.keys(pi)) if (shopItem(pi[id]) && !ci[id] && !Object.values(ci).some(x => x.name === pi[id].name)) res.removedItems.push({ id, name: pi[id].name });
  const runeMap = r => { const m = {}; (r || []).forEach(st => (st.slots || []).forEach(sl => (sl.runes || []).forEach(x => { m[x.id] = { ...x, tree: st.name }; }))); return m; };
  const ra = runeMap(prev.runes), rb = runeMap(cur.runes);
  for (const id of Object.keys(rb)) {
    const a = ra[id], b = rb[id];
    if (!a) { res.runes.push({ id, name: b.name, tree: b.tree, isNew: true, lines: [] }); continue; }
    if (a.longDesc !== b.longDesc) res.runes.push({ id, name: b.name, tree: b.tree, icon: b.icon, lines: lineDiff(a.longDesc, b.longDesc) });
  }
  return res;
}

// ───────────────────────── 2. Notes officielles ─────────────────────────
// Lecture tolérante : on ne dépend pas des classes CSS, seulement de la hiérarchie des titres
// (h2 = section, h3 = champion / objet, h4 = compétence ou sous-partie, li = changement « libellé : avant ⇒ après »).
const ARROW = /\s*(?:⇒|→|=>|➔|➜|►|-&gt;)\s*/;
export function parseChange(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  const parts = t.split(ARROW);
  if (parts.length < 2) return { text: t };
  let left = parts[0], label = null;
  const m = left.match(/^(.{2,80}?)\s*:\s+(.*)$/);
  if (m) { label = m[1].trim(); left = m[2].trim(); }
  return { label, from: left, to: parts.slice(1).join(' ⇒ ').trim() };
}

function tokenize(html) {
  // Corps de l'article : on retire scripts, styles, navigation et pied de page
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header(?![^>]*header-primary))\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const toks = [];
  // Parcours séquentiel simple : on repère les ouvertures de balises utiles et on prend leur texte jusqu'à la fermeture
  const open = /<(h[1-4]|li|p|blockquote)\b[^>]*>|<img\b([^>]*)>/gi;
  let m;
  const qOpen = /<blockquote\b/gi, qClose = /<\/blockquote>/gi;
  const quotePos = []; // positions des blockquote (texte de contexte des développeurs)
  for (let x; (x = qOpen.exec(body));) quotePos.push([x.index, 1]);
  for (let x; (x = qClose.exec(body));) quotePos.push([x.index, -1]);
  quotePos.sort((a, b) => a[0] - b[0]);
  const depthAt = pos => { let d = 0; for (const [p, v] of quotePos) { if (p > pos) break; d += v; } return d; };
  while ((m = open.exec(body))) {
    if (m[0].toLowerCase().startsWith('<img')) {
      const src = (m[2] || '').match(/src="([^"]+)"/i); if (src) toks.push({ tag: 'img', src: decode(src[1]), pos: m.index });
      continue;
    }
    const tag = m[1].toLowerCase();
    if (tag === 'blockquote') continue;
    const end = body.indexOf(`</${tag}>`, open.lastIndex);
    if (end < 0) continue;
    let inner = body.slice(open.lastIndex, end);
    if (tag === 'li') inner = inner.replace(/<(ul|ol)\b[\s\S]*$/i, ''); // liste imbriquée : ses li sont lus à part
    const text = strip(inner);
    const img = inner.match(/<img\b[^>]*src="([^"]+)"/i);
    if (text) toks.push({ tag, text, pos: m.index, quote: depthAt(m.index) > 0, img: img ? decode(img[1]) : null });
  }
  return toks;
}

const SKIP_SECTIONS = /articles? li[ée]s|related articles|partager|share/i;
export function parseOfficial(html) {
  let toks = tokenize(html);
  // Page rendue côté client : le contenu est dans le JSON __NEXT_DATA__ (chaîne HTML la plus longue)
  if (!toks.some(t => t.tag === 'h2')) {
    const nd = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nd) {
      let best = '';
      const walk = v => { if (typeof v === 'string') { if (v.includes('<h2') && v.length > best.length) best = v; } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
      try { walk(JSON.parse(nd[1])); } catch (e) { /* JSON illisible */ }
      if (best) toks = tokenize(best);
    }
  }
  const title = strip((html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '');
  const date = ((html.match(/"datePublished"\s*:\s*"([^"]+)"/) || html.match(/<time[^>]+datetime="([^"]+)"/i) || [])[1]) || null;
  const image = ((html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) || [])[1]) || null;

  const sections = []; let sec = null, grp = null, blk = null; const intro = [];
  const newGroup = (name, icon) => { grp = { name, icon: icon || null, summary: null, context: [], blocks: [] }; blk = null; sec.groups.push(grp); };
  let lastImg = null;
  for (const t of toks) {
    if (t.tag === 'img') { lastImg = t.src; if (sec && sec.title && /temps forts|highlights/i.test(sec.title)) sec.images.push(t.src); continue; }
    if (t.tag === 'h1') continue;
    if (t.tag === 'h2') {
      if (SKIP_SECTIONS.test(t.text)) { sec = null; grp = null; blk = null; continue; }
      sec = { title: t.text, intro: [], groups: [], images: [] }; sections.push(sec); grp = null; blk = null; continue;
    }
    if (!sec) { if (t.tag === 'p' && t.text.length > 40 && intro.length < 4) intro.push(t.text); continue; }
    if (t.tag === 'h3') { newGroup(t.text, t.img || lastImg); lastImg = null; continue; }
    if (t.tag === 'h4') {
      if (!grp) newGroup(null);
      blk = { title: t.text, icon: t.img || null, changes: [] }; grp.blocks.push(blk); continue;
    }
    if (t.tag === 'p') {
      if (!grp) { if (sec.intro.length < 6) sec.intro.push(t.text); continue; }
      if (blk) { blk.changes.push({ text: t.text }); continue; }
      if (!grp.summary && !t.quote) grp.summary = t.text; else grp.context.push(t.text);
      continue;
    }
    if (t.tag === 'li') {
      if (!grp) newGroup(null);
      if (!blk) { blk = { title: null, icon: null, changes: [] }; grp.blocks.push(blk); }
      blk.changes.push(parseChange(t.text));
    }
  }
  // Nettoyage : sections vides, limites de taille raisonnables pour un téléphone
  const clean = sections.map(s => ({
    ...s,
    images: s.images.slice(0, 6),
    groups: s.groups.filter(g => g.name || g.summary || g.blocks.some(b => b.changes.length)).map(g => ({ ...g, context: g.context.slice(0, 3), blocks: g.blocks.filter(b => b.title || b.changes.length).map(b => ({ ...b, changes: b.changes.slice(0, 30) })) })).slice(0, 120),
  })).filter(s => s.intro.length || s.groups.length || s.images.length);
  return { title, date, image, intro, sections: clean };
}

async function findArticle(label) {
  const [maj, min] = label.split('.');
  const re = new RegExp(`/fr-fr/news/game-updates/([a-z0-9-]*patch-${maj}-${min}-notes)/?`, 'i');
  const candidates = [];
  try { const list = await getText(RIOT); const m = list.match(re); if (m) candidates.push(m[1]); } catch (e) { console.warn('Liste des articles Riot indisponible :', e.message); }
  candidates.push(`league-of-legends-patch-${maj}-${min}-notes`, `patch-${maj}-${min}-notes`);
  for (const slug of [...new Set(candidates)]) {
    const url = `${RIOT}${slug}/`;
    try { return { url, html: await getText(url) }; } catch (e) { /* slug suivant */ }
  }
  return null;
}

// ───────────────────────── Programme ─────────────────────────
async function main() {
  const versions = await getJSON(`${DD}/api/versions.json`);
  const version = versions[0];
  const label = patchLabel(version);
  // Version précédente = premier patch « mineur » différent (16.22.1 → 16.21.1)
  const previous = versions.find(v => patchLabel(v) !== label) || versions[1];
  const load = async v => {
    const [c, i, r] = await Promise.all([
      getJSON(`${DD}/cdn/${v}/data/fr_FR/championFull.json`),
      getJSON(`${DD}/cdn/${v}/data/fr_FR/item.json`),
      getJSON(`${DD}/cdn/${v}/data/fr_FR/runesReforged.json`),
    ]);
    return { champs: c.data, items: i.data, runes: r };
  };
  const out = { version, previous, patch: label, generatedAt: new Date().toISOString(), officialUrl: `${RIOT}league-of-legends-patch-${label.replace('.', '-')}-notes/`, official: null, ddragon: null };
  try { out.ddragon = diffDDragon(await load(previous), await load(version)); } catch (e) { console.warn('Comparaison Data Dragon impossible :', e.message); }
  try {
    const art = process.env.PATCH_NOTES_HTML ? { url: out.officialUrl, html: readFileSync(process.env.PATCH_NOTES_HTML, 'utf8') } : await findArticle(label);
    if (art) {
      const o = parseOfficial(art.html);
      if (o.sections.length) { out.official = { url: art.url, ...o }; out.officialUrl = art.url; }
      else console.warn('Notes Riot trouvées mais illisibles :', art.url);
    } else console.warn(`Notes du patch ${label} introuvables sur le site de Riot`);
  } catch (e) { console.warn('Notes Riot indisponibles :', e.message); }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const d = out.ddragon || {};
  console.log(`patch-notes.json : patch ${label} (${previous} → ${version}) · notes officielles ${out.official ? out.official.sections.length + ' sections' : 'absentes'} · Data Dragon ${d.champions?.length ?? 0} champions, ${d.items?.length ?? 0} objets, ${d.runes?.length ?? 0} runes`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.warn('patch-notes : échec, fichier inchangé :', e.message); }).finally(() => process.exit(0));
}
