// ============================================================
// CHAMPION ENGINE — logique de draft de DraftMaster
// Version autonome (hors Base44) : les classements, duels, builds et taux de victoire
// viennent des données réelles partagées avec le Coach Support (voir gameData.js).
// Les règles par classe d'origine ne servent plus qu'à défaut de données, et le disent.
// ============================================================
import {
  DATA, ROLES as R5, BUILD, meta, cname, tags, isAP, isEngager, isFront, isAssassin, isHealer, hasCC,
  dataRoles, scoreChampion, teamEstimate, duelResult, earlyOf, iname, itemExists, clamp, fmtTime, dmgShare,
} from './gameData.js';

export const ROLES = R5;

export const ROLE_LABELS = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'ADC',
  SUPPORT: 'Support',
};

// ------------------------------------------------------------
// Profil d'un champion (tags Data Dragon, corrigés par les données quand elles existent)
// ------------------------------------------------------------
export function inferRolesFromTags(tagList = []) {
  const t = tagList.map(tag => tag.toLowerCase());
  const isMarksman = t.includes('marksman'), isSupport = t.includes('support'), isMage = t.includes('mage');
  const isTank = t.includes('tank'), isFighter = t.includes('fighter'), isAssassinT = t.includes('assassin');
  if (isMarksman && !isSupport) return ['ADC'];
  if (isSupport && !isMage && !isFighter && !isAssassinT) return ['SUPPORT'];
  if (isSupport && isMage) return ['SUPPORT', 'MID'];
  if (isSupport && isTank) return ['SUPPORT', 'TOP'];
  if (isMarksman && isSupport) return ['ADC', 'SUPPORT'];
  const roles = [];
  if (isFighter) { roles.push('TOP'); roles.push('JUNGLE'); }
  if (isTank) { roles.push('TOP'); roles.push('JUNGLE'); }
  if (isMage) roles.push('MID');
  if (isAssassinT) { roles.push('MID'); roles.push('JUNGLE'); }
  if (roles.length === 0) roles.push('MID');
  return [...new Set(roles)];
}

export function inferClass(tagList = [], id = '') {
  const t = tagList.map(x => x.toLowerCase());
  const sp = meta().supports[id];
  if (sp && sp.arch === 'enchanter') return 'Enchanter';
  if (t.includes('marksman')) return 'Marksman';
  if (t.includes('assassin')) return 'Assassin';
  if (t.includes('mage')) return 'Mage';
  if (t.includes('support') && t.includes('tank')) return 'Tank';
  if (t.includes('support')) return 'Enchanter';
  if (t.includes('tank')) return 'Tank';
  if (t.includes('fighter')) return 'Bruiser';
  return 'Specialist';
}

export function inferDamageType(tagList = []) {
  const t = tagList.map(x => x.toLowerCase());
  if (t.includes('marksman') || t.includes('fighter')) return 'AD';
  if (t.includes('mage')) return 'AP';
  if (t.includes('assassin')) return 'AD';
  if (t.includes('support')) return 'AP';
  return 'Mix';
}

const CLASS_STRENGTHS = {
  Tank: ['engage', 'peel', 'frontline'], Bruiser: ['duel', 'splitpush', 'DPS'], Mage: ['poke', 'burst', 'scaling'],
  Assassin: ['burst', 'pick', 'roam'], Marksman: ['DPS', 'scaling', 'teamfight'], Enchanter: ['peel', 'heal', 'engage'], Specialist: ['utility', 'poke', 'vision'],
};
const CLASS_WEAK = {
  Tank: ['peu de dégâts', 'facile à kiter'], Bruiser: ['sensible au poke', 'dépend des contrôles'], Mage: ['immobile', 'fragile'],
  Assassin: ['perd en puissance', 'unidimensionnel'], Marksman: ['fragile', 'pas d\'engage'], Enchanter: ['pas d\'engage', 'ciblé en premier'], Specialist: ['irrégulier', 'niche'],
};
const CLASS_SPIKE = { Tank: 'mid', Bruiser: 'early', Mage: 'mid', Assassin: 'mid', Marksman: 'late', Enchanter: 'late', Specialist: 'mid' };
export const inferStrengths = cls => CLASS_STRENGTHS[cls] || ['utility'];
export const inferWeaknesses = cls => CLASS_WEAK[cls] || ['situationnel'];
export const inferPowerSpike = cls => CLASS_SPIKE[cls] || 'mid';

export function buildChampion(riotChamp) {
  const cls = inferClass(riotChamp.tags || [], riotChamp.id);
  return {
    id: riotChamp.id, key: riotChamp.key, name: riotChamp.name, title: riotChamp.title,
    roles: inferRolesFromTags(riotChamp.tags || []), class: cls, damageType: inferDamageType(riotChamp.tags || []),
    tags: riotChamp.tags || [], strengths: inferStrengths(cls), weaknesses: inferWeaknesses(cls), powerSpike: inferPowerSpike(cls),
    difficulty: riotChamp.info?.difficulty || 5,
    iconUrl: `https://ddragon.leagueoflegends.com/cdn/${riotChamp.iconVersion || '16.22.1'}/img/champion/${riotChamp.id}.png`,
  };
}

// Corrige le profil avec les données réelles : postes joués, type de dégâts (achats), pic de puissance (profils écrits)
export function enrichChampion(c) {
  const roles = dataRoles(c.id);
  const share = dmgShare(c.id);
  const ap = isAP(c.id);
  const damageType = share && share.ap > 0.4 && share.ap < 0.6 ? 'Mix' : ap ? 'AP' : 'AD';
  const cls = inferClass(c.tags, c.id);
  const strengths = [...inferStrengths(cls)];
  if (isEngager(c.id) && !strengths.includes('engage')) strengths.unshift('engage');
  const prof = meta().adcs[c.id] || meta().supports[c.id];
  const powerSpike = prof && prof.scale != null ? (prof.scale >= 3 ? 'late' : prof.early >= 3 ? 'early' : 'mid') : inferPowerSpike(cls);
  return { ...c, roles: roles.length ? roles : c.roles, dataRoles: roles, class: cls, damageType, strengths, weaknesses: inferWeaknesses(cls), powerSpike };
}

// ------------------------------------------------------------
// SYNERGIES D'ÉQUIPE
// ------------------------------------------------------------
export function detectSynergies(team) {
  if (!team || team.length === 0) return [];
  const synergies = [];
  const ids = team.map(c => c.id);
  const hasEngage = ids.some(isEngager) || team.some(c => c.class === 'Tank');
  const hasEnchanter = team.some(c => c.class === 'Enchanter');
  const hasMarksman = team.some(c => c.class === 'Marksman');
  const hasAssassin = ids.some(isAssassin) || team.some(c => c.class === 'Assassin');
  const hasBruiser = team.some(c => c.class === 'Bruiser');
  const hasScaling = team.filter(c => c.powerSpike === 'late').length >= 2;
  const hasPoke = team.filter(c => c.strengths?.includes('poke') || (meta().supports[c.id] || {}).poke >= 3 || (meta().adcs[c.id] || {}).style === 'poke').length >= 2;
  const hasHook = ids.some(id => (meta().hookers || []).includes(id));

  if (hasEngage && hasMarksman && hasEnchanter) synergies.push({ type: 'Protect the Carry', icon: '🛡️', color: 'text-blue-info', desc: 'Composition solide pour protéger l\'ADC en teamfight' });
  if (hasEngage && !hasEnchanter && (hasBruiser || hasAssassin)) synergies.push({ type: 'Full Engage', icon: '⚔️', color: 'text-red-lose', desc: 'Engage brutal, force le fight' });
  if (hasPoke) synergies.push({ type: 'Poke', icon: '🎯', color: 'text-gold', desc: 'Usure à distance avant d\'engager' });
  if ((hasAssassin || hasHook) && hasEngage) synergies.push({ type: 'Pick / Catch', icon: '🪤', color: 'text-primary', desc: 'Isolation de cibles et éliminations rapides' });
  if (hasScaling && (hasEnchanter || team.length >= 3)) synergies.push({ type: 'Scaling', icon: '📈', color: 'text-green-win', desc: 'Composition qui gagne en late game' });
  if (team.filter(c => c.class === 'Bruiser' || c.class === 'Assassin').length >= 2) synergies.push({ type: 'Dive', icon: '🔥', color: 'text-destructive', desc: 'Plonge sur les carries ennemis' });
  return synergies;
}

export function getWinCondition(synergies) {
  if (!synergies || synergies.length === 0) return 'Jouer safe et farm';
  const priority = ['Protect the Carry', 'Full Engage', 'Scaling', 'Pick / Catch', 'Poke', 'Dive'];
  for (const p of priority) { const found = synergies.find(s => s.type === p); if (found) return found.type; }
  return synergies[0].type;
}

// ------------------------------------------------------------
// SCORE DE DRAFT (/100) : structure de la compo + avantage mesuré dans les données
// ------------------------------------------------------------
const toIds = byRole => { const o = {}; R5.forEach(r => { o[r] = byRole && byRole[r] ? (byRole[r].id || byRole[r]) : null; }); return o; };

// Recette logique P2-1 : bonus de structure réduits (au plus +21, contre +53 avant), victoire estimée plus lourde (±8 pts = ±24 pts de score).
// Une compo moyenne (structure correcte, victoire estimée ~50 %) tombe vers 60-70, et « Excellente » (≥ 80)
// n'est possible qu'avec une victoire estimée d'au moins 50 %.
export const DRAFT_SCORE = { base: 50, winWeight: 3, excellent: 80, good: 60 };
export function calculateDraftScore(allyTeam, enemyTeam, allyByRole, enemyByRole) {
  if (!allyTeam || allyTeam.length === 0) return 50;
  let score = DRAFT_SCORE.base;
  const ids = allyTeam.map(c => c.id);
  const ap = ids.filter(id => isAP(id)).length, ad = ids.length - ap;
  if (ap >= 1 && ad >= 1) score += 5;
  if (allyTeam.length >= 3 && (ap === 0 || ad === 0)) score -= 6;
  const eng = ids.filter(isEngager).length;
  if (eng >= 1) score += 4; else if (allyTeam.length >= 4) score -= 3;
  if (ids.some(isFront)) score += 4; else if (allyTeam.length >= 4) score -= 3;
  if (allyTeam.some(c => c.class === 'Enchanter') || ids.some(id => (meta().supports[id] || {}).peel >= 3)) score += 3;
  if (allyTeam.filter(c => c.powerSpike === 'late').length >= 2) score += 1;
  const avgDifficulty = allyTeam.reduce((s, c) => s + (c.difficulty || 5), 0) / allyTeam.length;
  if (avgDifficulty > 7) score -= 4; else if (avgDifficulty < 4) score += 2;
  score += Math.min(2, detectSynergies(allyTeam).length) * 1;
  // Avantage mesuré (taux de victoire réels, duels de lane, duo bot)
  if (allyByRole) {
    const est = teamEstimate(toIds(allyByRole), toIds(enemyByRole));
    score += clamp(est.delta, -8, 8) * DRAFT_SCORE.winWeight;
    if (est.win < 50) score = Math.min(score, DRAFT_SCORE.excellent - 1);
  }
  return Math.max(10, Math.min(100, Math.round(score)));
}

export function getDraftScoreLabel(score) {
  if (score >= DRAFT_SCORE.excellent) return { label: 'Excellente', color: 'text-green-win' };
  if (score >= DRAFT_SCORE.good) return { label: 'Équilibrée', color: 'text-gold' };
  return { label: 'Risquée', color: 'text-red-lose' };
}

// Victoire estimée (bornée à [42 ; 58] %, correction 7)
export function calculateWinProbability(allyByRole, enemyByRole) {
  const a = toIds(allyByRole), e = toIds(enemyByRole);
  if (!Object.values(a).some(Boolean)) return 50;
  return teamEstimate(a, e).win;
}

// ------------------------------------------------------------
// RECOMMANDATIONS (port du classement du coach : WR haut niveau + alliés + adversaires + compo)
// ------------------------------------------------------------
const MASTERY_BONUS = { main: 1.5, comfortable: 1, beginner: 0 };

export function getRecommendations(role, allChampions, allyByRole, enemyByRole, userPool = []) {
  const empty = { best: null, alternatives: [], risky: [] };
  if (!allChampions || allChampions.length === 0) return empty;
  const ally = toIds(allyByRole), enemy = toIds(enemyByRole);
  const taken = new Set([...Object.values(ally), ...Object.values(enemy)].filter(Boolean));
  const hasData = !!(DATA.builds && DATA.builds.builds);
  const eligible = allChampions.filter(c => !taken.has(c.id) && (
    (c.roles || []).includes(role) || (userPool || []).some(p => p.championId === c.id && p.roles && p.roles[role])
  ));
  if (eligible.length === 0) return empty;

  const scored = eligible.map(c => {
    const r = scoreChampion(c.id, role, ally, enemy);
    const poolEntry = userPool?.find(p => p.championId === c.id);
    const roleMastery = poolEntry ? (poolEntry.roles?.[role] || (Object.keys(poolEntry.roles || {}).length ? null : poolEntry.mastery)) : null;
    // Le pool ne bloque jamais la meilleure reco : petit bonus seulement (cahier des charges)
    const bonus = roleMastery ? (MASTERY_BONUS[roleMastery] || 0) : 0;
    const reasons = [];
    if (roleMastery === 'main') reasons.push('ton main');
    else if (roleMastery === 'comfortable') reasons.push('champion confortable');
    r.parts.filter(p => Math.abs(p[0]) >= 1).slice(0, 2).forEach(p => reasons.push(shortReason(p[1], p[0])));
    if (r.blind) reasons.push('⚠️ risque de contre-pick');
    if (!reasons.length) reasons.push(r.n ? `${r.base.toFixed(1)} % chez les meilleurs joueurs` : 'peu de données à ce poste');
    return {
      ...c, recommendScore: r.score, rank: r.raw + bonus + (r.est ? 0 : -3), isInPool: !!poolEntry, poolMastery: roleMastery,
      reason: reasons.slice(0, 2).join(' · '), scoreDetail: r.reasons, games: r.n, blind: r.blind, est: r.est, parts: r.parts,
    };
  });
  // Sans données haut niveau, on garde l'ordre par profil (les champions sans parties passent après)
  scored.sort((a, b) => b.rank - a.rank);
  const pool = hasData ? scored.filter(c => c.est || c.isInPool) : scored;
  const list = pool.length ? pool : scored;
  const best = list[0] || null;
  const risky = scored.filter(c => {
    if (c.blind) return true;
    const duel = (c.parts || []).find(p => /\(duel\)/.test(p[1]));
    if (duel && duel[0] <= -2) return true;
    return c.recommendScore <= 46 && (c.isInPool || c.est);
  }).filter(c => c.id !== best?.id).slice(0, 3).map(c => ({ ...c, riskReason: c.blind ? 'Risque de contre-pick : ton adversaire choisit après toi' : riskText(c) }));
  // Recette logique P2-4 : un champion « à éviter » n'est jamais proposé en alternative
  const avoid = new Set(risky.map(c => c.id));
  const alternatives = list.slice(1).filter(c => !avoid.has(c.id)).slice(0, 4);
  return { best, alternatives, risky };
}
function shortReason(txt, v) {
  const m = txt.match(/^(\d+(?:[.,]\d+)?) % contre (.+?) \(duel\)(?: au lieu de (\d+(?:[.,]\d+)?) %)?/);
  // Le % seul peut tromper (52 % « difficile » pour un champion à 55 % de moyenne) : on donne aussi sa moyenne
  const vs = m && m[3] && m[3] !== m[1] ? `${m[1]} % au lieu de ${m[3]} %` : m && `${m[1]} %`;
  if (m) return v > 0 ? `gagne contre ${m[2]} (${vs})` : `⚠️ difficile contre ${m[2]} (${vs})`;
  const w = txt.match(/^(\d+(?:[.,]\d+)?) % avec (.+?) au lieu/);
  if (w) return v > 0 ? `bon duo avec ${w[2]}` : `moins bon avec ${w[2]}`;
  return txt.replace(/ \(.*$/, '');
}
function riskText(c) {
  const duel = (c.parts || []).find(p => /\(duel\)/.test(p[1]) && p[0] < 0);
  if (duel) return shortReason(duel[1], duel[0]).replace('⚠️ ', '');
  return 'Victoire estimée faible face à cette compo';
}

// Gardé pour compatibilité : delta de matchup par classe (utilisé seulement sans données)
const COUNTER_MATRIX = {
  'Tank-Assassin': 12, 'Tank-Marksman': 10, 'Tank-Mage': 6, 'Tank-Enchanter': 8,
  'Bruiser-Assassin': 8, 'Bruiser-Marksman': 10, 'Bruiser-Mage': 4, 'Bruiser-Enchanter': 6,
  'Mage-Tank': 12, 'Mage-Enchanter': 6, 'Mage-Bruiser': 4, 'Mage-Assassin': -12, 'Mage-Marksman': 4,
  'Assassin-Mage': 12, 'Assassin-Marksman': 10, 'Assassin-Enchanter': 10, 'Assassin-Tank': -12, 'Assassin-Bruiser': -8,
  'Marksman-Tank': -10, 'Marksman-Bruiser': -8, 'Marksman-Assassin': -10, 'Marksman-Mage': 4, 'Marksman-Enchanter': 6,
  'Enchanter-Tank': -8, 'Enchanter-Bruiser': -6, 'Enchanter-Assassin': -8, 'Enchanter-Marksman': 4, 'Enchanter-Mage': 2,
};
export function getCounterScore(allyChamp, enemyChamp) {
  if (!allyChamp || !enemyChamp) return { delta: 0 };
  return { delta: COUNTER_MATRIX[`${allyChamp.class}-${enemyChamp.class}`] ?? 0 };
}

// ------------------------------------------------------------
// MATCHUP DE LANE : verdict lu dans counters.json (≥ 20 parties), conseils cohérents
// (recette 2 n° 2 et 4, méga recette C6)
// ------------------------------------------------------------
const CLASS_MATRIX = {
  'Tank-Assassin': { advantage: 'ally', reason: 'Le Tank absorbe les dégâts et contrôle l\'Assassin', timing: 'Dès le niveau 6', advice: 'Engage dès que possible' },
  'Tank-Marksman': { advantage: 'ally', reason: 'Le Tank résiste facilement aux dégâts', timing: 'Toute la partie', advice: 'All-in dès que possible, force le fight' },
  'Tank-Mage': { advantage: 'neutral', reason: 'Le Mage poke mais le Tank résiste', timing: 'Après l\'objet de résistance magique', advice: 'Rush résistance magique, engage sur la vague' },
  'Assassin-Mage': { advantage: 'ally', reason: 'L\'Assassin peut tuer le Mage immobile', timing: 'Niveau 6', advice: 'Roam, prends le 6, all-in sur le Mage' },
  'Assassin-Tank': { advantage: 'enemy', reason: 'Le Tank a trop de résistances', timing: 'Dès le début', advice: 'Évite les duels, cible les carries' },
  'Mage-Tank': { advantage: 'ally', reason: 'Le Mage perce les résistances', timing: 'Après 2 objets', advice: 'Farm, poke en priorité, groupe mid' },
  'Bruiser-Tank': { advantage: 'neutral', reason: 'Matchup d\'usure, dépend des échanges', timing: 'Niveau 3', advice: 'Échanges courts, rentre à la base quand tu es bas' },
  'Marksman-Tank': { advantage: 'enemy', reason: 'Le Tank survit trop longtemps en 1v1', timing: 'Dès le début', advice: 'Joue safe, pousse la vague, recule s\'il engage' },
  'Enchanter-Tank': { advantage: 'enemy', reason: 'Le Tank peut all-in l\'Enchanteur', timing: 'Dès le niveau 2', advice: 'Reste derrière ton carry, utilise boucliers et soins' },
};
export function analyzeLaneMatchup(allyChamp, enemyChamp, role) {
  if (!allyChamp || !enemyChamp) return null;
  const r = role || allyChamp.roles?.[0] || 'MID';
  const d = duelResult(allyChamp.id, enemyChamp.id, r);
  const em = earlyOf(allyChamp.id), eo = earlyOf(enemyChamp.id);
  // Patchs affichés séparément quand counters.json et builds.json ne sont pas au même patch (recette logique P3)
  const cntPatch = DATA.cnt && DATA.cnt.patch && DATA.builds && DATA.cnt.patch !== DATA.builds.patch ? `, patch ${DATA.cnt.patch}` : '';
  const src = d.source === 'counters' ? `${DATA.cnt.source}, ${DATA.cnt.rank}${cntPatch}` : `Challenger / GM / Master${DATA.builds && DATA.builds.patch ? ', patch ' + DATA.builds.patch : ''}`;
  if (d.wr != null) {
    // Recette logique P2-6 : verdict sur le % non arrondi, seuils symétriques (A favorable ⇔ B difficile)
    const raw = d.raw != null ? d.raw : d.wr;
    const adv = raw >= 53 ? 'ally' : raw <= 47 ? 'enemy' : 'neutral';
    const pct = String(Math.round(raw * 10) / 10).replace('.', ',');
    const reason = adv === 'ally' ? `Duel favorable : ${pct} % de victoires (${d.n} parties, ${src})`
      : adv === 'enemy' ? `Duel difficile : ${pct} % de victoires (${d.n} parties, ${src})`
      : `Duel équilibré : ${pct} % de victoires (${d.n} parties, ${src})`;
    // Le % vaut pour toute la partie : les niveaux 1-3 ne viennent que des profils (C6)
    let timing = 'Sur l\'ensemble de la partie';
    let advice;
    if (adv === 'ally') {
      advice = em != null && eo != null && eo > em ? 'Favorable sur la durée, mais il gagne les premiers niveaux : farm calmement jusqu\'au niveau 3, puis prends la main'
        : em != null && eo != null && em > eo ? 'Tu gagnes aussi les premiers niveaux : mets la pression dès le niveau 1'
        : 'Garde la priorité sur ta vague et prends les plaques avant 14:00';
      if (em != null && eo != null && eo > em) timing = 'Après le niveau 3';
    } else if (adv === 'enemy') {
      advice = 'Farm près de ta tour, échange seulement quand ses sorts clés sont en recharge et appelle ton jungler';
      if (em != null && eo != null && em > eo) { advice = 'Difficile sur la durée, mais tu gagnes les premiers niveaux : prends l\'avantage tôt puis joue plus prudemment'; timing = 'Niveaux 1 à 3'; }
    } else advice = 'Échange quand ses sorts clés sont en recharge, avance seulement avec de la vision';
    return { advantage: adv, reason, timing, advice, wr: Math.round(raw * 10) / 10, n: d.n, measured: true };
  }
  const key = `${allyChamp.class}-${enemyChamp.class}`, rev = `${enemyChamp.class}-${allyChamp.class}`;
  let m = CLASS_MATRIX[key];
  if (!m && CLASS_MATRIX[rev]) { const x = CLASS_MATRIX[rev]; m = { ...x, advantage: x.advantage === 'ally' ? 'enemy' : x.advantage === 'enemy' ? 'ally' : 'neutral' }; }
  if (!m) m = { advantage: 'neutral', reason: 'Matchup équilibré', timing: 'Milieu de partie', advice: 'Farm safe, cherche les flancs' };
  return { ...m, reason: `${m.reason} (estimation par classe : pas assez de parties sur ce duel)`, measured: false, n: d.n };
}

// ------------------------------------------------------------
// BUILD (builds.json) avec les règles des audits 1 à 5, C4, C7, C8
// ------------------------------------------------------------
const ANTIHEAL = ['3123', '3033', '3165', '3916', '6609', '3075', '3076', '3011'];
const UNIQUE_GROUPS = { lifeline: ['3156', '3053', '6673'], spellblade: ['3078', '3100', '3508', '6662', '3057', '3025'], lastwhisper: ['3036', '3033', '3035', '6694'], immolate: ['3068', '6664'], mana: ['3004', '3003', '3119', '3040', '3042', '3121'], hydra: ['3074', '3748', '6698', '3077'] };
const itemGroup = id => { id = String(id); const x = DATA.items[id]; if (x && x.grp) return x.grp; return Object.keys(UNIQUE_GROUPS).find(g => UNIQUE_GROUPS[g].includes(id)) || null; };
const itemTags = id => (DATA.items[id] && DATA.items[id].tags) || [];
const hasArmor = id => itemTags(id).includes('Armor');
const hasMR = id => itemTags(id).includes('SpellBlock');
const isOffAP = id => itemTags(id).includes('SpellDamage');
const isOffAD = id => { const t = itemTags(id); return t.includes('Damage') || t.includes('CriticalStrike') || t.includes('AttackSpeed'); };
const DEF_BY_CLASS = {
  Tank: { ad: ['3110', '3075', '3143'], ap: ['8020', '2504'] }, Enchanter: { ad: ['3190'], ap: ['3222', '3190'] },
  Mage: { ad: ['3157'], ap: ['3102'] }, Marksman: { ad: ['6673', '6333'], ap: ['3156'] }, Bruiser: { ad: ['6333'], ap: ['3156', '4401'] },
  Assassin: { ad: ['6333'], ap: ['3156'] }, Specialist: { ad: ['3157'], ap: ['3102'] },
};
const SPELL_FR = { 1: 'Purge', 3: 'Fatigue', 4: 'Flash', 6: 'Fantôme', 7: 'Soins', 11: 'Châtiment', 12: 'Téléportation', 14: 'Embrasement', 21: 'Barrière', 32: 'Marque' };
const FLAG_FR = { ap: 'dégâts magiques', ad: 'équipe très AD', heal: 'beaucoup de soins', tank: 'beaucoup de tanks', cc: 'beaucoup de contrôles', adBurst: 'assassins AD', apBurst: 'assassins AP' };

function enemyFlags(enIds) {
  const ap = enIds.filter(id => isAP(id)).length, ad = enIds.length - ap;
  const ass = enIds.filter(isAssassin);
  const assAP = ass.filter(id => isAP(id)).length, assAD = ass.length - assAP;
  return {
    n: enIds.length, ap, ad, heal: enIds.filter(isHealer).length, tank: enIds.filter(isFront).length, cc: enIds.filter(hasCC).length,
    adBurst: ass.length && assAD >= assAP, apBurst: ass.length && assAP >= assAD,
  };
}
// Objets qui n'ont de sens que contre une menace précise : jamais dans le cœur sans cette menace
function fitsCore(item, F) {
  if (ANTIHEAL.includes(item) && !(F.heal >= 1)) return false;
  if (item === '3222' && !(F.cc >= 3)) return false;
  return true;
}
function fitsThreat(item, F) {
  if (!fitsCore(item, F)) return false;
  if (hasMR(item) && !hasArmor(item) && !isOffAP(item) && !isOffAD(item) && F.ap < 2 && !F.apBurst) return false;
  if (hasArmor(item) && !hasMR(item) && !isOffAP(item) && !isOffAD(item) && F.ad < 2 && !F.adBurst) return false;
  return true;
}

export const SITUATIONAL_MAX_SHARE = 25;
export function recommendedBuild(champion, role, enemyTeam = [], enemyLaner = null) {
  const b = BUILD(champion.id, role);
  if (!b) return null;
  const enIds = enemyTeam.map(c => c.id);
  const F = enemyFlags(enIds);
  const used = new Set(), groups = new Set();
  const can = id => { id = String(id); if (used.has(id) || !itemExists(id)) return false; const g = itemGroup(id); return !(g && groups.has(g)); };
  const take = id => { id = String(id); used.add(id); const g = itemGroup(id); if (g) groups.add(g); return id; };

  // Départ (correction 1 : objet de support obligatoire)
  let start = ((b.start && b.start[0] && b.start[0][0]) || []).map(String);
  if (role === 'SUPPORT' && !start.includes('3865') && itemExists('3865')) start = ['3865', ...start.filter(x => x !== '3865')];

  // Variante principale (C8) : le noyau le plus joué fixe le type de dégâts
  const core = [];
  const coreSrc = (b.core && b.core[0] && b.core[0][0]) || ((b.first && b.first[0]) ? [b.first[0][0]] : []);
  coreSrc.map(String).forEach(id => { if (can(id)) core.push(take(id)); });
  // Recette logique P2-7 : un objet hybride (Guinsoo, Aube et crépuscule…) ne fixe pas la variante AP / AD
  const pureAP = id => isOffAP(id) && !isOffAD(id), pureAD = id => isOffAD(id) && !isOffAP(id);
  const offAP = core.some(pureAP), offAD = core.some(pureAD);
  const sameVariant = id => (offAP && !offAD && pureAD(id)) || (offAD && !offAP && pureAP(id)) ? false : true;
  // Objets de situation (correction 3), recette logique P1-3 : seulement ceux que peu de joueurs achètent (< 25 % du pool) ;
  // un objet acheté par un quart des joueurs ou plus fait partie du build normal même s'il est aussi cité « contre X ».
  const share = {}; (b.pool || []).forEach(([id, p]) => { share[String(id)] = p; });
  const situational = new Set(Object.values(b.vs || {}).flat().map(x => String(x[0])).filter(id => (share[id] || 0) < SITUATIONAL_MAX_SHARE));
  // Compléter jusqu'à 4 objets avec le pool : 1er passage strict ; le filtre armure / RM pure ne joue que si au moins
  // 3 adversaires sont connus ; 2e passage si le cœur reste incomplet (même sans compo adverse)
  const passes = [
    s => !situational.has(s) && (F.n < 3 || fitsThreat(s, F)),
    s => fitsCore(s, F),
  ];
  for (const ok of passes) for (const [id] of (b.pool || [])) {
    if (core.length >= 4) break;
    const s = String(id);
    if (s === '3026' || !sameVariant(s) || !ok(s) || !can(s)) continue;
    core.push(take(s));
  }

  // Bottes (C7) : pas de Mercure contre ≥ 3 AD connus et 0 AP, pas de Coques contre ≥ 3 AP et 0 AD
  let boots = String((b.boots && b.boots[0] && b.boots[0][0]) || '');
  if (role !== 'ADC') {
    if (F.n >= 3 && F.ap === 0 && boots === '3111') boots = '3047';
    else if (F.n >= 3 && F.ad === 0 && boots === '3047') boots = '3111';
    if (F.ad >= 4 && boots !== '3047' && !core.slice(0, 4).some(hasArmor)) boots = '3047';
    if (F.ap >= 4 && boots !== '3111' && !core.slice(0, 4).some(hasMR)) boots = '3111';
  }
  if (boots) take(boots);

  // Objets de situation selon la menace réelle (corrections 3 et 4), jamais l'Ange gardien (2)
  const sit = [];
  const flags = [];
  if (F.ap >= 3) flags.push('ap'); if (F.ad >= 4) flags.push('ad'); if (F.heal >= 2) flags.push('heal');
  if (F.tank >= 3) flags.push('tank'); if (F.cc >= 3) flags.push('cc');
  if (F.adBurst) flags.push('adBurst'); if (F.apBurst) flags.push('apBurst');
  flags.forEach(fl => {
    const src = (b.vs || {})[fl] || (fl.endsWith('Burst') ? (b.vs || {}).assassin : null) || [];
    const ok = src.map(x => String(x[0])).filter(id => id !== '3026' && sameVariant(id) && (fl === 'adBurst' ? hasArmor(id) || ['3157'].includes(id) : fl === 'apBurst' ? hasMR(id) || ['3157'].includes(id) : true));
    const id = ok.find(can);
    if (id) sit.push({ id: take(id), why: `contre ${FLAG_FR[fl]}` });
  });
  // Défense garantie contre ≥ 4 AD / AP (correction 5)
  const all = [...core, ...sit.map(x => x.id)];
  const cls = champion.class || 'Specialist';
  if (F.ad >= 4 && !all.slice(0, 6).some(hasArmor) && boots !== '3047') { const id = (DEF_BY_CLASS[cls] || DEF_BY_CLASS.Specialist).ad.find(can); if (id) sit.unshift({ id: take(id), why: 'contre une équipe très AD' }); }
  if (F.ap >= 4 && !all.slice(0, 6).some(hasMR) && boots !== '3111') { const id = (DEF_BY_CLASS[cls] || DEF_BY_CLASS.Specialist).ap.find(can); if (id) sit.unshift({ id: take(id), why: 'contre une équipe très AP' }); }
  // Objet contre l'adversaire direct : top, mid, support seulement, ≥ 20 parties (correction 2, recette 2 n° 3)
  if (enemyLaner && ['TOP', 'MID', 'SUPPORT'].includes(role)) {
    const x = ((b.lane || {})[enemyLaner.id] || []).find(e => e[3] >= 20 && String(e[0]) !== '3026' && can(String(e[0])) && fitsThreat(String(e[0]), enemyFlags([enemyLaner.id])));
    if (x) sit.unshift({ id: take(String(x[0])), why: `contre ${enemyLaner.name} (${x[1]} % des meilleurs joueurs, ${x[3]} parties)` });
  }
  return {
    start, core: core.slice(0, 4), boots, situational: sit.slice(0, 3),
    spells: (b.spells || []).map(s => SPELL_FR[s] || ('Sort ' + s)), spellIds: b.spells || [],
    games: b.n, runes: parseRunes(b.runes),
  };
}
function parseRunes(s) {
  if (!s) return null;
  const [p, q] = String(s).split('|');
  const [ps, pr] = (p || '').split(':'), [ss, sr] = (q || '').split(':');
  const name = id => (DATA.runes[id]) || id;
  const prim = (pr || '').split(',').filter(Boolean), sec = (sr || '').split(',').filter(Boolean);
  return { keystone: name(prim[0]), primary: name(ps), secondary: name(ss), primaryRunes: prim.slice(1).map(name), secondaryRunes: sec.map(name) };
}

// ------------------------------------------------------------
// CONSEILS DE JEU
// ------------------------------------------------------------
export function generateGameTips(champion, enemyLaner, allyTeam, isBeginnerInPool, role, enemyTeam = []) {
  if (!champion) return null;
  const r = role || champion.roles?.[0] || 'MID';
  const build = recommendedBuild(champion, r, enemyTeam, enemyLaner);
  const T = timersFR();
  const early = isBeginnerInPool ? ['Farm sous ta tour si tu es en danger', 'Évite les échanges prolongés', 'Rentre à la base vers 60 % de PV si l\'adversaire a l\'avantage'] : getEarlyAdvice(champion, r, T);
  if (isBeginnerInPool && r === 'SUPPORT') early.splice(0, 1, 'Reste près de ton ADC et de ta tour si vous êtes en danger');
  const mid = getMidAdvice(champion, allyTeam, T, r);
  const late = getLateAdvice(champion, r);
  // Recette logique P1-2 : le jungler garde toujours son plan de jungle (gank, crabe, objectifs) ;
  // le jungler adverse et le duel de jungle viennent en dessous
  const lane = r === 'JUNGLE' ? [...jungleAdvice(champion, allyTeam, T), ...(enemyLaner ? jungleDuel(champion, enemyLaner) : [])]
    : enemyLaner ? getLaneAdvice(champion, enemyLaner, r, build) : ['Joue safe, farm et attends les opportunités'];
  return {
    early, mid, late, lane,
    build: build ? {
      starter: Object.entries(build.start.reduce((o, x) => { o[x] = (o[x] || 0) + 1; return o; }, {})).map(([x, n]) => (n > 1 ? n + ' × ' : '') + iname(x)).join(' + ') || '—',
      core: [...build.core.map(iname), ...(build.boots ? [iname(build.boots)] : [])],
      situational: build.situational.map(x => `${iname(x.id)} (${x.why})`),
      ids: build, source: `Build le plus joué chez les meilleurs joueurs (${build.games} parties Challenger / GM / Master)`,
    } : { ...legacyBuild(champion), source: 'Pas assez de parties à ce poste : build type de la classe (indicatif)' },
    runes: build && build.runes ? { keystone: build.runes.keystone, primary: build.runes.primary, secondary: build.runes.secondary, description: [...build.runes.primaryRunes, ...build.runes.secondaryRunes].join(' · ') + (build.spells.length ? ` — Sorts : ${build.spells.join(' + ')}` : '') } : legacyRunes(champion),
    commonMistakes: getCommonMistakes(champion, build, r),
  };
}
function timersFR() {
  const t = meta().timers || {};
  return { scuttle: fmtTime(t.scuttle || 175), dragon: fmtTime(t.dragon || 300), grubs: fmtTime(t.grubs || 480), herald: fmtTime(t.herald || 900), baron: fmtTime(t.baron || 1200), plates: fmtTime(t.platesDecay ? t.platesDecay + 180 : 840) };
}
// Recette logique P1-4 : les conseils de phase se choisissent d'abord par poste, puis se nuancent par classe.
// Clé de profil = poste + façon de le jouer (un mage support ne lit pas les conseils d'un mage mid,
// un tireur top ne lit pas « reste derrière ton support »).
export function tipProfile(c, role) {
  const cls = c.class || 'Specialist';
  if (role === 'SUPPORT') {
    const arch = (meta().supports[c.id] || {}).arch;
    if (arch === 'enchanter' || (!arch && cls === 'Enchanter')) return 'SUP_ENCHANTER';
    if (arch === 'engage' || arch === 'warden' || (!arch && cls === 'Tank')) return 'SUP_ENGAGE';
    if (arch === 'mage' || (!arch && cls === 'Mage')) return 'SUP_MAGE';
    return 'SUP_PICK';
  }
  if (role === 'ADC') return cls === 'Marksman' ? 'ADC_MARKSMAN' : cls === 'Mage' || cls === 'Enchanter' || cls === 'Specialist' ? 'ADC_MAGE' : 'ADC_MELEE';
  if (role === 'JUNGLE') return 'JUNGLE_' + cls;
  // TOP / MID
  if (cls === 'Marksman') return role + '_RANGED';
  if (cls === 'Enchanter') return role + '_Mage';
  return role + '_' + cls;
}
const EARLY = {
  SUP_ENGAGE: ['Cherche l\'engage au niveau 2 quand ton ADC peut suivre', 'Ward la rivière ou le tri-bush avant 3:00 pour voir leur jungler', 'Laisse les sbires à ton ADC, occupe-toi du duo adverse'],
  SUP_ENCHANTER: ['Zone le carry ennemi', 'Boucliers et soins en réponse à leurs échanges', 'Roam avec ta jungle quand ta vague est en sécurité'],
  SUP_MAGE: ['Poke le duo adverse quand il s\'avance pour un sbire', 'Laisse les sbires à ton ADC : ne vole pas son or', 'Ward la rivière et garde du mana pour te défendre'],
  SUP_PICK: ['Cherche le pick aux niveaux 2-3 avec ton ADC', 'Laisse les sbires à ton ADC, joue dans les buissons', 'Roam mid quand leur jungler est montré de l\'autre côté'],
  ADC_MARKSMAN: ['Last hit prioritaire', 'Reste derrière ton support', 'Méfie-toi des engages de la botlane adverse'],
  ADC_MAGE: ['Last hit avec tes auto-attaques, garde tes sorts pour les échanges', 'Joue à la hauteur de ton support, pas devant', 'Méfie-toi des engages de la botlane adverse'],
  ADC_MELEE: ['Last hit prioritaire : tu n\'as pas la portée pour échanger souvent', 'All-in avec ton support quand leurs sorts sont en recharge', 'Recule dès que leur support cherche l\'engage'],
  TOP_Tank: ['Échanges courts dès le niveau 3', 'Pose des wards offensives', 'Aide ta jungle sur le crabe et les premiers objectifs'],
  TOP_Bruiser: ['Échange au niveau 1 si ton profil est fort tôt', 'Pousse la vague avant chaque retour', 'All-in quand ton pic de puissance arrive'],
  TOP_Mage: ['Poke à chaque fois qu\'il vient last-hit', 'Garde une ward dans la rivière : seul en lane, les ganks font mal', 'Gère ton mana : garde de quoi te dégager'],
  TOP_Assassin: ['Farm prudemment jusqu\'à ton premier objet', 'Punis chaque échange raté avec un all-in court', 'Ward la rivière : tu es fragile face aux ganks'],
  TOP_RANGED: ['Profite de ta portée : touche-le à chaque last hit', 'Garde une ward dans la rivière : seul en lane, les ganks font mal', 'Recule quand il a ses sorts d\'engage'],
  TOP_Specialist: ['Farm et échange quand ses sorts sont en recharge', 'Ward la rivière avant 3:00', 'Garde ta Téléportation ou ton Flash pour te sortir des ganks'],
  MID_Mage: ['Farm et poke quand c\'est possible', 'Pousse la vague puis roam mid / bot', 'Gère ton mana : garde de quoi te défendre'],
  MID_Assassin: ['Farm prudemment jusqu\'au niveau 6', 'Roam à la première occasion', 'Vise le carry le plus fragile'],
  MID_RANGED: ['Profite de ta portée : poke-le quand il vient last-hit', 'Pousse la vague avant de bouger sur la carte', 'Ward les deux flancs : les ganks mid arrivent des deux côtés'],
  MID_Tank: ['Survis à la lane et pousse la vague pour suivre ta jungle', 'Pose des wards offensives', 'Aide ta jungle sur le crabe et les premiers objectifs'],
  MID_Bruiser: ['Échange court quand il gaspille un sort', 'Pousse la vague avant chaque retour', 'All-in quand ton pic de puissance arrive'],
  MID_Specialist: ['Farm et échange quand ses sorts sont en recharge', 'Pousse la vague puis roam', 'Ward les deux flancs'],
};
function getEarlyAdvice(c, role, T) {
  if (role === 'JUNGLE') return [`Full clear terminé vers 3:00-3:20, puis crabe (${T.scuttle}) du côté où tes lanes ont la priorité`, 'Les buffs réapparaissent 5:00 après leur mort : note l\'heure', `Drake à ${T.dragon}, larves à ${T.grubs} : prépare la vision une minute avant`];
  const p = tipProfile(c, role);
  const list = [...(EARLY[p] || EARLY[role + '_Specialist'] || ['Farm safe', 'Joue les objectifs'])];
  // Contre-recette R3 : pas de conseil de mana pour un champion sans mana (partype de Data Dragon)
  const partype = (DATA.champs[c.id] || {}).partype;
  if (partype && partype !== 'Mana' && partype !== 'Mana ') {
    return list.map(t => /mana/i.test(t) ? t.replace(/Gère ton mana : garde de quoi/i, 'Garde un sort pour').replace(/ et garde du mana pour te défendre/i, ' et garde un sort pour te défendre') : t);
  }
  return list;
}
function getMidAdvice(c, allyTeam, T, role) {
  const winCond = getWinCondition(detectSynergies(allyTeam || []));
  // C10 : pas de Héraut pour l'ADC, un conseil de son poste à la place
  const obj = role === 'ADC' ? `Reste avec le groupe pour les drakes (${T.dragon}) et prends la vague bot avant chaque objectif` : role === 'SUPPORT' ? `Pose la vision une minute avant les drakes (${T.dragon}) et le Héraut (${T.herald})` : `Participe aux drakes et au Héraut (${T.herald})`;
  const generic = [`Condition de victoire : ${winCond}`, obj, role === 'SUPPORT' ? 'Accompagne ta jungle pour poser et nettoyer la vision' : 'Pousse ta vague avant chaque objectif'];
  if (c.powerSpike === 'mid') generic.unshift('C\'est ton pic de puissance : force les combats.');
  if (c.powerSpike === 'late') generic.unshift(role === 'SUPPORT' ? 'Évite les combats inutiles : ton équipe gagne en puissance.' : 'Farm et évite les combats inutiles, ton pic arrive.');
  if (c.powerSpike === 'early') generic.unshift('Prends les objectifs avant de perdre ton avance.');
  return generic.slice(0, 3);
}
const LATE_CLASS = {
  Tank: ['Engage les teamfights', 'Sois le premier à plonger', 'Protège tes carries sur le flanc'],
  Bruiser: ['Splitpush ou teamfight selon le score', 'Isole les carries ennemis', 'Reste utile en 5v5'],
  Mage: ['Reste en arrière en teamfight', 'Vise les groupes avec tes zones', 'Garde toujours Flash'],
  Assassin: ['Élimine le carry ennemi avant le combat', 'Utilise tes réinitialisations pour nettoyer', 'Attention au peel ennemi'],
  Marksman: ['Suis le focus de ton tank', 'Kite vers l\'arrière', 'Ne te mets jamais en avant'],
  Enchanter: ['Reste proche de ton carry', 'Priorité : boucliers et soins sur le carry', 'Garde tes contrôles pour les plongeurs'],
};
const LATE = {
  SUP_ENGAGE: ['Engage quand ton équipe peut suivre, pas avant', 'Ward devant le groupe avant chaque objectif', 'Garde un contrôle pour protéger ton ADC des plongeurs'],
  SUP_ENCHANTER: LATE_CLASS.Enchanter,
  SUP_MAGE: ['Reste derrière ta frontline et poke avant le combat', 'Garde tes contrôles pour les plongeurs', 'Pose la vision avec ta jungle avant le Baron'],
  SUP_PICK: ['Cherche les picks avec de la vision avant les objectifs', 'Ne pars pas seul sans ta jungle', 'Protège ton ADC quand le combat commence'],
  ADC_MAGE: ['Reste en arrière en teamfight', 'Vise les groupes avec tes sorts', 'Garde toujours Flash'],
  ADC_MELEE: ['Entre dans le combat après les contrôles de ton équipe', 'Garde un sort de mobilité pour sortir', 'Ne lance pas le combat seul'],
  TOP_RANGED: ['Splitpush quand ton équipe tient le milieu', 'Reste à distance en teamfight', 'Ne te mets jamais en avant sans vision'],
  MID_RANGED: ['Reste à distance en teamfight', 'Suis le focus de ton tank', 'Ne te mets jamais en avant sans vision'],
};
function getLateAdvice(c, role) {
  const p = tipProfile(c, role || 'MID');
  if (LATE[p]) return [...LATE[p]];
  return [...(LATE_CLASS[c.class] || ['Joue les objectifs', `Force le Baron quand tu as l'avantage numérique`, 'Ne meurs pas gratuitement'])];
}
const PUSHY = /pousse|pression|prends l'avantage|agressi|prends la main|plaques/i;
const SAFE = /survis|farm près|farm prudemment|sécurité|joue safe|farm calmement/i;
// Un seul plan : pas de conseils opposés affichés ensemble (recette 2 n° 4)
function coherentPlan(list, tone) {
  const out = []; let side = tone === 'aggro' ? 'push' : tone === 'safe' ? 'safe' : null;
  for (const t of list) {
    const k = PUSHY.test(t) && !SAFE.test(t) ? 'push' : SAFE.test(t) && !PUSHY.test(t) ? 'safe' : null;
    if (k) { if (!side) side = k; if (k !== side) continue; }
    out.push(t);
  }
  return out;
}
function getLaneAdvice(ally, enemy, role, build) {
  const m = analyzeLaneMatchup(ally, enemy, role);
  if (!m) return ['Joue safe, farm et attends les opportunités'];
  const adv = m.advantage === 'ally' ? '✅ Tu as l\'avantage' : m.advantage === 'enemy' ? '⚠️ Tu es désavantagé' : '⚖️ Matchup neutre';
  const tone = !m.measured ? null : m.advantage === 'ally' ? 'aggro' : m.advantage === 'enemy' ? 'safe' : 'even';
  const losing = m.advantage === 'enemy';
  // Contre-recette R1 : jamais d'all-in conseillé dans un duel perdant
  const AGGRO = /all-in|cherche le kill|force le fight/i;
  const advice = losing && AGGRO.test(m.advice || '') ? 'Joue les échanges courts et attends ta jungle avant de t\'engager' : m.advice;
  const out = [`${adv} : ${m.reason}`, `Timing clé : ${m.timing}`, advice];
  const rng = c => ((DATA.champs[c.id] || {}).stats || {}).attackrange >= 300;
  // Contre-recette R2 : au support, la cible des échanges est l'ADC adverse qui last-hit, pas le support
  if (role === 'SUPPORT') {
    if (rng(ally) && !rng(enemy)) out.push(`Tu as la portée : poke l'ADC adverse quand il vient last-hit, recule quand ${enemy.name} s'avance`);
    else if (!rng(ally) && rng(enemy)) out.push(`${enemy.name} a la portée : reste derrière tes sbires et engage quand il a gaspillé un sort`);
  } else if (rng(ally) && !rng(enemy)) out.push(`Tu as la portée : touche ${enemy.name} quand il vient last-hit`);
  else if (!rng(ally) && rng(enemy)) out.push(`${enemy.name} a la portée : farm prudemment et engage quand il a gaspillé un sort`);
  // Téléportation : seulement si le build la prend (C3)
  if (role === 'TOP' && build) {
    if (build.spellIds.includes(12)) out.push('Garde ta Téléportation pour un drake ou un gank');
    else if (build.spellIds.includes(6)) out.push(losing ? 'Garde ton Fantôme pour fuir un gank ou te replacer en combat' : 'Garde ton Fantôme pour un all-in ou une poursuite');
    else if (build.spellIds.includes(14)) out.push(losing ? 'Embrasement : garde-le pour punir une erreur ou couper ses soins, ne force pas le kill' : 'Embrasement : cherche le kill aux niveaux 2-3 (il réduit aussi ses soins)');
  }
  return coherentPlan(out, tone);
}
// Jungler adverse choisi : sa note (meta.junglers) et le duel de jungle mesuré, sans conseil de laner
function jungleDuel(me, enemy) {
  const out = [];
  const jp = meta().junglers[enemy.id];
  if (jp) out.push(`${enemy.name} : ${jp.note}`);
  const m = analyzeLaneMatchup(me, enemy, 'JUNGLE');
  if (m && m.measured) {
    const tip = m.advantage === 'ally' ? 'envahis sa jungle quand tes lanes ont la priorité'
      : m.advantage === 'enemy' ? 'évite les duels dans sa jungle, contre-ganke près de tes lanes'
      : 'suis ses ganks pour contre-ganker du bon côté';
    out.push(`${m.advantage === 'ally' ? '✅' : m.advantage === 'enemy' ? '⚠️' : '⚖️'} ${m.reason.replace(/^Duel/, 'Duel de jungle')} : ${tip}`);
  } else if (m) out.push(`Duel de jungle contre ${enemy.name} non mesuré (pas assez de parties) : suis ses ganks pour contre-ganker du bon côté`);
  return out;
}
// Aide de jungle (correction 13 et C9) : choisir la lane à ganker d'après le contrôle allié.
// Recette logique P1-2 : le jungler lui-même n'est jamais dans la liste
function jungleAdvice(me, allyTeam, T) {
  const allies = (allyTeam || []).filter(c => c && c.id !== (me && me.id));
  const ctrl = allies.filter(c => hasCC(c.id) || c.class === 'Tank');
  return [
    ctrl.length ? `Ganke en priorité les lanes avec du contrôle : ${ctrl.map(c => c.name).join(', ')}` : (allies.length ? 'Peu de contrôle allié : ganke la lane adverse sans échappatoire et sans Flash' : 'Ajoute tes alliés pour savoir quelle lane ganker'),
    `Crabe à ${T.scuttle} (à vérifier sur le patch en cours) si ta bot ou ta mid peut suivre`,
    `Drake à ${T.dragon}, larves à ${T.grubs}, Baron à ${T.baron}`,
  ];
}
const MISTAKES_CLASS = {
  Tank: ['Engager sans vision', 'Ne pas utiliser ses contrôles en teamfight', 'Se faire poke hors de portée'],
  Bruiser: ['All-in quand la jungle adverse est proche', 'Mourir pour un kill peu rentable', 'Ne pas splitpush quand tu as l\'avance'],
  Mage: ['Utiliser ses sorts seulement pour nettoyer la vague', 'Rester à portée quand on te roam', 'Pas de vision sur les flancs'],
  Assassin: ['All-in quand l\'ennemi a Flash', 'Négliger la vague pour roam', 'Mourir pour un kill non garanti'],
  Marksman: ['S\'avancer seul', 'Utiliser Flash en attaque', 'Mauvais placement en teamfight'],
  Enchanter: ['Utiliser Flash pour soigner', 'Coller le carry au point de ne plus warder', 'Négliger la vision'],
};
const MISTAKES = {
  SUP_ENGAGE: ['Engager quand ton ADC ne peut pas suivre', 'Engager sans vision', 'Oublier de warder avant les objectifs'],
  SUP_ENCHANTER: MISTAKES_CLASS.Enchanter,
  SUP_MAGE: ['Prendre les sbires de ton ADC', 'Gaspiller ton mana en poke avant un all-in adverse', 'Négliger la vision'],
  SUP_PICK: ['Partir en roam quand ton ADC est seul contre deux', 'Prendre les sbires de ton ADC', 'Chercher un pick sans vision'],
  ADC_MAGE: ['Gaspiller ses sorts sur les sbires au lieu d\'échanger', 'S\'avancer seul', 'Mauvais placement en teamfight'],
  ADC_MELEE: ['All-in sans ton support', 'Utiliser son sort de mobilité pour engager', 'Entrer dans le combat avant les contrôles de ton équipe'],
  TOP_RANGED: ['Avancer sans ward dans la rivière', 'Laisser le corps à corps arriver sur toi sans le punir', 'Mauvais placement en teamfight'],
  MID_RANGED: ['Avancer sans ward sur les flancs', 'Utiliser Flash en attaque', 'Mauvais placement en teamfight'],
};
function getCommonMistakes(c, build, role) {
  const p = tipProfile(c, role || 'MID');
  const out = [...(MISTAKES[p] || MISTAKES_CLASS[c.class] || ['Gérer son économie', 'Jouer les objectifs', 'Éviter les morts inutiles'])];
  if (build && build.spellIds.includes(12)) out.push('Utiliser ta Téléportation sans raison : garde-la pour un drake ou un gank');
  return out.slice(0, 4);
}
function legacyBuild(c) {
  const builds = {
    Tank: { starter: 'Bouclier de Doran', core: ['Égide solaire', 'Cotte épineuse', 'Plaque du mort'], situational: ['Armure de Warmog', 'Visage spirituel', 'Cœur gelé'] },
    Bruiser: { starter: 'Épée longue', core: ['Force de la trinité', 'Gage de Sterak', 'Couperet noir'], situational: ['Danse de la mort', 'Gueule de Malmortius', 'Présage de Randuin'] },
    Mage: { starter: 'Anneau de Doran', core: ['Tempête de Luden', 'Flamme-ombre', 'Coiffe de Rabadon'], situational: ['Bâton du vide', 'Sablier de Zhonya', 'Voile de la banshee'] },
    Assassin: { starter: 'Épée longue', core: ['Lame du collecteur', 'Lame de l\'ombre', 'Croc de serpent'], situational: ['Ange gardien', 'Gueule de Malmortius', 'Glaive sombre'] },
    Marksman: { starter: 'Lame de Doran', core: ['Tueur de krakens', 'Lame d\'infini', 'Salutations de Dominik'], situational: ['Rappel mortel', 'Ouragan de Runaan', 'Arc-bouclier immortel'] },
    Enchanter: { starter: 'Atlas mondial', core: ['Renouveau de pierre de lune', 'Bâton aqueux', 'Encensoir ardent'], situational: ['Rédemption', 'Bénédiction de Mikael', 'Médaillon de l\'Iron Solari'] },
  };
  return builds[c.class] || builds.Mage;
}
function legacyRunes(c) {
  const m = {
    Tank: { keystone: 'Poigne de l\'immortel', primary: 'Volonté', secondary: 'Sorcellerie', description: 'Sustain et échanges forts (indicatif)' },
    Bruiser: { keystone: 'Conquérant', primary: 'Précision', secondary: 'Volonté', description: 'Dégâts soutenus en combat long (indicatif)' },
    Mage: { keystone: 'Comète arcanique', primary: 'Sorcellerie', secondary: 'Domination', description: 'Burst ou poke selon le champion (indicatif)' },
    Assassin: { keystone: 'Électrocution', primary: 'Domination', secondary: 'Précision', description: 'Burst sur échange court (indicatif)' },
    Marksman: { keystone: 'Tempo mortel', primary: 'Précision', secondary: 'Sorcellerie', description: 'DPS en teamfight (indicatif)' },
    Enchanter: { keystone: 'Invocation d\'Aery', primary: 'Sorcellerie', secondary: 'Inspiration', description: 'Poke et soutien (indicatif)' },
  };
  return m[c.class] || m.Mage;
}
