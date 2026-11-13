// ============================================================
// DRAFT D'ÉQUIPE EN DIRECT (onglet Équipe) puis PLAN DE JEU D'ÉQUIPE
// On part d'une compo calculée avec les pools des joueurs (bestDraftsEngine.computeCustomDrafts),
// on la suit pendant la sélection (bans, picks verrouillés des deux côtés) et on la corrige :
// alertes counter et meilleur remplaçant pris dans le pool du joueur concerné.
// Aucun calcul parallèle : classement d'un champion (scoreChampion), duels (duelResult / analyzeLaneMatchup),
// score de draft (calculateDraftScore), victoire estimée (calculateWinProbability), lane bot (laneAnalysis).
// Imports relatifs : utilisable dans le navigateur et sous Node (tests).
// ============================================================
import { ROLES, meta, cname, tags, isAP, isEngager, isZoneControl, isFront, isAssassin, scoreChampion, duelResult, dataRoles, teamEstimate } from './gameData.js';
import { calculateDraftScore, calculateWinProbability, getDraftScoreLabel, detectSynergies, getWinCondition, analyzeLaneMatchup, shortReason } from './championEngine.js';
import { laneAnalysis } from './inGame.js';

export const ROLE_FR = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };
export const EMPTY = () => ({ TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null });

// Seuils d'alerte (points de classement de scoreChampion, ≈ points de % de victoire)
export const TEAM_DRAFT = { duelBad: 47, swapGain: 1.0, hitMin: 1.5 };

// Pool d'un joueur à un poste : noms (format de l'optimisation d'équipe) → ids
export function poolIds(names, championsById) {
  const byName = {};
  Object.values(championsById || {}).forEach(c => { byName[String(c.name).toLowerCase()] = c.id; byName[String(c.id).toLowerCase()] = c.id; });
  return [...new Set((names || []).map(n => byName[String(n).toLowerCase()]).filter(Boolean))];
}

// Nouvelle draft suivie à partir d'une compo proposée et des joueurs assignés
export function newLiveDraft(draft, teamAssignment, championsById) {
  const plan = EMPTY(), players = EMPTY(), pools = EMPTY();
  (draft.champions || []).forEach((c, i) => { if (ROLES[i]) plan[ROLES[i]] = c.id; });
  ROLES.forEach(r => {
    const p = teamAssignment[r];
    players[r] = p ? String(p.name || '').replace(/ \(Toi\)$/, '') : ROLE_FR[r];
    pools[r] = poolIds(p && p.pools && p.pools[r], championsById);
    if (plan[r] && !pools[r].includes(plan[r])) pools[r].unshift(plan[r]);
  });
  return { v: 1, name: draft.name || draft.playstyle || 'Draft', plan, players, pools, locked: EMPTY(), enemy: EMPTY(), bans: [], startedAt: Date.now() };
}

// Poste le plus probable d'un pick adverse (parties des meilleurs joueurs, puis tags), sinon le premier libre
export function guessEnemyRole(champion, enemy) {
  const likely = [...dataRoles(champion.id), ...(champion.dataRoles || []), ...(champion.roles || [])];
  return likely.find(r => ROLES.includes(r) && !enemy[r]) || ROLES.find(r => !enemy[r]) || null;
}

// PC relié : complète la draft d'équipe en direct avec la sélection lue dans le client League (pcLink.readSelection).
// Ajoute les bans, les picks adverses et nos champions verrouillés ; ne retire rien de ce qui a été saisi à la main
// (sauf à une nouvelle sélection : pcN = numéro de la sélection déjà suivie).
// Renvoie le nouvel état, ou le même objet si rien ne change.
export function applyPcSelection(st, sel, championsById) {
  if (!sel) return st;
  const next = { ...st, plan: { ...st.plan }, locked: { ...st.locked }, enemy: { ...st.enemy }, bans: [...st.bans], pcN: sel.n };
  let changed = st.pcN !== sel.n;
  // Nouvelle sélection sur le PC alors que cette draft en avait déjà suivi une : on repart d'une sélection vide (la compo prévue reste)
  if (st.pcN != null && st.pcN !== sel.n) { next.locked = EMPTY(); next.enemy = EMPTY(); next.bans = []; }
  sel.bans.forEach(id => { if (championsById[id] && !next.bans.includes(id)) { next.bans.push(id); changed = true; } });
  sel.enemy.forEach(m => {
    const c = championsById[m.id];
    if (!c || ROLES.some(r => next.enemy[r] === m.id)) return;
    const r = m.pos && !next.enemy[m.pos] ? m.pos : guessEnemyRole(c, next.enemy);
    if (r) { next.enemy[r] = m.id; changed = true; }
  });
  // Nos verrouillages : poste donné par le client, sinon le poste où ce champion était prévu, sinon un poste libre plausible
  [...sel.mine].sort((a, b) => (b.pos ? 1 : 0) - (a.pos ? 1 : 0)).forEach(m => {
    const c = m.lock && championsById[m.id];
    if (!c || ROLES.some(r => next.locked[r] === m.id)) return;
    const free = r => !next.locked[r];
    const r = (m.pos && free(m.pos) && m.pos) || ROLES.find(x => free(x) && next.plan[x] === m.id)
      || [...dataRoles(m.id), ...(c.dataRoles || []), ...(c.roles || [])].find(x => ROLES.includes(x) && free(x)) || ROLES.find(free);
    if (!r) return;
    next.locked[r] = m.id; next.plan[r] = m.id; changed = true;
  });
  return changed ? next : st;
}

const took = (ids, id) => ids.filter(Boolean).includes(id);

// ------------------------------------------------------------
// Analyse de la draft à l'instant t
// ------------------------------------------------------------
// st = { plan, pools, players, locked, enemy, bans } ; renvoie l'état de chaque poste, les alertes et la barre du bas
export function analyzeLiveDraft(st, championsById) {
  const enemyIds = ROLES.map(r => st.enemy[r]).filter(Boolean);
  const bans = st.bans || [];
  const unusable = id => bans.includes(id) || enemyIds.includes(id);
  // 1er passage : champion retenu par poste (verrouillé, sinon prévu s'il est encore disponible)
  const pick = EMPTY();
  ROLES.forEach(r => { pick[r] = st.locked[r] || (st.plan[r] && !unusable(st.plan[r]) ? st.plan[r] : null); });
  // Un champion ne peut être pris qu'une fois chez nous : le verrouillé gagne
  ROLES.forEach(r => { if (!st.locked[r] && pick[r] && ROLES.some(o => o !== r && st.locked[o] === pick[r])) pick[r] = null; });

  const rows = {};
  ROLES.forEach(r => {
    const planned = st.plan[r];
    const status = st.locked[r] ? 'locked' : !planned ? 'empty' : bans.includes(planned) ? 'banned' : enemyIds.includes(planned) ? 'taken' : pick[r] ? 'planned' : 'taken';
    const ally = {}; ROLES.forEach(o => { if (o !== r) ally[o] = pick[o]; });
    const others = ROLES.filter(o => o !== r).map(o => pick[o]);
    const cands = (st.pools[r] || []).filter(id => !unusable(id) && !took(others, id) && championsById[id]);
    const scored = cands.map(id => ({ id, ...scoreChampion(id, r, ally, st.enemy) })).sort((a, b) => b.raw - a.raw);
    const cur = pick[r] ? (scored.find(x => x.id === pick[r]) || { id: pick[r], ...scoreChampion(pick[r], r, ally, st.enemy) }) : null;
    const best = scored[0] || null;
    const alerts = [];
    let suggestion = null;
    const enemyOpp = r === 'ADC' || r === 'SUPPORT' ? [st.enemy.ADC, st.enemy.SUPPORT].filter(Boolean) : st.enemy[r] ? [st.enemy[r]] : [];
    if (status === 'banned') alerts.push({ tone: 'bad', text: `${cname(planned)} est banni` });
    if (status === 'taken') alerts.push({ tone: 'bad', text: `${cname(planned)} n'est plus disponible` });
    if (cur && enemyIds.length) {
      // Duel direct mesuré (counters.json / builds.json, ≥ 20 parties)
      const dr = st.enemy[r] ? duelResult(cur.id, st.enemy[r], r) : null;
      if (dr && dr.wr != null && dr.raw <= TEAM_DRAFT.duelBad) alerts.push({ tone: 'bad', text: `${cname(cur.id)} est contré par ${cname(st.enemy[r])} : ${String(Math.round(dr.raw * 10) / 10).replace('.', ',')} % en duel (${dr.n} parties)` });
      else if (dr && dr.wr != null && dr.avg != null && dr.raw - dr.avg <= -3) alerts.push({ tone: 'warn', text: `${cname(st.enemy[r])} gêne ${cname(cur.id)} : ${String(Math.round(dr.raw * 10) / 10).replace('.', ',')} % en duel au lieu de ${String(Math.round(dr.avg * 10) / 10).replace('.', ',')} % d'habitude` });
      // Autres adversaires qui font baisser nettement le champion (duo bot, jungler, compo)
      (cur.parts || []).filter(p => p[0] <= -TEAM_DRAFT.hitMin && !/\(duel\)/.test(p[1]) && enemyIds.some(e => p[1].includes(cname(e))))
        .slice(0, 1).forEach(p => alerts.push({ tone: 'warn', text: shortReason(p[1], p[0]).replace(/^⚠️ /, '') }));
      if (cur.blind && !st.locked[r]) alerts.push({ tone: 'warn', text: 'Facile à contrer : à verrouiller le plus tard possible' });
    }
    if (status !== 'locked' && best) {
      const need = status === 'banned' || status === 'taken' || status === 'empty';
      const gain = cur ? best.raw - cur.raw : null;
      // Sans pick adverse, la compo choisie reste telle quelle : on ne propose un changement que si elle est touchée
      if (need || (enemyIds.length && best.id !== cur.id && gain >= TEAM_DRAFT.swapGain)) {
        const why = (best.parts || []).filter(p => p[0] > 0.5).slice(0, 2).map(p => shortReason(p[1], p[0]));
        suggestion = { id: best.id, gain: gain == null ? null : Math.round(gain * 10) / 10, score: best.score, why };
      }
    }
    if (status !== 'locked' && !suggestion && alerts.some(a => a.tone === 'bad') && cur) alerts.push({ tone: 'info', text: `Rien de mieux dans le pool de ${st.players[r]} : garde ${cname(cur.id)} et joue la lane prudemment` });
    if (status !== 'locked' && !best && (status === 'banned' || status === 'taken')) alerts.push({ tone: 'info', text: `Plus aucun champion disponible dans le pool de ${st.players[r]} à ce poste` });
    rows[r] = { role: r, planned, current: pick[r], status, alerts, suggestion, score: cur ? cur.score : null, opponents: enemyOpp, options: scored.slice(0, 6).map(x => ({ id: x.id, score: x.score, raw: x.raw })) };
  });

  // Compo retenue pour les totaux : verrouillé > prévu > remplaçant proposé
  const ours = EMPTY();
  ROLES.forEach(r => { ours[r] = pick[r] || (rows[r].suggestion && rows[r].suggestion.id) || null; });
  // Barre du bas : seulement les champions réellement sélectionnés (verrouillés chez nous, picks adverses),
  // mise à jour à chaque pick ; la projection montre ce que donnerait la compo prévue complète
  const selected = EMPTY(); ROLES.forEach(r => { selected[r] = st.locked[r] || null; });
  return {
    rows, ours, selected,
    totals: draftTotals(selected, st.enemy, championsById),
    projected: draftTotals(ours, st.enemy, championsById),
    breakdown: draftBreakdown(selected, st.enemy, championsById),
  };
}

// Barre du bas : score de draft et victoire estimée des deux côtés
export function draftTotals(ours, enemy, championsById) {
  const obj = by => Object.fromEntries(ROLES.map(r => [r, by[r] ? (championsById[by[r]] || { id: by[r] }) : null]));
  const A = obj(ours), E = obj(enemy);
  const aList = ROLES.map(r => A[r]).filter(Boolean), eList = ROLES.map(r => E[r]).filter(Boolean);
  const usScore = aList.length ? calculateDraftScore(aList, eList, A, E) : null;
  const themScore = eList.length ? calculateDraftScore(eList, aList, E, A) : null;
  // Victoire estimée dès le premier pick, d'un côté comme de l'autre (calculateWinProbability renvoie 50 sans allié)
  const win = aList.length ? calculateWinProbability(A, E) : eList.length ? teamEstimate(ours, enemy).win : 50;
  return {
    us: { score: usScore, win, label: usScore != null ? getDraftScoreLabel(usScore).label : null, n: aList.length },
    them: { score: themScore, win: 100 - win, label: themScore != null ? getDraftScoreLabel(themScore).label : null, n: eList.length },
    bestDraft: usScore == null || themScore == null ? null : usScore > themScore ? 'us' : themScore > usScore ? 'them' : 'even',
    bestWin: win > 50 ? 'us' : win < 50 ? 'them' : 'even',
  };
}

// Détail du score et de la victoire estimée : ce qui pèse pour chaque équipe
// (mêmes éléments que calculateDraftScore et teamEstimate, écrits en français)
const STYLE_FR = { 'Protect the Carry': 'protéger le carry', 'Full Engage': 'engage à 5', Poke: 'poke', 'Pick / Catch': 'pick', Scaling: 'fin de partie', Dive: 'plongée' };
const pc = x => String(Math.round(x * 10) / 10).replace('.', ',');
export function draftBreakdown(ours, enemy, championsById) {
  const by = championsById || {};
  const side = (team) => {
    const ids = ROLES.map(r => team[r]).filter(Boolean);
    if (!ids.length) return [];
    const out = [];
    const ap = ids.filter(id => isAP(id)).length, ad = ids.length - ap;
    if (ap && ad) out.push({ tone: 'good', text: `Dégâts mixtes : ${ap} AP, ${ad} AD` });
    else if (ids.length >= 3) out.push({ tone: 'bad', text: ap ? `Full AP (${ap}) : facile à contrer en résistance magique` : `Full AD (${ad}) : facile à contrer en armure` });
    const eng = ids.filter(isEngager), fr = ids.filter(isFront);
    if (eng.length) out.push({ tone: 'good', text: `Engage : ${list(eng)}` }); else if (ids.length >= 4) out.push({ tone: 'bad', text: 'Pas d\'engage' });
    if (fr.length) out.push({ tone: 'good', text: `Frontline : ${list(fr)}` }); else if (ids.length >= 4) out.push({ tone: 'bad', text: 'Pas de frontline' });
    const peel = ids.filter(id => (meta().supports[id] || {}).peel >= 3 || (by[id] && by[id].class === 'Enchanter'));
    if (peel.length) out.push({ tone: 'good', text: `Protection du carry : ${list(peel)}` });
    const syn = detectSynergies(ids.map(id => by[id]).filter(Boolean));
    if (syn.length) out.push({ tone: 'info', text: `Style : ${syn.map(x => STYLE_FR[x.type] || x.type).join(', ')}` });
    return out;
  };
  // Duels de lane et duo bot mesurés (teamEstimate), du point de vue de notre équipe
  const est = teamEstimate(ours, enemy);
  const duels = est.detail.map(([r, v, cd]) => ({ role: r, tone: v > 0.5 ? 'good' : v < -0.5 ? 'bad' : 'info',
    text: `${ROLE_FR[r]} : ${cname(ours[r])} contre ${cname(enemy[r])}, ${pc(cd.wr)} % de victoires, ${v > 0.5 ? 'mieux que' : v < -0.5 ? 'moins bien que' : 'proche de'} sa moyenne (${pc(cd.avg)} %, ${cd.n} parties)` }));
  // Force individuelle de chaque champion à son poste (parties des meilleurs joueurs)
  const solo = (team) => ROLES.filter(r => team[r]).map(r => { const x = scoreChampion(team[r], r, {}, {}); return { role: r, id: team[r], score: x.score, est: x.est }; });
  return { us: side(ours), them: side(enemy), duels, soloUs: solo(ours), soloThem: solo(enemy) };
}

// ------------------------------------------------------------
// PLAN DE JEU D'ÉQUIPE (après la draft)
// ally / enemy : { TOP: id, … } ; players : { TOP: 'Paul', … }
// ------------------------------------------------------------
const SPLIT_PUSHERS = ['Fiora', 'Jax', 'Camille', 'Tryndamere', 'Yorick', 'Nasus', 'Trundle', 'Gwen', 'Shen', 'Udyr', 'Irelia', 'Riven', 'Yone', 'Aatrox', 'Darius', 'Garen', 'Olaf', 'Kayle', 'Quinn', 'Sion', 'Mordekaiser', 'Urgot', 'Illaoi', 'Teemo', 'Tristana', 'Zed', 'Akali', 'Briar', 'Ambessa', 'Naafiri', 'Volibear', 'Warwick', 'Sett', 'Renekton', 'KSante'];
const HYPER = id => (meta().adcs[id] || {}).style === 'hyper' || (meta().adcs[id] || {}).scale >= 3;
const spikeOf = (id, by) => (by[id] && by[id].powerSpike) || 'mid';
const list = ids => ids.map(cname).join(', ');

// Force d'une équipe à chaque moment : profils écrits (ADC, supports, junglers) puis pic de puissance de la classe
function curve(team, by) {
  let early = 0, late = 0;
  ROLES.forEach(r => {
    const id = team[r]; if (!id) return;
    const jp = r === 'JUNGLE' && meta().junglers[id];
    if (jp) { if (jp.type === 'early') early += 1; if (jp.type === 'farm') late += 1; return; }
    const ap = meta().adcs[id], sp = meta().supports[id];
    if (r === 'ADC' && ap) { early += (ap.early - 2) * 0.7; late += (ap.scale - 2) * 0.8; return; }
    if (r === 'SUPPORT' && sp) { early += (sp.early - 2) * 0.6; late += (sp.scale - 2) * 0.6; return; }
    const s = spikeOf(id, by); if (s === 'early') early += 1; if (s === 'late') late += 1;
  });
  return { early, late };
}

// Puissance en combat à 5 : engage, frontline, contrôle de zone, protection, carry qui scale
function teamfightPower(team, by) {
  const ids = ROLES.map(r => team[r]).filter(Boolean);
  const eng = ids.filter(isEngager).length, front = ids.filter(isFront).length, zone = ids.filter(isZoneControl).length;
  const peel = ids.filter(id => (meta().supports[id] || {}).peel >= 3 || (by[id] && by[id].class === 'Enchanter')).length;
  const ap = ids.filter(id => isAP(id)).length, mixed = ap >= 1 && ids.length - ap >= 1;
  const v = Math.min(eng, 2) * 1.2 + Math.min(front, 2) + Math.min(zone, 2) * 0.8 + Math.min(peel, 1) * 0.6 + (team.ADC && HYPER(team.ADC) ? 0.5 : 0) + (mixed ? 0.5 : -0.5);
  return { v, eng, front, zone, peel };
}

// Carry principal d'une équipe : l'ADC s'il existe, sinon le mid
const mainCarry = team => team.ADC || team.MID || team.TOP || null;

function laneLine(role, ally, enemy, by, players) {
  const a = ally[role], e = enemy[role];
  if (!a || !e) return { role, side: 'unknown', title: `${ROLE_FR[role]} : adversaire inconnu`, when: '', tip: 'Ajoute le pick adverse pour voir qui gagne la lane', ally: a, enemy: e };
  const m = analyzeLaneMatchup(by[a] || { id: a, name: cname(a) }, by[e] || { id: e, name: cname(e) }, role);
  const sa = spikeOf(a, by), se = spikeOf(e, by);
  const side = m.advantage === 'ally' ? 'us' : m.advantage === 'enemy' ? 'them' : 'even';
  let when = m.timing;
  if (sa === 'early' && se === 'late') when = side === 'them' ? 'Tu es plus fort tôt : seule fenêtre avant 15:00' : 'Surtout avant 15:00, il se rattrape ensuite';
  else if (sa === 'late' && se === 'early') when = side === 'us' ? 'Sur la durée : survis aux 10 premières minutes' : 'Il domine tôt, tu le rattrapes après 2 objets';
  const tip = side === 'us' ? `${players[role]} prend la priorité de vague et aide aux objectifs de son côté` : side === 'them' ? `${players[role]} joue sous sa tour, ward la rivière ; la jungle couvre cette lane` : `${players[role]} joue les échanges quand les sorts adverses sont en recharge`;
  return { role, side, title: `${cname(a)} contre ${cname(e)}`, reason: m.reason, measured: m.measured, when, tip, ally: a, enemy: e };
}

function botLine(ally, enemy, by, players) {
  const a = ally.ADC, s = ally.SUPPORT, ea = enemy.ADC, es = enemy.SUPPORT;
  if (!a || !s || !ea || !es) return { role: 'BOT', side: 'unknown', title: 'Bot : duo adverse incomplet', when: '', tip: 'Ajoute leur ADC et leur support pour voir qui gagne la lane', ally: a, enemy: ea };
  const L = laneAnalysis({ role: 'ADC', me: a, ally, enemy, side: 'blue' });
  const side = L.verdict[0] === 'good' ? 'us' : L.verdict[0] === 'bad' ? 'them' : 'even';
  const phases = (L.phases || []).map(p => ({ label: p.label, c: p.c === 'adv' ? 'us' : p.c === 'dis' ? 'them' : 'even' }));
  const strong = phases.filter(p => p.c === 'us').map(p => p.label), weak = phases.filter(p => p.c === 'them').map(p => p.label);
  const when = strong.length && weak.length ? `Fort : ${strong.join(', ')} · faible : ${weak.join(', ')}` : strong.length ? `Avantage : ${strong.join(', ')}` : weak.length ? `Désavantage : ${weak.join(', ')}` : 'Équilibré à tous les niveaux';
  const duo = `${players.ADC} et ${players.SUPPORT}`;
  const tip = side === 'us' ? `${duo} poussent et prennent les plaques ; drakes joués de ce côté` : side === 'them' ? `${duo} jouent sous tour jusqu'aux premiers objets ; pas de drake contesté sans la jungle` : `${duo} jouent les fenêtres où ils sont plus forts`;
  return { role: 'BOT', side, title: `${cname(a)} + ${cname(s)} contre ${cname(ea)} + ${cname(es)}`, reason: L.verdict[1], measured: !/estimé à partir des profils/.test(L.verdictSrc || ''), when, tip, phases, ally: a, enemy: ea };
}

export function teamGamePlan(ally, enemy, players, championsById) {
  const by = championsById || {};
  const P = players || Object.fromEntries(ROLES.map(r => [r, ROLE_FR[r]]));
  const lanes = [laneLine('TOP', ally, enemy, by, P), laneLine('MID', ally, enemy, by, P), botLine(ally, enemy, by, P)];
  const sideOf = k => (lanes.find(l => l.role === k) || {}).side;

  // --- Jungle : duel, style du jungler adverse, lanes à risque, côté à jouer
  const jungle = [];
  const ej = enemy.JUNGLE, aj = ally.JUNGLE;
  if (ej) {
    const jp = meta().junglers[ej];
    if (jp) jungle.push({ tone: jp.type === 'early' ? 'bad' : 'info', text: `${cname(ej)} : ${jp.note}` });
    if (jp && jp.type === 'early') jungle.push({ tone: 'warn', text: `Jungler adverse fort tôt : wards dans la jungle de ${P.JUNGLE} vers 1:30, mid et bot l'aident au premier buff s'il envahit` });
    if (aj) {
      const m = analyzeLaneMatchup(by[aj] || { id: aj, name: cname(aj) }, by[ej] || { id: ej, name: cname(ej) }, 'JUNGLE');
      if (m && m.measured) jungle.push({ tone: m.advantage === 'ally' ? 'good' : m.advantage === 'enemy' ? 'bad' : 'info', text: m.advantage === 'ally' ? `${P.JUNGLE} gagne le duel de jungle (${String(m.wr).replace('.', ',')} %, ${m.n} parties) : envahir quand les lanes ont la priorité` : m.advantage === 'enemy' ? `${P.JUNGLE} perd le duel de jungle (${String(m.wr).replace('.', ',')} %, ${m.n} parties) : pas de duel dans sa jungle, contre-ganker près des lanes` : `Duel de jungle équilibré : ${P.JUNGLE} suit ses ganks pour contre-ganker` });
    }
  }
  const weakLanes = lanes.filter(l => l.side === 'them');
  if (weakLanes.length) jungle.push({ tone: 'warn', text: `Lanes à risque de gank : ${weakLanes.map(l => l.role === 'BOT' ? 'bot' : ROLE_FR[l.role].toLowerCase()).join(', ')}. Wards dans la rivière avant 3:00, ${P.JUNGLE} reste proche pour contre-ganker` });
  const winLanes = lanes.filter(l => l.side === 'us');
  const allyCC = ROLES.filter(r => r !== 'JUNGLE' && ally[r] && (isEngager(ally[r]) || isZoneControl(ally[r])));
  if (winLanes.length) {
    const sideTxt = winLanes.map(l => l.role === 'BOT' ? 'bot' : ROLE_FR[l.role].toLowerCase()).join(' et ');
    const objs = [winLanes.some(l => l.role === 'BOT') && 'drakes', winLanes.some(l => l.role === 'TOP') && 'larves et Héraut'].filter(Boolean);
    jungle.push({ tone: 'good', text: `${P.JUNGLE} joue côté ${sideTxt} (lane gagnante)${objs.length ? ' : ' + objs.join(', ') + ' en priorité' : ''}` });
  } else if (allyCC.length) jungle.push({ tone: 'info', text: `Ganks les plus sûrs : lanes avec du contrôle (${allyCC.map(r => cname(ally[r])).join(', ')})` });

  // --- Courbe de puissance
  const cu = curve(ally, by), ce = curve(enemy, by);
  const dEarly = cu.early - ce.early, dLate = cu.late - ce.late;
  let timing;
  if (dEarly >= 1.5 || (dEarly >= 0.8 && dLate <= -0.8)) timing = { side: 'early', title: 'Vous êtes plus forts en début de partie', text: 'Jouez les objectifs avant 20:00 (drakes, larves, Héraut, plaques) et cherchez à finir vite : chaque minute qui passe les rapproche.' };
  else if (dLate >= 1.5 || (dLate >= 0.8 && dEarly <= -0.8)) timing = { side: 'late', title: 'Vous êtes plus forts en fin de partie', text: 'Pas de combat forcé avant les 2 objets : cédez un drake plutôt que de mourir, farmez, et cherchez les combats après 25:00 (Baron, âme).' };
  else timing = { side: 'even', title: 'Puissance équilibrée dans le temps', text: 'La partie se jouera sur les objectifs : arrivez les premiers avec la vision et les vagues poussées.' };

  // --- Combat d'équipe : rôle de chacun
  const tu = teamfightPower(ally, by), te = teamfightPower(enemy, by);
  const ourCarry = mainCarry(ally), theirCarry = mainCarry(enemy);
  const theirDivers = ROLES.map(r => enemy[r]).filter(Boolean).filter(id => isAssassin(id) || (isEngager(id) && !isFront(id)));
  const theirEngage = ROLES.map(r => enemy[r]).filter(Boolean).filter(isEngager);
  // Un seul joueur ouvre le combat (support, puis jungle, top, mid) ; le 2e enchaîne, les suivants protègent le carry
  const engagers = ['SUPPORT', 'JUNGLE', 'TOP', 'MID', 'ADC'].filter(r => ally[r] && isEngager(ally[r]));
  const opener = engagers[0], follow = engagers[1];
  const fight = ROLES.filter(r => ally[r]).map(r => {
    const id = ally[r], c = by[id] || {}, T = tags(id);
    let job;
    if (r === opener) job = `Ouvre le combat${theirCarry ? ` en visant ${cname(theirCarry)}` : ''}, seulement quand les 4 autres sont à portée`;
    else if (r === follow) job = `Enchaîne juste après ${cname(ally[opener])} avec ton contrôle pour que la cible ne s'échappe pas`;
    else if (isEngager(id) && ourCarry && ourCarry !== id) job = `Garde ton contrôle pour ceux qui plongent sur ${cname(ourCarry)}${theirDivers.length ? ` (${list(theirDivers)})` : ''}`;
    else if (isFront(id)) job = 'Devant : absorbe les sorts et protège la ligne arrière';
    else if (r === 'SUPPORT' || c.class === 'Enchanter' || (meta().supports[id] || {}).peel >= 3) job = `Reste collé à ${ourCarry && ourCarry !== id ? cname(ourCarry) : 'votre carry'} : boucliers et contrôles sur ceux qui plongent${theirDivers.length ? ` (${list(theirDivers)})` : ''}`;
    else if (isAssassin(id)) job = `Attends que le combat commence, contourne et élimine ${theirCarry ? cname(theirCarry) : 'leur carry'}`;
    else if (isZoneControl(id)) job = 'Reste derrière et coupe la zone avec tes sorts : vise les groupes';
    else if (id === ourCarry || T.includes('Marksman')) job = `Carry : reste derrière, frappe ce qui est à portée sans avancer${theirEngage.length ? ` ; garde Flash pour ${list(theirEngage.slice(0, 2))}` : ''}`;
    else if (T.includes('Fighter')) job = 'Entre sur le flanc après l\'engage, coupe leur ligne arrière';
    else job = 'Reste groupé et suis la cible du premier contrôle';
    return { role: r, player: P[r], champ: id, job };
  });

  // --- Teamfight ou split push ?
  const splitter = ['TOP', 'MID'].map(r => ({ r, id: ally[r] })).filter(x => x.id && (SPLIT_PUSHERS.includes(x.id) || tags(x.id)[0] === 'Fighter'))
    .map(x => ({ ...x, duel: enemy[x.r] ? duelResult(x.id, enemy[x.r], x.r) : { wr: null } }))
    .filter(x => x.duel.wr == null || x.duel.raw > TEAM_DRAFT.duelBad)
    .sort((a, b) => (SPLIT_PUSHERS.includes(b.id) ? 1 : 0) - (SPLIT_PUSHERS.includes(a.id) ? 1 : 0))[0] || null;
  const gap = tu.v - te.v;
  let strategy;
  if (gap >= 1) strategy = { kind: 'group', title: 'Cherchez le 5 contre 5', text: `Votre compo gagne les combats groupés (${tu.eng} engage, ${tu.front} frontline contre ${te.eng} et ${te.front}). Groupez-vous autour des drakes et du Baron, et forcez le combat quand ils arrivent un par un.${splitter ? ` Quand aucun objectif n'est disponible, ${P[splitter.r]} (${cname(splitter.id)}) peut pousser seul en side lane.` : ''}` };
  else if (gap <= -1 && splitter) strategy = { kind: 'split', title: `Évitez le 5 contre 5 : ${P[splitter.r]} pousse seul`, text: `Leur compo gagne les combats groupés (${te.eng} engage, ${te.front} frontline). ${P[splitter.r]} (${cname(splitter.id)}) pousse seul la lane opposée à l'objectif ; les 4 autres ne lancent pas le combat, défendent sous tour et nettoient les vagues. On ne combat que s'ils envoient 2 joueurs sur ${P[splitter.r]} ou s'ils sont à 4.` };
  else if (gap <= -1) strategy = { kind: 'pick', title: 'Évitez les combats de face', text: 'Leur compo gagne les combats groupés et vous n\'avez pas de joueur pour pousser seul : jouez la vision, attrapez les joueurs isolés et prenez l\'objectif seulement en surnombre.' };
  else strategy = { kind: 'even', title: 'Combats équilibrés : jouez vos fenêtres', text: `Ni l'une ni l'autre compo ne domine en combat à 5. Combattez quand vous êtes plus forts (${timing.side === 'early' ? 'avant 20:00' : timing.side === 'late' ? 'après 25:00' : 'après un kill ou un avantage de vagues'}) et jamais sans vision.${splitter ? ` ${P[splitter.r]} (${cname(splitter.id)}) peut attirer du monde en side lane avant chaque objectif.` : ''}` };

  // --- Win condition (la nôtre et la leur)
  const synUs = detectSynergies(ROLES.map(r => ally[r] && by[ally[r]]).filter(Boolean));
  const synThem = detectSynergies(ROLES.map(r => enemy[r] && by[enemy[r]]).filter(Boolean));
  const wcUs = getWinCondition(synUs), wcThem = getWinCondition(synThem);
  const WC_FR = { 'Protect the Carry': 'protéger le carry', 'Full Engage': 'engager à 5', Poke: 'user à distance avant d\'engager', 'Pick / Catch': 'attraper un joueur isolé', Scaling: 'arriver en fin de partie', Dive: 'plonger sur la ligne arrière', 'Jouer safe et farm': 'jouer safe et farmer' };
  const winParts = [];
  if (strategy.kind === 'split') winParts.push(`${P[splitter.r]} pousse seul pendant que les 4 autres tiennent`);
  else if (strategy.kind === 'group') winParts.push('gagner les combats à 5 autour des objectifs');
  else if (strategy.kind === 'pick') winParts.push('attraper des joueurs isolés grâce à la vision');
  if (timing.side !== 'even') winParts.push(timing.side === 'early' ? 'avant 20:00' : 'après 25:00, sans rien lâcher avant');
  if (ourCarry) winParts.push(`en mettant ${cname(ourCarry)} en sécurité`);
  const winCondition = {
    us: `${winParts.join(', ')}. Style : ${WC_FR[wcUs] || wcUs}.`.replace(/^./, s => s.toUpperCase()),
    them: theirCarry ? `Ils veulent ${WC_FR[wcThem] || wcThem}${theirDivers.length ? `, avec ${list(theirDivers)} qui vient chercher ${ourCarry ? cname(ourCarry) : 'votre carry'}` : ''}. Leur carry à éliminer : ${cname(theirCarry)}.` : null,
  };

  return { lanes, jungle, timing, fight, strategy, winCondition, power: { us: tu, them: te } };
}

export { ROLES };
