// ============================================================
// MEILLEURES DRAFTS — calcul sans IA (remplace les fonctions Base44 bestDrafts, refreshPatchDrafts
// et generateCustomDrafts, qui demandaient à un modèle d'inventer des compos et des taux de victoire).
// Les compos sont cherchées dans les données réelles : taux de victoire Challenger / GM / Master,
// paires d'alliés jouées ensemble (builds.json), puis notées avec le score de draft de l'app.
// Utilisé dans le navigateur ET par tools/best-drafts.mjs (imports relatifs, pas de DOM).
// ============================================================
import { DATA, ROLES, BUILD, meta, cname, tags, isAP, isEngager, isFront, isAssassin, shrink, clamp, blindKind } from './gameData.js';
import { calculateDraftScore, detectSynergies, getWinCondition } from './championEngine.js';

const ROLE_FR = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };
const W = (r1, r2) => { const bot = ['ADC', 'SUPPORT']; if (bot.includes(r1) && bot.includes(r2)) return 1; if (r1 === 'JUNGLE' || r2 === 'JUNGLE') return 0.5; return 0.25; };
const CFG = { 1: { min: 20, k: 100, cap: 3 }, 0.5: { min: 30, k: 150, cap: 1.5 }, 0.25: { min: 50, k: 200, cap: 1 } };

const sup = id => meta().supports[id] || {};
const adc = id => meta().adcs[id] || {};
const rangeOf = id => ((DATA.champs[id] || {}).stats || {}).attackrange || 0;

// Styles de jeu : « fit » = à quel point un champion sert ce plan (0 à 1,5)
export const STYLES = [
  { key: 'engage', playstyle: 'Full engage', min: 3, winCondition: 'Forcer les combats à 5 autour des objectifs avec plusieurs engages',
    fit: (id) => (isEngager(id) ? 1.2 : 0) + (isFront(id) ? 0.3 : 0) },
  { key: 'protect', playstyle: 'Protéger le carry', min: 2, winCondition: 'Mettre l\'ADC en sécurité en teamfight et le laisser faire les dégâts',
    fit: (id, r) => (r === 'ADC' && (adc(id).style === 'hyper' || adc(id).scale >= 3) ? 1.5 : 0) + (r === 'SUPPORT' && ['enchanter', 'warden'].includes(sup(id).arch) ? 1.5 : 0) + (r !== 'ADC' && sup(id).peel >= 3 ? 0.5 : 0) },
  { key: 'poke', playstyle: 'Poke & siège', min: 3, winCondition: 'User l\'adversaire à distance avant chaque objectif, puis assiéger les tours',
    fit: (id) => (sup(id).poke >= 2 || adc(id).style === 'poke' || (tags(id).includes('Mage') && rangeOf(id) >= 525) ? 1.2 : 0) },
  { key: 'pick', playstyle: 'Pick & catch', min: 2, winCondition: 'Attraper une cible isolée grâce à la vision, puis jouer l\'objectif en surnombre',
    fit: (id) => ((meta().hookers || []).includes(id) ? 1.3 : 0) + (isAssassin(id) ? 1 : 0) },
  { key: 'dive', playstyle: 'Plongée', min: 3, winCondition: 'Plonger sur les carries adverses dès que les contrôles sont disponibles',
    fit: (id) => (isAssassin(id) ? 1 : 0) + (tags(id).includes('Fighter') ? 0.6 : 0) + (isEngager(id) ? 0.3 : 0) },
  { key: 'scaling', playstyle: 'Scaling', min: 2, winCondition: 'Survivre à la phase de lane puis gagner les combats de fin de partie',
    fit: (id, r) => (adc(id).scale >= 3 ? 1.3 : 0) + (sup(id).scale >= 3 ? 0.8 : 0) + (['Kassadin', 'Kayle', 'Veigar', 'Nasus', 'Azir', 'Smolder', 'AurelionSol', 'Ryze', 'Viktor', 'Senna', 'Sona'].includes(id) ? 1.2 : 0) },
  { key: 'early', playstyle: 'Tempo early', min: 3, winCondition: 'Prendre l\'avance avant 15 minutes (plaques, drakes, larves) et finir vite',
    fit: (id, r) => (adc(id).early >= 3 || sup(id).early >= 3 ? 1 : 0) + (r === 'JUNGLE' && (meta().junglers[id] || {}).type === 'early' ? 1.2 : 0) + (tags(id)[0] === 'Fighter' && r === 'TOP' ? 0.4 : 0) },
  { key: 'balanced', playstyle: 'Compo équilibrée', min: 0, winCondition: 'Jouer les objectifs avec une compo complète : engage, frontline, dégâts mixtes', fit: () => 0 },
];

// Caches (la recherche évalue des milliers de compos)
let CV = new Map(), PT = new Map(), cacheRev = -1;
const fresh = () => { if (cacheRev !== DATA.rev) { CV = new Map(); PT = new Map(); cacheRev = DATA.rev; } };
const champValue = (id, r) => { fresh(); const k = id + r; if (!CV.has(k)) { const b = BUILD(id, r); CV.set(k, b ? shrink(b.wr, b.n, 300) - 50 : -1.5); } return CV.get(k); };
// Part de l'écart individuel qui se retrouve dans le résultat de l'équipe (les écarts ne s'additionnent pas pleinement)
export const TEAM_FACTOR = 0.4;

function pairTerm(a, ra, c, rc) {
  fresh(); const k = a + ra + c + rc;
  if (!PT.has(k)) PT.set(k, pairTermRaw(a, ra, c, rc));
  return PT.get(k);
}
function pairTermRaw(a, ra, c, rc) {
  const w = W(ra, rc), cfg = CFG[w], b = BUILD(a, ra);
  if (!b) return null;
  const duo = (ra === 'ADC' && rc === 'SUPPORT') || (ra === 'SUPPORT' && rc === 'ADC');
  const e = ((duo ? b.duo : null) || []).find(x => x[0] === c && x[1] >= cfg.min) || (b.with || []).find(x => x[0] === c && x[1] >= cfg.min);
  if (!e) return null;
  const v = clamp((shrink(e[2], e[1], cfg.k, b.wr) - b.wr) * w, -cfg.cap, cfg.cap);
  return { v, wr: e[2], n: e[1], a, c };
}

// Note complète d'une compo { TOP: id, ... }
export function teamScore(team, style, reuse = null) {
  let val = 0, fit = 0, nfit = 0; const pairs = [];
  if (reuse) ROLES.forEach(r => { const id = team[r]; if (id && reuse[id]) val -= 2 * reuse[id]; });
  ROLES.forEach(r => { const id = team[r]; if (!id) return; val += champValue(id, r); const f = style ? style.fit(id, r) : 0; fit += f; if (f >= 1) nfit++; });
  let off = 0;
  for (let i = 0; i < ROLES.length; i++) for (let j = i + 1; j < ROLES.length; j++) {
    const ra = ROLES[i], rc = ROLES[j], a = team[ra], c = team[rc]; if (!a || !c) continue;
    const p = pairTerm(a, ra, c, rc) || pairTerm(c, rc, a, ra);
    if (p) { pairs.push({ ...p, ra, rc }); if (W(ra, rc) === 1) val += p.v; else off += p.v; }
  }
  val += clamp(off, -3, 3);
  const ids = ROLES.map(r => team[r]).filter(Boolean);
  const ap = ids.filter(id => isAP(id)).length, ad = ids.length - ap;
  let struct = 0;
  if (ids.length >= 4) { if (ap >= 1 && ad >= 1) struct += 1; else struct -= 2; if (ids.some(isFront)) struct += 0.8; else struct -= 1.5; if (ids.some(isEngager)) struct += 0.8; else struct -= 1; }
  const styleBonus = style && style.min ? fit * 0.9 + (nfit >= style.min ? 2 : -2) : 0;
  return { total: val + struct + styleBonus, val, struct, styleBonus, pairs, nfit, ap, ad };
}

// Recherche en faisceau, poste par poste. candidates : { ROLE: [ids] }
function beamSearch(candidates, style, exclude = [], width = 60, maxCommon = 3) {
  const reuse = {}; exclude.forEach(t => ROLES.forEach(r => { reuse[t[r]] = (reuse[t[r]] || 0) + 1; }));
  const order = ['SUPPORT', 'ADC', 'JUNGLE', 'MID', 'TOP'];
  let beam = [{ team: {}, used: new Set() }];
  for (const r of order) {
    const next = [];
    for (const st of beam) {
      for (const id of (candidates[r] || [])) {
        if (st.used.has(id)) continue;
        const team = { ...st.team, [r]: id };
        const used = new Set(st.used); used.add(id);
        next.push({ team, used, s: teamScore(team, style, reuse).total });
      }
    }
    next.sort((a, b) => b.s - a.s);
    beam = next.slice(0, width);
    if (!beam.length) return [];
  }
  return beam.filter(st => !exclude.some(ex => ROLES.filter(r => ex[r] === st.team[r]).length > maxCommon)).map(st => st.team);
}

function candidatesFor(style, perRole = 12) {
  const all = (DATA.builds && DATA.builds.builds) || {};
  const out = {};
  ROLES.forEach(r => {
    const ids = Object.keys(all).filter(k => k.endsWith('|' + ({ TOP: 'TOP', JUNGLE: 'JUNGLE', MID: 'MIDDLE', ADC: 'BOTTOM', SUPPORT: 'UTILITY' })[r]) && all[k].n >= 40).map(k => k.split('|')[0]).filter(id => DATA.champs[id] || !Object.keys(DATA.champs).length);
    out[r] = ids.map(id => [id, champValue(id, r) + (style ? style.fit(id, r) * 0.8 : 0)]).sort((a, b) => b[1] - a[1]).slice(0, perRole).map(x => x[0]);
  });
  return out;
}

// Décrit une compo (textes en français, chiffres réels)
export function describeTeam(team, style, championsById) {
  const S = teamScore(team, style);
  const ids = ROLES.map(r => team[r]);
  const champObjs = ROLES.map(r => championsById[team[r]]).filter(Boolean);
  const byRole = {}; ROLES.forEach(r => { byRole[r] = championsById[team[r]] || { id: team[r] }; });
  const draftScore = champObjs.length === 5 ? calculateDraftScore(champObjs, [], byRole, {}) : null;
  const sumWr = ROLES.reduce((s, r) => s + champValue(team[r], r), 0) * TEAM_FACTOR + S.pairs.filter(p => W(p.ra, p.rc) === 1).reduce((s, p) => s + p.v, 0) * 0.5;
  const winRate = Math.round(clamp(50 + sumWr, 42, 58) * 10) / 10;
  const synergies = S.pairs.filter(p => p.v > 0.2).sort((a, b) => b.v - a.v).slice(0, 3).map(p => `${cname(p.a)} + ${cname(p.c)} : ${p.wr} % de victoires ensemble (${p.n} parties)`);
  const strengths = [], weaknesses = [];
  const eng = ids.filter(isEngager), fr = ids.filter(isFront);
  if (eng.length >= 2) strengths.push(`Plusieurs engages : ${eng.map(cname).join(', ')}`); else if (eng.length === 1) strengths.push(`Engage fiable : ${cname(eng[0])}`);
  if (fr.length >= 2) strengths.push(`Frontline solide : ${fr.map(cname).join(', ')}`);
  if (S.ap >= 2 && S.ad >= 2) strengths.push('Dégâts mixtes : difficile à itemiser pour l\'adversaire');
  const best = ROLES.map(r => [r, team[r], BUILD(team[r], r)]).filter(x => x[2]).sort((a, b) => shrink(b[2].wr, b[2].n, 300) - shrink(a[2].wr, a[2].n, 300))[0];
  if (best) strengths.push(`${cname(best[1])} (${ROLE_FR[best[0]]}) : ${best[2].wr} % sur ${best[2].n} parties au patch`);
  if (!fr.length) weaknesses.push('Pas de vraie frontline : attention aux combats longs');
  if (!eng.length) weaknesses.push('Peu d\'engage : il faut attendre les erreurs adverses');
  if (S.ap === 0) weaknesses.push('Full AD : l\'adversaire peut tout miser sur l\'armure');
  if (S.ad === 0) weaknesses.push('Full AP : l\'adversaire peut tout miser sur la résistance magique');
  const blind = ROLES.filter(r => blindKind(team[r], r) === 'counter').map(r => cname(team[r]));
  if (blind.length) weaknesses.push(`À garder pour la fin de draft (facile à contrer) : ${blind.join(', ')}`);
  if (!weaknesses.length) weaknesses.push('Pas de faiblesse structurelle nette : la différence se fera sur l\'exécution');
  const syn = detectSynergies(champObjs);
  return {
    playstyle: style.playstyle,
    winCondition: style.key === 'balanced' ? getWinCondition(syn) === 'Jouer safe et farm' ? style.winCondition : `${getWinCondition(syn)} — ${style.winCondition}` : style.winCondition,
    description: `Compo construite à partir des champions les plus solides du patch à chaque poste (parties Challenger / GM / Master) et des paires qui gagnent ensemble. Victoire estimée face à une compo moyenne : ${winRate} %.`,
    champions: ROLES.map(r => ({ id: team[r], name: championsById[team[r]]?.name || cname(team[r]), role: r.toLowerCase() === 'adc' ? 'adc' : r.toLowerCase() })),
    composition: Object.fromEntries(ROLES.map(r => [r, championsById[team[r]]?.name || cname(team[r])])),
    winRate, draftScore, synergies: synergies.length ? synergies : ['Pas de paire mesurée sur assez de parties : synergie estimée par les profils'],
    strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 2), score: Math.round(S.total * 10) / 10,
  };
}

// 10 meilleures drafts du patch (une par style, puis des variantes)
export function computeBestDrafts(championsById, count = 10, width = 60) {
  if (!DATA.builds || !DATA.builds.builds) return [];
  const out = [], teams = [];
  const order = [...STYLES, ...STYLES.filter(s => s.key !== 'balanced')];
  for (const style of order) {
    if (out.length >= count) break;
    const res = beamSearch(candidatesFor(style, width >= 60 ? 12 : 9), style, teams, width);
    if (!res.length) continue;
    teams.push(res[0]);
    out.push(describeTeam(res[0], style, championsById));
  }
  const patch = DATA.builds.patch;
  return out.map(d => ({ ...d, patch }));
}

// Drafts personnalisées pour 5 joueurs : chaque champion doit être dans le pool du joueur à ce poste
export function computeCustomDrafts(teamAssignment, championsById, count = 4) {
  const byName = {}; Object.values(championsById).forEach(c => { byName[c.name.toLowerCase()] = c.id; byName[c.id.toLowerCase()] = c.id; });
  const cand = {};
  ROLES.forEach(r => { cand[r] = [...new Set(((teamAssignment[r] && teamAssignment[r].pools && teamAssignment[r].pools[r]) || []).map(n => byName[String(n).toLowerCase()]).filter(Boolean))]; });
  if (ROLES.some(r => !cand[r].length)) return [];
  const out = [], teams = [];
  for (const style of STYLES) {
    if (out.length >= count) break;
    const res = beamSearch(cand, style, teams, 80, 3);
    if (!res.length) continue;
    teams.push(res[0]);
    const d = describeTeam(res[0], style, championsById);
    out.push({ ...d, name: d.playstyle, description: d.description.replace('Compo construite à partir des champions les plus solides du patch à chaque poste', 'Compo tirée des pools de tes joueurs, notée avec les résultats réels de chaque champion à son poste') });
  }
  return out;
}
