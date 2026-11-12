// ============================================================
// DONNÉES DE JEU — chargement et lecture
// Sources :
//  - Data Dragon (Riot) : patch, champions, objets, runes, sorts (fr_FR)
//  - Données partagées de l'app Coach Support (même dépôt GitHub Pages) :
//      builds.json   : parties Challenger / GM / Master (EUW + Corée) : WR, builds, duos, adversaires
//      counters.json : duels par lane (Lolalytics, Émeraude+)
//      meta.json     : tiers support, profils, listes engage / frontline / assassins, timers
//  - data/combos.json, data/best-drafts.json : fichiers propres à DraftMaster
// Ce module est pur (pas de DOM au chargement) : il sert aussi aux scripts Node de tools/.
// ============================================================

export const DD = 'https://ddragon.leagueoflegends.com';
export const COACH_BASE_DEFAULT = 'https://nanileb.github.io/lol-support-coach/';
export const RELAY_DEFAULT = 'https://lol-support-coach.62z7h87vzm.workers.dev';

export const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
// Poste Riot (teamPosition) utilisé dans builds.json
export const POS = { TOP: 'TOP', JUNGLE: 'JUNGLE', MID: 'MIDDLE', ADC: 'BOTTOM', SUPPORT: 'UTILITY' };
export const POS_TO_ROLE = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUPPORT' };
// Lane de counters.json
export const CLANE = { TOP: 'top', JUNGLE: 'jungle', MID: 'middle', ADC: 'bottom', SUPPORT: 'support' };

export const DATA = {
  champs: {},      // id Data Dragon -> données brutes Data Dragon
  version: null,   // version Data Dragon (ex. 16.22.1)
  items: {},       // id objet -> { name, tags, gold, grp }
  runes: {},       // id rune / style -> nom
  builds: null,    // builds.json du coach
  cnt: null,       // counters.json du coach
  meta: null,      // meta.json du coach
  combos: {},      // championId -> combos (export Base44)
  rev: 0,          // incrémenté à chaque nouvelle donnée (pour les useMemo)
};

const EMPTY_META = { patch: '?', tiers: {}, winrates: {}, supports: {}, adcs: {}, pairs: {}, counters: {}, engagers: [], frontline: [], healers: [], assassins: [], hookers: [], junglers: {}, timers: { dragon: 300, dragonRespawn: 300, platesDecay: 660, laneEnd: 840, grubs: 480, grubsDespawn: 885, herald: 900, baron: 1200, elderAfterSoul: 360, scuttle: 175 }, lane: {}, items: {}, keystones: {} };
export const meta = () => DATA.meta || EMPTY_META;

export function setData(part) { Object.assign(DATA, part); DATA.rev++; }

// ------------------------------------------------------------
// Utilitaires
// ------------------------------------------------------------
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Taux de victoire ramené vers une valeur de référence quand il y a peu de parties
export const shrink = (wr, n, k, prior = 50) => Math.round(((wr * n) + prior * k) / (n + k) * 10) / 10;
export const fmtTime = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

export const champ = id => DATA.champs[id];
export const cname = id => (champ(id) ? champ(id).name : id) || '';
export const tags = id => (champ(id) && champ(id).tags) || [];
export const iname = id => (DATA.items[id] && DATA.items[id].name) || ('Objet ' + id);
export const iimg = id => DATA.version ? `${DD}/cdn/${DATA.version}/img/item/${id}.png` : '';
export const itemExists = id => !Object.keys(DATA.items).length || !!DATA.items[id];

// Les noms Riot ne suivent pas toujours la casse des ids Data Dragon (FiddleSticks / Fiddlesticks) :
// on les ramène à l'id Data Dragon (correction C2 de la méga recette).
export function fixIds(o) {
  if (!o || !Object.keys(DATA.champs).length) return o;
  const low = {}; Object.keys(DATA.champs).forEach(id => { low[id.toLowerCase()] = id; });
  let n = 0;
  const txt = JSON.stringify(o).replace(/"([A-Za-z]+)(\|[A-Z]+)?"/g, (m, c, p) => {
    if (DATA.champs[c] || !low[c.toLowerCase()]) return m;
    n++; return '"' + low[c.toLowerCase()] + (p || '') + '"';
  });
  return n ? JSON.parse(txt) : o;
}

// ------------------------------------------------------------
// Lecture des données
// ------------------------------------------------------------
export const BUILD = (id, role) => (DATA.builds && DATA.builds.builds && DATA.builds.builds[id + '|' + POS[role]]) || null;

// Duel de lane (counters.json). wr = taux de victoire de `me` contre `opp`.
export function counterDuel(me, opp, role) {
  const L = DATA.cnt && DATA.cnt.lanes && DATA.cnt.lanes[CLANE[role]]; if (!L || !me || !opp) return null;
  const a = L[me] && L[me].vs[opp], o = L[opp] && L[opp].vs[me];
  const x = a && (!o || a[1] >= o[1]) ? [a[0], a[1]] : o ? [Math.round((100 - o[0]) * 100) / 100, o[1]] : null;
  if (!x) return null;
  const avg = L[me] ? L[me].avg : o && L[opp] ? 100 - L[opp].avg : 50;
  return { wr: x[0], n: x[1], avg: Math.round(avg * 10) / 10 };
}
// Résultat d'un duel exploitable : au moins 20 parties (recette 2, point 2)
export function duelResult(me, opp, role) {
  const cd = counterDuel(me, opp, role);
  if (cd && cd.n >= 20) return { wr: Math.round(cd.wr), n: cd.n, avg: cd.avg, source: 'counters' };
  // à défaut : adversaire direct dans builds.json (parties des meilleurs joueurs)
  const b = BUILD(me, role), e = b && (b.opp || []).find(x => x[0] === opp && x[1] >= 20);
  if (e) return { wr: Math.round(e[2]), n: e[1], avg: b.wr, source: 'builds' };
  return { wr: null, n: cd ? cd.n : 0 };
}

// Force des niveaux 1-3 d'après les profils écrits (ADC, supports) ; inconnue pour les autres champions
export const earlyOf = id => { const p = meta().adcs[id] || meta().supports[id]; return p && p.early != null ? p.early : null; };

// Type de dégâts réel (corrections 6 et C1) : tanks magiques d'abord, puis part d'objets AP / AD achetés
const MAGIC_TANKS = ['Galio', 'Maokai', 'Amumu', 'Zac', 'Malphite', 'Sejuani', 'Rell', 'Nautilus', 'Leona', 'Alistar', 'Rammus', 'Nunu', 'Gragas', 'Chogath', 'Braum', 'Taric', 'Poppy', 'Ornn', 'TahmKench', 'Skarner', 'Zyra'];
const PHYS_TANKS = ['Sion', 'KSante', 'Thresh', 'Blitzcrank', 'Pyke'];
export function dmgShare(id, role) {
  const all = (DATA.builds && DATA.builds.builds) || {};
  const keys = role && all[id + '|' + POS[role]] ? [id + '|' + POS[role]] : Object.keys(all).filter(k => k.split('|')[0] === id);
  let ap = 0, ad = 0;
  keys.forEach(k => (all[k].pool || []).forEach(([iid, p]) => {
    const t = (DATA.items[iid] && DATA.items[iid].tags) || [], w = p * (all[k].n || 1);
    const sp = t.includes('SpellDamage'), ph = t.includes('Damage') || t.includes('CriticalStrike') || t.includes('AttackSpeed');
    if (sp && ph) { ap += w / 2; ad += w / 2; } else if (sp) ap += w; else if (ph) ad += w;
  }));
  return ap + ad ? { ap: ap / (ap + ad), ad: ad / (ap + ad) } : null;
}
export function isAP(id, role) {
  if (MAGIC_TANKS.includes(id)) return true; if (PHYS_TANKS.includes(id)) return false;
  const d = dmgShare(id, role); if (d && d.ap > 0.6) return true; if (d && d.ad > 0.6) return false;
  const p = meta().supports[id]; if (p && p.dmg === 'ap') return true; if (p && p.dmg === 'ad') return false;
  const i = (champ(id) && champ(id).info) || {}; return (i.magic || 0) > (i.attack || 0);
}
export const inList = (list, id) => (meta()[list] || []).includes(id);
export const isEngager = id => inList('engagers', id) || (meta().supports[id] && meta().supports[id].engage >= 3);
export const isFront = id => inList('frontline', id) || tags(id).includes('Tank');
export const isAssassin = id => inList('assassins', id);
export const isHealer = id => inList('healers', id);

// Postes réellement joués : builds.json (≥ 15 parties) puis counters.json ; à défaut, les tags Data Dragon
export function dataRoles(id) {
  const out = [];
  const all = (DATA.builds && DATA.builds.builds) || {};
  ROLES.map(r => [r, all[id + '|' + POS[r]]]).filter(([, b]) => b && b.n >= 15).sort((a, b) => b[1].n - a[1].n).forEach(([r]) => out.push(r));
  const L = DATA.cnt && DATA.cnt.lanes;
  if (L) ROLES.forEach(r => { const e = L[CLANE[r]] && L[CLANE[r]][id]; if (e && e.n >= 300 && !out.includes(r)) out.push(r); });
  return out;
}
// Poste principal (le plus joué chez les meilleurs joueurs)
export function mainRole(id) { const r = dataRoles(id); return r[0] || null; }

// ------------------------------------------------------------
// Classement d'un champion à un poste (port de scoreRole du coach, corrections 7, 8, 9, recette 2 n°1, C5)
// ally / enemy : { TOP: 'Id' | null, ... } (ids Data Dragon)
// ------------------------------------------------------------
const ARMOR_TANKS = ['Malphite', 'Rammus', 'KSante', 'Ornn', 'Leona', 'Sion', 'Poppy', 'Shen', 'Braum', 'Nautilus', 'Alistar', 'Sejuani', 'Zac', 'Galio'];
const MR_TANKS = ['Galio', 'Chogath', 'Kassadin', 'Mordekaiser', 'Gragas', 'Maokai', 'Braum', 'Malphite', 'Sion', 'Ornn', 'KSante'];
const TANK_SHREDDERS = ['Vayne', 'Gwen', 'Fiora', 'KogMaw', 'Kaisa', 'Brand', 'Cassiopeia', 'Mordekaiser', 'Darius', 'Lillia', 'Azir', 'Varus', 'Kindred', 'Belveth', 'Viego'];
export const BLIND_SAFE = { TOP: ['KSante', 'Gnar', 'Malphite', 'Ornn', 'Jax', 'Sion'], JUNGLE: ['JarvanIV', 'Vi', 'Sejuani', 'Maokai'], MID: ['Orianna', 'Ahri', 'Galio', 'Taliyah', 'Syndra'], ADC: ['Ezreal', 'Jhin', 'Caitlyn', 'Varus'], SUPPORT: ['Nautilus', 'Rakan', 'Karma', 'Braum', 'Bard'] };
export const COUNTERABLE = { TOP: ['Olaf', 'Renekton', 'Darius', 'Garen', 'Teemo', 'Vayne', 'Nasus'], JUNGLE: ['Nidalee', 'Evelynn', 'Shaco'], MID: ['Kassadin', 'Veigar', 'Lux', 'Xerath', 'Zed'], ADC: ['Draven', 'Samira', 'Twitch', 'Nilah'], SUPPORT: ['Yuumi', 'Sona', 'Soraka', 'Pyke'] };
// Listes à la main d'abord, sinon la base de counters (C5)
export function blindKind(id, role) {
  if ((BLIND_SAFE[role] || []).includes(id)) return 'safe';
  if ((COUNTERABLE[role] || []).includes(id)) return 'counter';
  const L = DATA.cnt && DATA.cnt.lanes && DATA.cnt.lanes[CLANE[role]], c = L && L[id]; if (!c) return null;
  const v = Object.values(c.vs).filter(x => x[1] >= 200);
  const bad = v.filter(x => x[0] <= 46).length;
  if (bad >= 3 && bad >= v.length * 0.12) return 'counter';
  if (v.length >= 8 && !v.some(x => x[0] < 48)) return 'safe';
  return null;
}
// Duel sans assez de parties : petite estimation d'après les profils, plafonnée à ±2
function duelHeuristic(me, opp, role) {
  const rng = c => ((champ(c) || {}).stats || {}).attackrange >= 300, tm = tags(me), to = tags(opp);
  if ((meta().counters[me] || []).includes(opp)) return [2, `bon contre ${cname(opp)}`];
  if ((meta().counters[opp] || []).includes(me)) return [-2, `${cname(opp)} le contre`];
  if (role === 'JUNGLE') return null;
  if (rng(me) && !rng(opp)) return [1.5, `portée contre ${cname(opp)} (corps à corps)`];
  if (!rng(me) && rng(opp)) return [-1.5, `${cname(opp)} a la portée sur toi`];
  if (tm[0] === 'Tank' && to.includes('Assassin')) return [1, `tank solide contre ${cname(opp)} (assassin)`];
  if (to[0] === 'Tank' && (tm.includes('Mage') || tm.includes('Marksman'))) return [1, `dégâts soutenus contre ${cname(opp)} (tank)`];
  return null;
}

export function scoreChampion(id, role, ally = {}, enemy = {}) {
  const R = [], b = BUILD(id, role);
  const al = ROLES.filter(r => r !== role).map(r => ally[r]).filter(Boolean);
  const en = ROLES.map(r => enemy[r]).filter(Boolean);
  let s, base, est = true;
  const parts = [];
  if (b) { base = shrink(b.wr, b.n, 300); s = base; }
  else if (role === 'SUPPORT' && meta().winrates[id]) { base = meta().winrates[id]; s = shrink(base, 200, 300); }
  else { base = 50; s = 50; est = false; }
  // Poids de chaque paire : 1 = duel de lane / duo bot ; 0,5 = jungler ; 0,25 = paires qui se croisent peu
  const W = (r, isEnemy) => { const bot = ['ADC', 'SUPPORT'];
    if (isEnemy && r === role) return 1;
    if (bot.includes(role) && bot.includes(r)) return 1;
    if (role === 'JUNGLE' || r === 'JUNGLE') return 0.5;
    return 0.25; };
  const CFG = { 1: { min: 20, k: 100, cap: 4 }, 0.5: { min: 30, k: 150, cap: 2 }, 0.25: { min: 50, k: 200, cap: 1.5 } };
  const off = [];
  const add = (v, txt, w = 1) => { v = clamp(v, -CFG[w].cap, CFG[w].cap); if (Math.abs(v) < 0.5) return; if (w < 1) return off.push([v, txt, w]); s += v; parts.push([v, txt, w]); };
  const finder = w => (list, c) => (list || []).find(x => x[0] === c && x[1] >= CFG[w].min);
  const pairDelta = (e, prior, w) => (shrink(e[2], e[1], CFG[w].k, prior) - prior) * w;
  const wtag = w => w === 1 ? '' : w === 0.5 ? ', poids ½' : ', poids ¼';
  if (b) {
    ROLES.filter(r => r !== role).forEach(r => {
      const a = ally[r]; if (!a) return;
      const w = W(r, false), find = finder(w);
      const duo = (role === 'ADC' && r === 'SUPPORT') || (role === 'SUPPORT' && r === 'ADC');
      const e = duo ? (find(b.duo, a) || find(b.with, a)) : find(b.with, a);
      if (e) add(pairDelta(e, b.wr, w), `${e[2]} % avec ${cname(a)} au lieu de ${b.wr} % (${e[1]} parties${wtag(w)})`, w);
      else { const ab = BUILD(a, r), e2 = ab && find(ab.with, id); if (e2) add(pairDelta(e2, ab.wr, w), `${e2[2]} % quand ${cname(a)} joue avec lui (${e2[1]} parties${wtag(w)})`, w); }
    });
  }
  ROLES.forEach(r => {
    const e = enemy[r]; if (!e) return;
    const direct = r === role;
    if (direct) {
      const cd = counterDuel(id, e, role);
      if (cd && cd.n >= 20) add((shrink(cd.wr, cd.n, 200, cd.avg) - cd.avg) * 1.3, `${Math.round(cd.wr)} % contre ${cname(e)} (duel) au lieu de ${Math.round(cd.avg)} % (${cd.n} parties ${DATA.cnt.rank}, ${DATA.cnt.source})`);
      else { const h = duelHeuristic(id, e, role); if (h) add(h[0], h[1] + ' (estimation, duel absent de la base de counters)'); }
      return;
    }
    if (!b) return;
    const w = W(r, true), find = finder(w);
    const x = find(b.vsAll, e);
    if (x) add(pairDelta(x, b.wr, w), `${x[2]} % contre ${cname(e)} au lieu de ${b.wr} % (${x[1]} parties${wtag(w)})`, w);
    else { const eb = BUILD(e, r), y = eb && find(eb.vsAll, id); if (y) add((eb.wr - shrink(y[2], y[1], CFG[w].k, eb.wr)) * w, `${Math.round((100 - y[2]) * 10) / 10} % contre ${cname(e)} (${y[1]} parties${wtag(w)})`, w); }
  });
  { const tot = off.reduce((a2, x) => a2 + x[0], 0), k2 = Math.abs(tot) > 4 ? 4 / Math.abs(tot) : 1;
    off.forEach(([v, txt, w]) => { v *= k2; if (Math.abs(v) < 0.3) return; s += v; parts.push([v, txt, w]); }); }
  // Besoins de compo (correction 8) : progressifs selon la part de l'équipe connue
  const need = (v, txt) => { if (Math.abs(v) < 0.3) return; s += v; parts.push([v, txt]); };
  const T = tags(id), tanky = T.includes('Tank') || isFront(id);
  const fa = Math.min(1, al.length / 4), fe = Math.min(1, en.length / 5);
  if (al.length) {
    const ap = al.filter(a => isAP(a)).length, ad = al.length - ap;
    if (ap === 0 && al.length >= 2 && isAP(id, role)) need(4 * fa, `apporte des dégâts magiques (${ad} allié${ad > 1 ? 's' : ''} AD, aucun AP)`);
    if (ad === 0 && al.length >= 2 && !isAP(id, role)) need(4 * fa, `apporte des dégâts physiques (${ap} alliés AP, aucun AD)`);
    if (al.length >= 3 && ap >= al.length - 1 && ad <= 1 && isAP(id, role)) need(-2 * fa, 'ton équipe a déjà beaucoup de dégâts magiques');
    if (!al.some(isFront) && tanky) need((T[0] === 'Tank' ? 4 : 2) * fa, `ton équipe n'a pas de frontline${al.length < 4 ? ' pour l\'instant' : ''}`);
    if (!al.some(isEngager) && isEngager(id)) need(3 * fa, `ton équipe n'a pas d'engage${al.length < 4 ? ' pour l\'instant' : ''}`);
    if (al.filter(isFront).length >= 2 && T[0] === 'Tank' && role !== 'SUPPORT') need(-1.5 * fa, 'ton équipe a déjà deux frontlines');
  }
  if (en.length) {
    const ead = en.filter(e => !isAP(e)).length, eap = en.length - ead, ass = en.filter(isAssassin).length, fr = en.filter(e => tags(e)[0] === 'Tank').length;
    if (ARMOR_TANKS.includes(id) && ead - eap >= 2) need(Math.min(3, (ead - eap) * 0.75), `résiste bien à leurs dégâts physiques (${ead} AD, ${eap} AP)`);
    if (MR_TANKS.includes(id) && eap - ead >= 1) need(Math.min(3, (eap - ead) * 0.75), `tient bien face à leurs dégâts magiques (${eap} AP, ${ead} AD)`);
    if (ass && (isEngager(id) || (meta().supports[id] || {}).peel >= 3)) need(Math.min(2.5, ass * 1.1), `${ass} plongeur${ass > 1 ? 's' : ''} en face : ton contrôle / peel compte`);
    if (ass >= 2 && T.includes('Marksman') && !(meta().adcs[id] || {}).self) need(-1, `${ass} plongeurs en face : tireur fragile`);
    if (fr >= 2 && TANK_SHREDDERS.includes(id)) need(Math.min(2, fr * 0.7) * fe + 0.5, `${fr} tanks en face : il fait fondre les gros PV`);
  }
  // Pick à l'aveugle : adversaire direct pas encore choisi (corrections 9 et C5)
  let blind = false;
  const directOpen = role === 'ADC' || role === 'SUPPORT' ? !enemy.ADC && !enemy.SUPPORT : !enemy[role];
  if (directOpen) {
    const bk = blindKind(id, role);
    if (bk === 'safe') need(2, 'pick sûr à l\'aveugle (ton adversaire n\'est pas encore choisi)');
    if (bk === 'counter') { need(-3, 'risque de contre-pick : ton adversaire choisit après toi'); blind = true; }
  }
  parts.sort((a, b2) => Math.abs(b2[0]) - Math.abs(a[0]));
  if (b) R.push(`${b.wr} % de victoires chez les meilleurs joueurs (${b.n} parties)`);
  else if (role === 'SUPPORT' && meta().winrates[id]) R.push(`${meta().winrates[id]} % de victoires (tier list support ${meta().patch})`);
  else R.push('pas assez de parties chez les meilleurs joueurs sur ce champion à ce poste');
  parts.forEach(([v, txt]) => R.push(`${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pt · ${txt}`));
  // Score borné à [42 ; 58] % (correction 7)
  const score = clamp(Math.round(50 + 10 * Math.tanh((s - 50) / 10)), 42, 58);
  return { id, role, score, raw: s, base, reasons: R, parts, n: b ? b.n : 0, est, blind };
}

// ------------------------------------------------------------
// Victoire estimée d'une compo contre une autre (par poste)
// Somme des écarts au 50 % de chaque champion + duels de lane, bornée à [42 ; 58] %
// ------------------------------------------------------------
export function teamEstimate(ally = {}, enemy = {}) {
  let d = 0; const detail = [];
  ROLES.forEach(r => {
    const a = ally[r], e = enemy[r];
    // 40 % de l'écart individuel se retrouve dans le résultat d'équipe (les écarts ne s'additionnent pas pleinement)
    if (a) { const b = BUILD(a, r); if (b) { const v = (shrink(b.wr, b.n, 300) - 50) * 0.4; d += v; } }
    if (e) { const b = BUILD(e, r); if (b) { const v = (shrink(b.wr, b.n, 300) - 50) * 0.4; d -= v; } }
    if (a && e) {
      const cd = counterDuel(a, e, r);
      if (cd && cd.n >= 20) { const v = clamp(shrink(cd.wr, cd.n, 200, cd.avg) - cd.avg, -4, 4); d += v; detail.push([r, v, cd]); }
    }
  });
  // duo bot allié / adverse
  const duo = (adc, sup) => { const b = adc && sup && BUILD(adc, 'ADC'); const e = b && ((b.duo || []).find(x => x[0] === sup && x[1] >= 20) || (b.with || []).find(x => x[0] === sup && x[1] >= 20)); return e ? clamp(shrink(e[2], e[1], 100, b.wr) - b.wr, -3, 3) : 0; };
  d += duo(ally.ADC, ally.SUPPORT) - duo(enemy.ADC, enemy.SUPPORT);
  return { win: clamp(Math.round(50 + d), 42, 58), delta: d, detail };
}

// ------------------------------------------------------------
// Tier list d'un poste, calculée sur builds.json (meta.json pour les supports quand il y a un tier écrit)
// ------------------------------------------------------------
export function tierOf(sw, pr) {
  if (sw >= 51.5 && pr >= 2) return 'S+';
  if (sw >= 51) return 'S';
  if (sw >= 50.2) return 'A';
  if (sw >= 49.3) return 'B';
  return 'C';
}
export function championStat(id, role) {
  const b = BUILD(id, role); const games = (DATA.builds && DATA.builds.games) || 0;
  const M = meta();
  if (!b) {
    if (role === 'SUPPORT' && M.tiers[id]) return { championId: id, role, tier: M.tiers[id] === 'D' ? 'C' : M.tiers[id], winRate: M.winrates[id] || null, pickRate: null, games: 0, source: 'meta' };
    return null;
  }
  const pr = games ? Math.round(b.n / games * 1000) / 10 : null;
  const sw = shrink(b.wr, b.n, 300);
  let tier = tierOf(sw, pr || 0);
  if (role === 'SUPPORT' && M.tiers[id]) tier = M.tiers[id] === 'D' ? 'C' : M.tiers[id];
  return { championId: id, role, tier, winRate: b.wr, pickRate: pr, games: b.n, adjusted: sw, source: 'builds' };
}

// ------------------------------------------------------------
// Fiche champion (remplace la fonction Base44 getChampionDetails, qui appelait une IA)
// ------------------------------------------------------------
export function skillOrderFrom(b) {
  // b.skills = priorité de montée (ex. "QWE"), b.early = 3 premiers niveaux (ex. "QWE")
  if (!b || !b.skills) return [];
  const prio = b.skills.split(''), first = (b.early || b.skills).split('').slice(0, 3);
  const lv = { Q: 0, W: 0, E: 0, R: 0 }, out = [];
  for (let L = 1; L <= 18; L++) {
    let k;
    if ([6, 11, 16].includes(L)) k = 'R';
    else if (L <= 3 && first[L - 1]) k = first[L - 1];
    else k = prio.find(x => lv[x] < 5 && lv[x] < Math.ceil(L / 2));
    if (!k) k = prio.find(x => lv[x] < 5) || 'Q';
    lv[k]++; out.push(k);
  }
  return out;
}
export function championDetails(id, role) {
  const b = BUILD(id, role);
  const L = DATA.cnt && DATA.cnt.lanes && DATA.cnt.lanes[CLANE[role]];
  const c = L && L[id];
  let counters = [], counteredBy = [], counterLabels = {}, counterTips = null;
  if (c) {
    const rows = Object.entries(c.vs).filter(([, x]) => x[1] >= 100).map(([o, x]) => [o, x[0], x[1]]);
    counteredBy = rows.filter(x => x[1] <= c.avg - 2).sort((a, b2) => a[1] - b2[1]).slice(0, 5).map(x => { counterLabels[x[0]] = Math.round(x[1]) + ' %'; return x[0]; });
    counters = rows.filter(x => x[1] >= c.avg + 2).sort((a, b2) => b2[1] - a[1]).slice(0, 5).map(x => { counterLabels[x[0]] = Math.round(x[1]) + ' %'; return x[0]; });
    counterTips = `Taux de victoire de ${cname(id)} contre chaque adversaire direct (${DATA.cnt.source}, ${DATA.cnt.rank}, patch ${DATA.cnt.patch}). Moyenne du champion : ${c.avg} %. Seuls les duels d'au moins 100 parties sont affichés.`;
  } else if (b && b.opp && b.opp.length) {
    const rows = b.opp.filter(x => x[1] >= 20);
    counteredBy = rows.filter(x => x[2] <= 45).sort((a, b2) => a[2] - b2[2]).slice(0, 5).map(x => { counterLabels[x[0]] = x[2] + ' %'; return x[0]; });
    counters = rows.filter(x => x[2] >= 55).sort((a, b2) => b2[2] - a[2]).slice(0, 5).map(x => { counterLabels[x[0]] = x[2] + ' %'; return x[0]; });
    counterTips = `Duel absent de la base de counters : taux tirés des parties Challenger / GM / Master (au moins 20 parties par duel).`;
  }
  let synergies = [], synergyTips = null;
  if (b && (role === 'ADC' || role === 'SUPPORT')) {
    const partner = role === 'ADC' ? 'SUPPORT' : 'ADC';
    const list = (b.duo && b.duo.length ? b.duo : (b.with || []).filter(x => dataRoles(x[0]).includes(partner))).filter(x => x[1] >= 20);
    synergies = list.map(x => ({ championId: x[0], reason: `${x[2]} % (${x[1]})`, score: shrink(x[2], x[1], 100, b.wr) })).sort((a, b2) => b2.score - a.score).slice(0, 5);
    const pairs = meta().pairs[id] ? Object.entries(meta().pairs[id]).sort((a, b2) => b2[1] - a[1]).slice(0, 3).map(([k]) => cname(k)) : [];
    synergyTips = `Taux de victoire du duo chez les meilleurs joueurs (parties entre parenthèses, au moins 20).` + (pairs.length ? ` Duos reconnus : ${pairs.join(', ')}.` : '');
  }
  return {
    skillOrder: skillOrderFrom(b),
    combos: (DATA.combos[id] || []),
    counters, counteredBy, counterLabels, counterTips, synergies, synergyTips,
    spells: b ? b.spells : null, runes: b ? b.runes : null, games: b ? b.n : 0,
  };
}
