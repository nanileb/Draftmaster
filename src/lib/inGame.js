// En jeu : lane, chronologie et ordre d'achat. Port des onglets « Lane / Botlane / Jungle », « Timings » et
// de la mise en page du build du coach LoL (lol-support-coach/app.js), adapté aux postes de DraftMaster (TOP … SUPPORT).
// Partie en jeu : m = { role, me, ally: { TOP: id, … }, enemy: { TOP: id, … }, side: 'blue' | 'red', kills }
import { DATA, DD, meta, cname, tags, champ, iname, itemExists, BUILD, counterDuel, shrink, earlyOf, isAP, isEngager, isFront, inList } from './gameData.js';

export const ROLE_ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
export const LANE_TAB = { TOP: 'Lane', JUNGLE: 'Jungle', MID: 'Lane', ADC: 'Botlane', SUPPORT: 'Botlane' };
export const fmt = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

// ------------------------------------------------------------
// Données Data Dragon en plus : icônes de runes et de sorts d'invocateur (une fois par version)
// ------------------------------------------------------------
const IG = { v: null, runes: {}, sums: {}, p: null };
export function loadInGameExtras(version) {
  if (!version) return Promise.resolve(IG);
  if (IG.v === version) return Promise.resolve(IG);
  if (IG.p) return IG.p;
  IG.p = Promise.all([
    fetch(`${DD}/cdn/${version}/data/fr_FR/runesReforged.json`).then(r => r.json()).catch(() => []),
    fetch(`${DD}/cdn/${version}/data/fr_FR/summoner.json`).then(r => r.json()).catch(() => ({})),
  ]).then(([ru, su]) => {
    const runes = {};
    (ru || []).forEach(st => { runes[st.id] = { name: st.name, icon: st.icon }; (st.slots || []).forEach(sl => (sl.runes || []).forEach(r => { runes[r.id] = { name: r.name, icon: r.icon }; })); });
    const sums = {};
    Object.values((su && su.data) || {}).forEach(s => { sums[s.key] = { name: s.name, img: s.image && s.image.full }; });
    Object.assign(IG, { v: version, runes, sums, p: null });
    return IG;
  });
  return IG.p;
}
export const runeIcon = id => IG.runes[id] ? `${DD}/cdn/img/${IG.runes[id].icon}` : '';
export const runeName = id => (IG.runes[id] && IG.runes[id].name) || (DATA.runes && DATA.runes[id]) || '';
export const sumIcon = k => IG.sums[k] && IG.sums[k].img && DATA.version ? `${DD}/cdn/${DATA.version}/img/spell/${IG.sums[k].img}` : '';
export const sumName = k => (IG.sums[k] && IG.sums[k].name) || '';

// ------------------------------------------------------------
// Ordre d'achat réel : composants puis assemblage, en réutilisant ce qui est déjà dans l'inventaire (planBuys du coach)
// ------------------------------------------------------------
const item = id => (DATA.items && DATA.items[String(id)]) || null;
const fromOf = id => ((item(id) && item(id).from) || []).map(String);
const totalOf = id => (item(id) && item(id).gold) || 0;
// Prix de l'assemblage seul = prix total moins celui des composants
const baseOf = id => Math.max(0, totalOf(id) - fromOf(id).reduce((s, c) => s + totalOf(c), 0));
export function planBuys(order, opt = {}) {
  const steps = [], inv = [];
  const add = (grp, id, kind, why) => {
    const last = steps[steps.length - 1];
    if (last && last.grp === grp && last.id === String(id) && kind === 'buy' && last.kind === 'buy') { last.qty++; last.cost += totalOf(id); return; }
    steps.push({ grp, id: String(id), kind, qty: 1, why, cost: kind === 'finish' ? baseOf(id) : totalOf(id) });
  };
  (opt.start || []).map(String).sort((a, b) => totalOf(b) - totalOf(a)).forEach(id => { add('Départ', id, 'buy'); inv.push(id); });
  const bootsId = opt.boots ? String(opt.boots) : null;
  if (opt.support) {
    const basic = bootsId ? (fromOf(bootsId).find(c => !fromOf(c).length) || (itemExists('1001') ? '1001' : null)) : null;
    if (basic) { add('1er retour', basic, 'buy'); inv.push(basic); }
    if (itemExists('2055')) add('1er retour', '2055', 'buy');
  }
  // Un seul niveau de composants pour tenir sur une ligne de téléphone
  const expand = (grp, id, why, depth = 0) => {
    const comps = fromOf(id);
    if (!comps.length || depth >= 1) { add(grp, id, 'buy', why); return; }
    comps.forEach(c => { const k = inv.indexOf(c); if (k >= 0) inv.splice(k, 1); else expand(grp, c, undefined, depth + 1); });
    add(grp, id, 'finish', why);
  };
  let n = 0;
  (opt.order || order).forEach(o => {
    const id = String(o.id || o);
    const grp = id === bootsId ? 'boots' : 'item' + (++n);
    expand(grp, id, o.why);
  });
  // Regroupe en lignes affichables
  const groups = [];
  steps.forEach(st => { let g = groups.find(x => x.key === st.grp); if (!g) groups.push(g = { key: st.grp, items: [] }); g.items.push(st); });
  return groups;
}

// Ordre des objets à partir du build de DraftMaster (recommendedBuild) : 1er objet, bottes, objets « contre eux » urgents, puis la suite
export function buildOrder(build, role) {
  if (!build) return [];
  const seq = [];
  const add = (id, why, vs) => { id = String(id || ''); if (id && itemExists(id) && !seq.find(x => x.id === id)) seq.push({ id, why, vs }); };
  const core = build.core || [], sit = build.situational || [];
  add(core[0], 'premier objet des meilleurs joueurs');
  if (role === 'ADC') add(core[1], 'objet de base'); // en ADC, le pic de dégâts passe avant la défense
  sit.slice(0, 1).forEach(x => add(x.id, x.why, true));
  core.slice(1, 2).forEach(id => add(id, 'objet de base'));
  sit.slice(1).forEach(x => add(x.id, x.why, true));
  core.slice(2).forEach(id => add(id, 'objet de base'));
  const order = seq.slice(0, 4);
  if (build.boots) order.splice(Math.min(1, order.length), 0, { id: String(build.boots), why: 'bottes' });
  return order;
}

// ------------------------------------------------------------
// Profils (supports / ADC) et menaces adverses
// ------------------------------------------------------------
export function supProfile(id) {
  const p = meta().supports[id];
  if (p) return p;
  const t = tags(id), info = (champ(id) && champ(id).info) || {};
  const ap = (info.magic || 0) > (info.attack || 0);
  if (t.includes('Tank')) return { arch: 'engage', early: 2, engage: 2, poke: 0, sustain: 0, peel: 2, scale: 2, dmg: 'tank' };
  if (t.includes('Support')) return { arch: ap ? 'enchanter' : 'engage', early: 2, engage: 1, poke: 1, sustain: 1, peel: 2, scale: 2, dmg: ap ? 'ap' : 'ad' };
  if (t.includes('Mage')) return { arch: 'mage', early: 2, engage: 0, poke: 2, sustain: 0, peel: 1, scale: 2, dmg: 'ap' };
  if (t.includes('Fighter') || t.includes('Assassin')) return { arch: 'engage', early: 2, engage: 2, poke: 0, sustain: 0, peel: 1, scale: 1, dmg: 'ad' };
  return { arch: 'mage', early: 2, engage: 1, poke: 2, sustain: 0, peel: 1, scale: 2, dmg: ap ? 'ap' : 'ad' };
}
export const adcProfile = id => meta().adcs[id] || { style: 'utility', early: 2, allin: 2, scale: 2, range: 'mid' };
const NON_CRIT = ['Ezreal', 'Varus', 'Kaisa', 'Corki', 'Ziggs', 'Seraphine', 'Hwei', 'Karthus', 'Mel', 'Swain', 'KogMaw', 'Vayne', 'Kalista', 'Twitch', 'Zeri', 'Smolder'];
export const mySpells = (id, role) => ((id && BUILD(id, role)) || {}).spells || [];

export function enemyThreats(m) {
  const en = ROLE_ORDER.map(r => m.enemy[r]).filter(Boolean);
  if (!en.length) return [];
  const ap = en.filter(e => isAP(e)).length, ad = en.length - ap;
  const heal = en.filter(e => inList('healers', e)), ass = en.filter(e => inList('assassins', e));
  const eng = en.filter(isEngager), front = en.filter(isFront);
  const eadc = m.enemy.ADC, crit = eadc && !NON_CRIT.includes(eadc) && tags(eadc).includes('Marksman');
  const chips = [{ tone: ap >= 3 ? 'warn' : '', text: `${ap} AP / ${ad} AD` }];
  if (heal.length >= 2) chips.push({ tone: 'bad', text: 'Soins : ' + heal.map(cname).join(', ') });
  if (ass.length >= 2) chips.push({ tone: 'bad', text: 'Plongeurs : ' + ass.map(cname).join(', ') });
  if (eng.length >= 3) chips.push({ tone: 'warn', text: 'Beaucoup de CC / engage' });
  if (front.length >= 3) chips.push({ tone: 'warn', text: `${front.length} tanks / frontline` });
  if (crit) chips.push({ tone: 'warn', text: 'ADC à crit' });
  return chips;
}

// ------------------------------------------------------------
// Lane : verdict, phases (botlane), sorts à surveiller, à faire / à éviter
// ------------------------------------------------------------
function laneScores(sup, adc) {
  const sp = supProfile(sup), ap = adcProfile(adc);
  return { early: ap.early * 1.2 + sp.early + sp.poke * 0.4, allin: ap.allin + sp.engage * 1.2 + sp.early * 0.5, late: ap.scale * 1.2 + sp.scale + sp.peel * 0.3 };
}
const ARCH_DO = {
  engage: (adc) => `Engage quand leur sort défensif ou leur Flash est tombé. ${adcProfile(adc).style === 'hyper' ? cname(adc) + ' scale mieux : ne force pas si ce n\'est pas propre.' : cname(adc) + ' suit bien tes engages.'}`,
  enchanter: (adc) => `Trade avec ${cname(adc)} (auto + ton sort) puis recule. Garde bouclier/soin pour leur engage.`,
  warden: (adc) => `Reste près de ${cname(adc)}, intercepte les projectiles, punis leur engage.`,
  mage: () => 'Poke dès qu\'ils s\'avancent pour un last-hit, garde ta portée.',
};
const ARCH_DONT = {
  engage: 'Engager seul quand ton ADC est loin ou en train de farmer',
  enchanter: 'Gaspiller ton bouclier/soin avant leur engage',
  warden: 'Partir en avant : ton rôle est de protéger',
  mage: 'Te placer devant tes sbires (tu es la cible facile)',
};
const ADC_DO = {
  engage: sup => `Suis les engages de ${cname(sup)} : sois à portée d'attaque quand il part.`,
  enchanter: sup => `Trade quand ${cname(sup)} peut te protéger, puis recule.`,
  warden: sup => `Joue derrière ${cname(sup)} et punis leur engage.`,
  mage: sup => `Profite du poke de ${cname(sup)} pour gagner la vague et les plaques.`,
};
// Un seul plan de lane : les conseils « pousse / pression » et « survis / farm en sécurité » ne s'affichent jamais ensemble
const PUSHY = /pousse|pression|prends l'avantage|agressi|engage tout de suite|prendre les plaques|roam mid dès/i;
const SAFE = /survis|farm près|laisse la vague|laisser la vague|farm prudemment|sécurité|jouer safe|recule d'un cran/i;
function coherentPlan(DO, tone) {
  const out = []; let side = tone === 'aggro' ? 'push' : tone === 'safe' ? 'safe' : null;
  for (const t of DO) {
    const k = PUSHY.test(t) && !SAFE.test(t) ? 'push' : SAFE.test(t) && !PUSHY.test(t) ? 'safe' : PUSHY.test(t) ? 'mixed' : null;
    if (k === 'mixed') { if (side) continue; out.push(t); continue; }
    if (k) { if (!side) side = k; if (k !== side) continue; }
    out.push(t);
  }
  return out;
}
const uniq = a => [...new Set(a)];

// spells : [{ champ, key, tip }] ; le composant charge les icônes et recharges
export function laneAnalysis(m) {
  const role = m.role;
  if (role === 'ADC' || role === 'SUPPORT') return botLane(m);
  return duelLane(m);
}

function botLane(m) {
  const isAdc = m.role === 'ADC';
  const sup = isAdc ? m.ally.SUPPORT : m.me, adc = isAdc ? m.me : m.ally.ADC, ea = m.enemy.ADC, es = m.enemy.SUPPORT;
  if (!sup || !ea || !es || !adc) {
    return { missing: [!adc && (isAdc ? 'toi (ADC)' : 'ton ADC'), !sup && (isAdc ? 'ton support' : 'toi (support)'), !ea && 'leur ADC', !es && 'leur support'].filter(Boolean) };
  }
  const M = meta();
  const mine = laneScores(sup, adc), theirs = laneScores(es, ea);
  const cMe = M.counters[sup] || [], cThem = M.counters[es] || [];
  if (cMe.includes(es) || cMe.includes(ea)) { mine.early += 1; mine.allin += 1; }
  if (cThem.includes(sup) || cThem.includes(adc)) { theirs.early += 1; theirs.allin += 1; }
  mine.allin += ((M.pairs[sup] || {})[adc] || 0) / 10; theirs.allin += ((M.pairs[es] || {})[ea] || 0) / 10;
  // Résultat réel des meilleurs joueurs s'il existe (≥ 20 parties) : il recale les phases et le verdict
  const myC = m.me, mb = BUILD(myC, m.role), dOpp = isAdc ? ea : es, oOpp = isAdc ? es : ea;
  const fd = (l, c) => (l || []).find(x => x[0] === c && x[1] >= 20);
  const cd = counterDuel(myC, dOpp, m.role), xd = cd && cd.n >= 20 ? cd : null, xo = mb && fd(mb.vsAll, oOpp);
  let w = null; const src = [];
  if (xd || xo) {
    const base = xd ? xd.avg : mb.wr; w = base;
    if (xd) { w += shrink(xd.wr, xd.n, 200, xd.avg) - xd.avg; src.push(`${Math.round(xd.wr)} % contre ${cname(dOpp)} (${xd.n} parties${DATA.cnt ? ' ' + DATA.cnt.rank : ''})`); }
    if (xo && mb) { w += shrink(xo[2], xo[1], 100, mb.wr) - mb.wr; src.push(`${xo[2]} % contre ${cname(oOpp)} (${xo[1]} parties)`); }
    w = Math.round(w);
  }
  const tone = w == null ? null : w >= 53 ? 'aggro' : w <= 47 ? 'safe' : 'even', shift = w == null ? 0 : (w - 50) / 5;
  const ph = (k, label, sub) => {
    const d = mine[k] - theirs[k] + shift; const c = d > 0.8 ? 'adv' : d < -0.8 ? 'dis' : 'even';
    const note = tone === 'aggro' && c === 'dis' ? 'plus faibles ici malgré une lane favorable' : tone === 'safe' && c === 'adv' ? 'plus forts ici malgré une lane difficile' : sub;
    return { c, d, label, note };
  };
  const P = [ph('early', 'Niv 1-2', 'trades'), ph('allin', 'Niv 3-6', 'all-in'), ph('late', 'Après 6', 'scaling')];
  const total = P.reduce((s, x) => s + x.d, 0);
  let verdict, verdictSrc;
  if (w != null) {
    verdict = w >= 53 ? ['good', `Lane favorable : ${w} % estimés`] : w <= 47 ? ['bad', `Lane difficile : ${w} % estimés, sécurité d'abord`] : ['warn', `Lane équilibrée : ${w} % estimés`];
    verdictSrc = `${cname(myC)} : ${src.join(', ')}. Les phases combinent ces résultats et les profils des champions.`;
  } else {
    verdict = total > 1.5 ? ['good', 'Vous avez l\'avantage'] : total < -1.5 ? ['bad', 'Lane difficile : sécurité d\'abord'] : ['warn', 'Lane équilibrée : tout se joue sur les sorts'];
    verdictSrc = 'Moins de 20 parties chez les meilleurs joueurs sur ce duel : verdict estimé à partir des profils des champions.';
  }
  const sp = supProfile(sup), esp = supProfile(es), eap = adcProfile(ea);
  const L = M.lane || {}, Les = L[es] || {}, Lea = L[ea] || {};
  const genericS = p => p.arch === 'engage' ? [['E', 'Son engage principal : garde la distance quand il est prêt.']] : p.arch === 'mage' ? [['Q', 'Son sort principal : derrière tes sbires, bouge latéralement.']] : [];
  const spells = [...(Les.s || genericS(esp)).map(x => ({ champ: es, key: x[0], tip: x[1] })), ...(Lea.s || []).map(x => ({ champ: ea, key: x[0], tip: x[1] }))];
  const DO = [];
  if (tone === 'aggro') DO.push('Lane favorable chez les meilleurs joueurs : prends l\'initiative dès le niveau 2');
  if (tone === 'safe') DO.push('Lane difficile chez les meilleurs joueurs : sécurité d\'abord, farm et attends ton jungler');
  if (P[0].c === 'adv') DO.push('Course au niveau 2 (1re vague + 3 sbires mêlée) puis engage tout de suite');
  else DO.push('Niveau 2 = 1re vague + 3 sbires mêlée : recule d\'un cran s\'ils l\'ont avant vous');
  (Les.do || []).forEach(x => DO.push(x)); (Lea.do || []).forEach(x => DO.push(x));
  DO.push(isAdc ? ADC_DO[sp.arch](sup) : ARCH_DO[sp.arch](adc));
  if (isAdc) DO.push('Last-hit d\'abord : chaque vague perdue coûte plus qu\'un trade gagné');
  if (P[2].c === 'adv' && P[0].c !== 'adv') DO.push('Jouer safe jusqu\'au 6 et aux premiers objets : vous scalez mieux');
  if (P[2].c === 'dis' && P[0].c !== 'dis') DO.push('Convertir votre avance avant 11:00 (plaques à 120 po, drake) : ils scalent mieux');
  DO.push(total > 1.5 ? 'Pousser et prendre les plaques, roam mid dès le niveau 5' : total < -1.5 ? 'Laisser la vague venir à votre tour, ward le tri-bush, demander un gank niveau 3-4' : 'Slow push avant chaque retour et avant le drake');
  if (cMe.includes(es)) DO.push(`${cname(sup)} contre ${cname(es)} : sois agressif`);
  const DONT = [];
  (Les.dont || []).forEach(x => DONT.push(x)); (Lea.dont || []).forEach(x => DONT.push(x));
  if (!Les.dont) DONT.push(esp.arch === 'engage' ? 'Te coller à ton ADC (double contrôle)' : esp.arch === 'enchanter' ? 'Trade quand son bouclier/soin est prêt' : 'Prendre du poke gratuit en avançant');
  if (!Lea.dont && ({ bully: 1, allin: 1 })[eap.style]) DONT.push(`Les échanges longs contre ${cname(ea)} au niveau 1-3`);
  DONT.push(isAdc ? `Avancer sans ${cname(sup)} ou sans ward dans la rivière` : ARCH_DONT[sp.arch]);
  if (cThem.includes(sup)) DONT.push(`Jouer devant : ${cname(es)} contre ${cname(sup)}`);
  const jg = m.enemy.JUNGLE && M.junglers[m.enemy.JUNGLE];
  if (jg) DONT.push(`Avancer sans ward : ${cname(m.enemy.JUNGLE)} ${jg.note}`);
  return {
    verdict, verdictSrc, phases: P, spells, spellsTitle: 'Sorts à surveiller',
    doTitle: 'Pour gagner la lane',
    do: coherentPlan(uniq(DO), tone || (total > 1.5 ? 'aggro' : total < -1.5 ? 'safe' : null)).slice(0, 6),
    dont: uniq(DONT).slice(0, 5),
  };
}

function duelLane(m) {
  const role = m.role, me = m.me, opp = m.enemy[role], M = meta();
  if (!me || !opp) return { missing: [!me && 'ton champion', !opp && (role === 'JUNGLE' ? 'le jungler adverse' : 'ton adversaire direct')].filter(Boolean) };
  const cd = counterDuel(me, opp, role), wr = cd && cd.n >= 20 ? Math.round(cd.wr) : null, n = cd ? cd.n : 0;
  const tone = wr == null ? null : wr >= 53 ? 'aggro' : wr <= 47 ? 'safe' : 'even';
  const verdict = wr == null ? ['warn', 'Duel absent de la base de counters'] : wr >= 53 ? ['good', `Duel favorable : ${wr} % (${n} parties)`] : wr <= 47 ? ['bad', `Duel difficile : ${wr} % (${n} parties)`] : ['warn', `Duel équilibré : ${wr} % (${n} parties)`];
  const POSK = { TOP: 'TOP', JUNGLE: 'JUNGLE', MID: 'MIDDLE' }[role];
  const L = (M.lane || {})[opp + '|' + POSK] || {};
  const spells = L.s ? L.s.map(x => ({ champ: opp, key: x[0], tip: x[1] })) : ['Q', 'W', 'E', 'R'].map(k => ({ champ: opp, key: k, tip: null, fallback: k === 'R' ? 'Ultime : joue prudemment quand il est disponible.' : 'Punis-le quand ce sort est en recharge.' }));
  const ejg = m.enemy.JUNGLE, jp = ejg && M.junglers[ejg];
  const engAllies = ROLE_ORDER.filter(r => r !== role).map(r => m.ally[r]).filter(Boolean).filter(isEngager);
  const DO = [], DONT = [];
  if (role === 'TOP') {
    DO.push(tone === 'safe' ? 'Laisse la vague venir à ta tour et farm en sécurité jusqu\'à ton premier objet' : tone === 'aggro' ? 'Garde la priorité sur ta vague et pousse pour les plaques avant 11:00' : 'Échange quand ses sorts clés sont en recharge, avance seulement avec de la vision');
    DO.push('Ward la rivière top ou le tri-bush avant 3:00 (premier gank possible)');
    DO.push('Pousse ta vague avant 8:00 pour aider ton jungler sur les larves');
    DONT.push('Pousser sans vision quand le jungler adverse n\'est pas visible');
    const sp = mySpells(me, role);
    if (sp.includes(12)) DONT.push('Utiliser ta Téléportation sans raison : garde-la pour un drake ou un gank');
    else if (sp.includes(6)) DONT.push('Gaspiller ton Fantôme : garde-le pour un all-in ou une poursuite');
    else if (sp.includes(14)) DONT.push('Lancer l\'Embrasement trop tôt : garde-le pour le kill niveaux 2-3 (il réduit aussi ses soins)');
  } else if (role === 'MID') {
    DO.push('Pousse ta vague puis roam (rivière, bot ou top) aux niveaux 3 et 6');
    DO.push(`Ping « disparu » dès que ${cname(opp)} quitte la lane`);
    DO.push('Bouge vers le drake ou les larves avec ton jungler quand ta vague est poussée');
    DONT.push('Roam quand ta vague arrive à ta tour : tu perds trop d\'or');
  } else {
    DO.push(engAllies.length ? `Ganke en priorité les lanes avec du contrôle : ${engAllies.map(cname).join(', ')}` : 'Ganke la lane où l\'adversaire est poussé et sans Flash');
    DO.push('Commence du côté où tes lanes ont la priorité, prends le crabe à 2:55 si ta bot ou ta mid peut suivre');
    DO.push('Drake à 5:00, larves à 8:00 : prépare la vision 1 minute avant');
    DONT.push('Faire un gank sans que ta lane soit prête (vague mal placée, sans sorts)');
    if (jp) DONT.push(`Ignorer ${cname(opp)} : ${jp.note}`);
  }
  if (role !== 'JUNGLE') {
    const rng = c => (((champ(c) || {}).stats || {}).attackrange || 0) >= 300, tm = tags(me), to = tags(opp), on = cname(opp);
    if (rng(me) && !rng(opp)) { DO.unshift(`Tu as la portée : touche ${on} à chaque fois qu'il vient last-hit, recule dès qu'il avance`); DONT.push(`Laisser ${on} te coller sans sort de fuite ou de contrôle prêt`); }
    else if (!rng(me) && rng(opp)) { DO.unshift(`${on} a la portée : farm prudemment et engage seulement quand il a gaspillé un sort`); DONT.push('Échanger à distance : tu perds chaque trade de poke'); }
    else if (!rng(me)) DO.unshift('Duel au corps à corps : trades courts, un combo puis recule avant qu\'il réponde');
    else DO.unshift('Duel à distance : esquive latéralement et garde tes sbires entre vous');
    if (to.includes('Assassin') && (tm.includes('Mage') || tm.includes('Marksman'))) { DO.push(`Garde un sort de contrôle ou ton Flash pour l'engage de ${on}`); DONT.push('Rester seul en vague sans vision après son niveau 6'); }
    if (to[0] === 'Tank') DO.push(`${on} est un tank : prends l'avantage tôt et ses plaques avant 11:00, il devient fort en fin de partie`);
    if (tm[0] === 'Tank' && (to.includes('Fighter') || to.includes('Assassin'))) DO.push('Tu es solide : survis à la lane et sois prêt pour le premier combat d\'équipe');
    if (tone === 'safe') DO.unshift('Duel difficile chez les meilleurs joueurs : farm près de ta tour et appelle ton jungler');
    if (tone === 'aggro') {
      const em = earlyOf(me), eo = earlyOf(opp);
      DO.unshift(em != null && eo != null && eo > em ? 'Duel favorable sur la durée, mais il gagne les premiers niveaux : farm calmement jusqu\'au niveau 3, puis prends la main'
        : em != null && eo != null && em > eo ? 'Duel favorable sur la partie, et tu gagnes aussi les premiers niveaux : mets la pression dès le niveau 1'
          : 'Duel favorable sur la partie : garde la priorité sur ta vague et prends les plaques avant 11:00');
    }
  }
  (L.do || []).forEach(x => DO.push(x)); (L.dont || []).forEach(x => DONT.push(x));
  if (role !== 'JUNGLE' && jp) DONT.push(`Avancer sans ward : ${cname(ejg)} ${jp.note}`);
  return {
    verdict,
    verdictSrc: wr == null ? `Pas de données sur ${cname(me)} contre ${cname(opp)} : conseils tirés des profils des champions.` : `Taux de victoire de ${cname(me)} contre ${cname(opp)}${DATA.cnt ? ` : ${DATA.cnt.source}, ${DATA.cnt.rank}` : ''}.`,
    phases: null, spells, spellsTitle: `Sorts de ${cname(opp)}`, doTitle: 'Pour gagner',
    do: coherentPlan(uniq(DO), tone).slice(0, 6), dont: uniq(DONT).slice(0, 5),
  };
}

// ------------------------------------------------------------
// Chronologie de la partie (wards, objectifs, dangers, lane)
// ------------------------------------------------------------
// Positions en % de la minimap (0,0 = haut gauche)
export const SPOTS = {
  riverBot: [77.8, 73.8, 'Buisson de rivière bot'], pit: [68.6, 66.2, 'Entrée du pit drake'],
  triBlue: [69.9, 79.5, 'Tri-bush bleu (bot)'], triRed: [81.4, 68.2, 'Tri-bush rouge (bot)'],
  deepRed: [68.6, 59.4, 'Buisson d\'entrée jungle rouge (côté bot)'], deepBlue: [57.7, 68.3, 'Buisson d\'entrée jungle bleue (côté bot)'],
  pitTop: [31.4, 33.2, 'Entrée du pit Baron / larves'], riverTop: [22.6, 23.6, 'Buisson de rivière top'],
  midBlue: [58.4, 56.9, 'Buisson rivière mid (sud)'], midRed: [42.2, 43.8, 'Buisson rivière mid (nord)'],
};
// Tours (t) et inhibiteurs (i) : [équipe, type, x %, y %]
export const STRUCTS = [['b', 't', 11.8, 84.7], ['b', 't', 14.7, 87.8], ['r', 't', 87.9, 15.1], ['r', 't', 84.9, 11.9], ['b', 't', 28.8, 91.6], ['b', 't', 24.6, 75.1], ['b', 't', 7.9, 71.1], ['b', 'i', 21.6, 78.3], ['b', 'i', 23.4, 91.7], ['b', 'i', 7.9, 75.9], ['r', 'i', 75.9, 8.0], ['b', 't', 46.6, 90.0], ['r', 't', 53.5, 9.7], ['b', 't', 70.7, 93.1], ['b', 't', 34.0, 67.6], ['r', 't', 70.6, 8.1], ['r', 't', 29.1, 6.6], ['b', 't', 39.4, 56.9], ['b', 't', 6.6, 29.7], ['b', 't', 10.2, 54.9], ['r', 't', 65.8, 31.9], ['r', 't', 75.0, 24.5], ['r', 'i', 78.1, 21.4], ['r', 't', 60.3, 42.7], ['r', 't', 93.4, 69.7], ['r', 'i', 91.6, 23.8], ['r', 't', 91.7, 28.8], ['r', 't', 89.7, 44.6]];
function wardSpots(key, side) {
  const enemyTri = side === 'blue' ? 'triRed' : 'triBlue', enemyDeep = side === 'blue' ? 'deepRed' : 'deepBlue';
  return ({ lvl1: ['riverBot'], gank: [enemyTri, 'riverBot'], drake: ['pit', 'riverBot'], grubs: ['riverTop', 'pitTop'], mid: ['midBlue', 'midRed'], deep: [enemyDeep, enemyTri], baron: ['pitTop', 'riverTop', 'midRed'] })[key] || [];
}
const DEF_TIMERS = { dragon: 300, dragonRespawn: 300, grubs: 480, grubsDespawn: 885, herald: 900, baron: 1200, elderAfterSoul: 360, scuttle: 175, platesDecay: 660, laneEnd: 840 };
const gankAt = jp => jp ? (jp.type === 'early' ? 165 : jp.type === 'mid' ? 200 : jp.type === 'farm' ? 285 : 390) : 195;

export function buildEvents(m, lead = 15) {
  const M = meta(), T = { ...DEF_TIMERS, ...(M.timers || {}) }, side = m.side || 'blue', ev = [];
  const E = (t, kind, title, text, spots, id) => ev.push({ t, kind, title, text, spots, id: id || kind + t });
  const jg = m.enemy.JUNGLE, jp = jg ? ((M.junglers || {})[jg] || { type: 'mid', note: 'profil inconnu' }) : null;
  const myJg = m.ally.JUNGLE, role = m.role;
  if (role !== 'SUPPORT') { eventsRole(m, E, T, side, jg, jp, myJg); laterDrakes(m, E, T, side); return ev.sort((a, b) => a.t - b.t); }
  E(0, 'lane', 'Début de partie', 'Atlas + 2 potions. Aide ton jungler au leash seulement s\'il le demande.');
  E(65, 'lane', 'Première vague', 'Course au niveau 2 : 1re vague + 3 sbires mêlée de la 2e (~1:50). Prends les buissons de lane.');
  E(75, 'ward', 'Ward niveau 1', 'Ward le buisson de rivière bot pour voir le jungler adverse arriver (et un éventuel crabe).', wardSpots('lvl1', side));
  E(108, 'lane', 'Niveau 2 imminent', 'Le 3e sbire mêlée de la 2e vague va tomber : prêt à engager / à reculer.');
  if (jp) {
    const g = gankAt(jp);
    const lvl = jp.type === 'early' ? 'niveau 3' : jp.type === 'mid' ? 'niveau 3-4' : jp.type === 'farm' ? 'après son full clear' : 'niveau 6';
    E(g - lead, 'ward', `Ward anti-gank (${cname(jg)})`, `Ward le tri-bush adverse ou la rivière maintenant : ${cname(jg)} peut arriver ${lvl}.`, wardSpots('gank', side), 'wardgank');
    E(g, 'danger', `Gank possible : ${cname(jg)}`, `${jp.note}. Pas d'avance sans vision, surveille ta minimap.`, null, 'gank');
    if (jp.type === 'early') E(220, 'danger', 'Deuxième fenêtre de gank', `Si ${cname(jg)} n'est pas venu, il peut arriver après son full clear (~3:30-3:45).`, null, 'gank2');
    if (jp.type !== 'six') E(390, 'danger', 'Niveau 6 du jungler', `Vers 6:00-7:00, ${cname(jg)} et les laners adverses ont leur ultime : ward plus profond.`, null, 'six');
  } else {
    E(180 - lead, 'ward', 'Ward anti-gank', 'Ward le tri-bush adverse ou la rivière : premier gank possible entre 2:45 et 3:30.', wardSpots('gank', side), 'wardgank');
    E(195, 'danger', 'Premier gank possible', 'Ajoute le jungler adverse pour un timing précis.', null, 'gank');
  }
  E(T.scuttle, 'obj', 'Crabe de rivière', `Si vous avez la priorité, bouge vers le crabe côté bot avec ${myJg ? cname(myJg) : 'ton jungler'}.`);
  E(T.dragon - 30, 'ward', 'Prépare le drake', 'Pink dans le buisson de rivière bot, ward l\'entrée du pit. Poussez la vague avant.', wardSpots('drake', side), 'wdrake1');
  E(T.dragon, 'obj', 'Drake (5:00)', 'Premier drake. Joue-le seulement si vous avez la priorité bot.', null, 'drake1');
  E(390, 'lane', '≈ Niveau 5 : roams débloqués', 'Fin de la pénalité de roam (−33 % or/XP hors bot). Roam mid si ta vague est poussée.', null, 'lane390');
  E(T.grubs - 45, 'ward', 'Prépare les larves', 'Vague poussée → monte avec ton jungler. Ward la rivière top et le pit.', wardSpots('grubs', side), 'wgrubs');
  E(T.grubs, 'obj', 'Larves du Néant (8:00)', 'Un seul groupe, pas de réapparition.', null, 'grubs');
  E(600, 'ward', 'Renouvelle ta vision', 'Pink rivière bot, ward la rivière mid si tu roam. Utilise tes charges de trinket.', wardSpots('mid', side), 'w10');
  E(720, 'lane', 'Reset et pinks', 'Pousse, rentre, achète 2 pinks (40 po avec la quête finie).');
  E(T.platesDecay - 60, 'ward', 'Plaques à prendre avant 11:00', 'Ward profond la jungle adverse côté bot et pousse : les plaques valent 120 po jusqu\'à 11:00.', wardSpots('deep', side), 'wplates');
  E(T.platesDecay, 'obj', 'Plaques : valeur en baisse (11:00)', 'Chaque plaque vaut 10 po de moins par minute jusqu\'à 15:00 et la tour externe s\'affaiblit : bonne fenêtre pour la tour elle-même.', null, 'plates');
  E(T.laneEnd, 'lane', 'Fin de la phase de lane (14:00)', 'Vagues toutes les 25 s, retour en base plus rapide. Passe à l\'Oracle si ta quête est finie et regroupe mid.', null, 'laneend');
  E(T.herald - 30, 'ward', 'Prépare le Héraut', 'Balaye et ward autour du pit top.', wardSpots('grubs', side), 'wherald');
  E(T.grubsDespawn, 'obj', 'Les larves disparaissent', 'Si elles sont encore là, c\'est la dernière chance.', null, 'grubsend');
  E(T.herald, 'obj', 'Héraut (15:00)', 'Une seule apparition dans le pit top.', null, 'herald');
  E(T.baron - 30, 'ward', 'Prépare le Baron', 'Oracle + pink : nettoie les entrées du Baron, ward la rivière mid.', wardSpots('baron', side), 'wbaron');
  E(T.baron, 'obj', 'Baron (20:00)', 'Ne le commence jamais sans vision de leur jungler.', null, 'baron');
  laterDrakes(m, E, T, side);
  return ev.sort((a, b) => a.t - b.t);
}
function laterDrakes(m, E, T, side) {
  const k = m.kills || {};
  (k.drakes || []).forEach((t0, i) => {
    const t = t0 + T.dragonRespawn;
    E(t - 30, 'ward', `Prépare le drake n°${i + 2}`, 'Vision dans la rivière bot, poussez bot et mid avant.', wardSpots('drake', side), 'wdrake' + (i + 2));
    E(t, 'obj', `Drake n°${i + 2}`, '5:00 après le précédent.', null, 'drake' + (i + 2));
  });
  if (k.soul != null) { const t = k.soul + T.elderAfterSoul; E(t - 45, 'ward', 'Prépare l\'Ancien', 'Vision complète autour du pit.', wardSpots('drake', side), 'welder'); E(t, 'obj', 'Dragon Ancien', '6:00 après l\'âme.', null, 'elder'); }
}
function eventsRole(m, E, T, side, jg, jp, myJg) {
  const role = m.role, g = gankAt(jp);
  let jgStart = '';
  if (role === 'JUNGLE') {
    // Lane à ganker en premier (allié avec le plus de contrôle) et chemin de départ du côté opposé
    const L3 = [['top', [m.ally.TOP]], ['mid', [m.ally.MID]], ['bot', [m.ally.ADC, m.ally.SUPPORT]]];
    const cc = l => l[1].filter(Boolean).filter(isEngager).length * 2 + l[1].filter(Boolean).filter(isFront).length;
    let tgt = L3.slice().sort((a, b) => cc(b) - cc(a))[0], why = cc(tgt) ? `${tgt[1].filter(Boolean).map(cname).join(' + ')}, le plus de contrôle` : '';
    const known = L3.filter(l => l[1].some(Boolean));
    if (!why && known.length) {
      const foes = { top: [m.enemy.TOP], mid: [m.enemy.MID], bot: [m.enemy.ADC, m.enemy.SUPPORT] }, lr = { top: 'TOP', mid: 'MID', bot: 'ADC' };
      const stuck = e => !tags(e).includes('Assassin') && !tags(e).includes('Fighter') && (tags(e).includes('Marksman') || tags(e).includes('Mage'));
      const pun = l => { const es = foes[l[0]].filter(Boolean), d = l[1][0] && es[0] && counterDuel(l[1][0], es[0], lr[l[0]]); return es.filter(stuck).length * 2 + (d && d.wr < 48 ? 1 : 0) + (l[0] === 'bot' ? 0.5 : 0); };
      tgt = known.slice().sort((a, b) => pun(b) - pun(a))[0];
      const es = foes[tgt[0]].filter(Boolean);
      why = es.filter(stuck).length ? `${es.filter(stuck).map(cname).join(' + ')} sans fuite, facile à punir` : `aucun allié avec du contrôle : aide ${tgt[1].filter(Boolean).map(cname).join(' + ')}`;
    }
    const tgtName = tgt[0], topside = tgtName === 'bot';
    const buff = (side === 'blue') === topside ? 'buff bleu' : 'buff rouge';
    jgStart = why ? `Lane à ganker en premier : ${tgtName} (${why}). Commence côté ${topside ? 'top' : 'bot'} (${buff}) pour finir ton tour près de la ${tgtName} vers 3:00-3:15.` : 'Ajoute tes alliés pour savoir quelle lane ganker en premier. Commence du côté opposé à cette lane pour finir ton tour à côté d\'elle.';
    if (jp && (jp.type === 'early' || /invad/i.test(jp.note || ''))) E(45, 'danger', `Invasion possible : ${cname(jg)}`, `${cname(jg)} aime envahir tôt : ward l'entrée de ton premier buff et reste près de tes laners avant l'apparition des camps.`, null, 'invade');
  }
  E(0, 'lane', 'Début de partie', role === 'JUNGLE' ? jgStart : role === 'ADC' ? 'Objet de départ + potion. Laisse ton support prendre les buissons, toi la vague.' : 'Objet de départ + potion. Les 3 premiers niveaux décident souvent du duel.');
  if (role === 'ADC') {
    E(65, 'lane', 'Course au niveau 2', '1re vague + 3 sbires mêlée de la 2e (~1:50). Last-hit en priorité.');
    E(108, 'lane', 'Niveau 2 imminent', 'Prêt à suivre l\'engage de ton support, ou à reculer s\'ils l\'ont avant vous.');
  }
  if (role === 'TOP') E(150, 'ward', 'Ward avant le 1er gank', 'Trinket dans la rivière top ou le tri-bush : premier gank possible vers 3:00.', ['riverTop'], 'wgank');
  if (role === 'MID') E(150, 'ward', 'Ward avant le 1er gank', 'Trinket dans un buisson de rivière mid, du côté de leur jungler.', side === 'blue' ? ['midRed'] : ['midBlue'], 'wgank');
  if (role !== 'JUNGLE') {
    E(g, 'danger', jg ? `Gank possible : ${cname(jg)}` : 'Premier gank possible', jp ? `${jp.note}. Ne pousse pas sans vision.` : 'Ajoute le jungler adverse pour un timing précis.', null, 'gank');
  } else {
    E(190, 'lane', 'Fin du premier tour de jungle (3:00-3:20)', 'Gank si une lane est prête (adversaire poussé, sans Flash), sinon enchaîne sur le crabe.');
    if (jg) E(g, 'danger', `${cname(jg)} peut ganker`, `${jp ? jp.note + '. ' : ''}S'il a été vu d'un côté au début, son 1er gank viendra souvent de l'autre côté : sois proche de cette lane pour contre-ganker.`, null, 'gank');
    E(400, 'obj', 'Tes buffs réapparaissent', 'Les buffs reviennent 5:00 après avoir été tués : prends-les vers 6:30-7:00 avant le prochain objectif.', null, 'buffs');
  }
  E(T.scuttle, 'obj', 'Crabes (2:55)', role === 'JUNGLE' ? 'Prends le crabe du côté où tes lanes peuvent bouger.' : `Si ta lane a la priorité, aide ${myJg ? cname(myJg) : 'ton jungler'} sur le crabe.`);
  if (role === 'MID') E(200, 'lane', 'Niveau 3 : fenêtre de roam', 'Si ta vague est poussée, va vers la rivière ou une lane adjacente.');
  E(T.dragon - 45, role === 'JUNGLE' ? 'ward' : 'lane', 'Prépare le drake', role === 'ADC' ? 'Pousse ta vague avant le drake avec ton support.' : role === 'JUNGLE' ? 'Vision dans la rivière bot, demande la priorité bot et mid.' : role === 'MID' ? 'Pousse ta vague pour pouvoir bouger au drake.' : (mySpells(m.me, role).includes(12) ? 'Pousse ta vague ou garde ta Téléportation pour le drake.' : 'Pousse ta vague pour ne pas perdre d\'or pendant le drake.'), role === 'JUNGLE' ? wardSpots('drake', side) : null, 'wdrake1');
  E(T.dragon, 'obj', 'Drake (5:00)', 'Premier drake : seulement avec la priorité bot et mid.', null, 'drake1');
  if (role === 'MID') E(390, 'lane', 'Niveau 6', 'Ultime disponible : roam vers une lane poussée ou un objectif.', null, 'lane390');
  if (role === 'ADC') E(390, 'lane', 'Niveau 6', 'Le support et le jungler adverses ont leur ultime : attention aux all-ins.', null, 'lane390');
  E(T.grubs - 45, role === 'JUNGLE' || role === 'TOP' ? 'ward' : 'lane', 'Prépare les larves', role === 'TOP' ? 'Pousse ta vague et aide ton jungler sur les larves.' : role === 'JUNGLE' ? 'Vision autour du pit top, demande la priorité top et mid.' : 'Pousse ta vague si tu peux aider sur les larves.', role === 'JUNGLE' || role === 'TOP' ? wardSpots('grubs', side) : null, 'wgrubs');
  E(T.grubs, 'obj', 'Larves du Néant (8:00)', 'Un seul groupe, pas de réapparition.', null, 'grubs');
  E(600, 'lane', 'Reset', role === 'JUNGLE' ? 'Retour en base avec assez d\'or pour un composant, puis prépare le drake suivant.' : 'Pousse et rentre avec assez d\'or pour avancer ton 1er objet.');
  E(T.platesDecay - 60, 'lane', 'Plaques à prendre avant 11:00', 'Les plaques valent 120 po jusqu\'à 11:00 : pousse si tu as l\'avantage.', null, 'wplates');
  E(T.platesDecay, 'obj', 'Plaques : valeur en baisse (11:00)', 'Les plaques perdent 10 po par minute jusqu\'à 15:00 et la tour externe s\'affaiblit.', null, 'plates');
  E(T.laneEnd, 'lane', 'Fin de la phase de lane (14:00)', role === 'ADC' ? 'Vagues toutes les 25 s : rejoins mid avec ton support, reste avec le groupe.' : 'Vagues toutes les 25 s, retour en base plus rapide. Regroupe-toi pour les objectifs.', null, 'laneend');
  E(T.grubsDespawn, 'obj', 'Les larves disparaissent', 'Dernière chance si elles sont encore là.', null, 'grubsend');
  if (role === 'ADC') E(T.herald - 30, 'lane', 'Avant le Héraut', 'Pousse ta vague bot puis reste avec ton groupe : ne farm pas seul sur le côté pendant que ton équipe joue le pit top.', null, 'wherald');
  else E(T.herald - 30, role === 'JUNGLE' ? 'ward' : 'lane', 'Prépare le Héraut', 'Vision autour du pit top, priorité top et mid.', role === 'JUNGLE' ? wardSpots('grubs', side) : null, 'wherald');
  E(T.herald, 'obj', 'Héraut (15:00)', 'Une seule apparition dans le pit top.', null, 'herald');
  E(T.baron - 30, 'ward', 'Prépare le Baron', 'Vision et balayage autour du Baron avant de le commencer.', wardSpots('baron', side), 'wbaron');
  E(T.baron, 'obj', 'Baron (20:00)', 'Jamais sans savoir où est leur jungler.', null, 'baron');
}

// Règles du patch (data/meta.json) ; celles propres au support seulement en support
export function patchRules(role) {
  const fix = t => role === 'SUPPORT' ? t : t.replace(/ Passe à l'Oracle et regroupe-toi avec ton jungler et ton mid\./, ' Regroupe-toi avec ton équipe pour les objectifs.');
  return (meta().supportRules || []).filter(r => role === 'SUPPORT' || !/quête|roam/i.test(r.title)).map(r => ({ title: r.title, text: fix(r.text) }));
}
