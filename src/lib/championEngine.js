// ============================================================
// CHAMPION ENGINE — logique de draft de DraftMaster
// Version autonome (hors Base44) : les classements, duels, builds et taux de victoire
// viennent des données réelles partagées avec le Coach Support (voir gameData.js).
// Les règles par classe d'origine ne servent plus qu'à défaut de données, et le disent.
// ============================================================
import {
  DATA, ROLES as R5, BUILD, meta, cname, tags, isAP, isEngager, isFront, isAssassin, isHealer,
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

export function calculateDraftScore(allyTeam, enemyTeam, allyByRole, enemyByRole) {
  if (!allyTeam || allyTeam.length === 0) return 50;
  let score = 50;
  const ids = allyTeam.map(c => c.id);
  const ap = ids.filter(id => isAP(id)).length, ad = ids.length - ap;
  if (ap >= 1 && ad >= 1) score += 10;
  if (allyTeam.length >= 3 && (ap === 0 || ad === 0)) score -= 8;
  const eng = ids.filter(isEngager).length;
  if (eng >= 1) score += 8; if (eng >= 2) score += 5;
  if (ids.some(isFront)) score += 5;
  if (allyTeam.some(c => c.class === 'Enchanter') || ids.some(id => (meta().supports[id] || {}).peel >= 3)) score += 6;
  if (allyTeam.filter(c => c.powerSpike === 'late').length >= 2) score += 5;
  const avgDifficulty = allyTeam.reduce((s, c) => s + (c.difficulty || 5), 0) / allyTeam.length;
  if (avgDifficulty > 7) score -= 8; else if (avgDifficulty < 4) score += 5;
  score += Math.min(3, detectSynergies(allyTeam).length) * 3;
  // Avantage mesuré (taux de victoire réels, duels de lane) : ±8 points de victoire estimée = ±12 points de score
  if (allyByRole) {
    const est = teamEstimate(toIds(allyByRole), toIds(enemyByRole));
    score += clamp(est.delta, -8, 8) * 1.5;
  }
  return Math.max(10, Math.min(100, Math.round(score)));
}

export function getDraftScoreLabel(score) {
  if (score >= 80) return { label: 'Excellente', color: 'text-green-win' };
  if (score >= 60) return { label: 'Équilibrée', color: 'text-gold' };
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
  const alternatives = list.slice(1, 5);
  const risky = scored.filter(c => {
    if (c.blind) return true;
    const duel = (c.parts || []).find(p => /\(duel\)/.test(p[1]));
    if (duel && duel[0] <= -2) return true;
    return c.recommendScore <= 46 && (c.isInPool || c.est);
  }).filter(c => c.id !== best?.id).slice(0, 3).map(c => ({ ...c, riskReason: c.blind ? 'Risque de contre-pick : ton adversaire choisit après toi' : riskText(c) }));
  return { best, alternatives, risky };
}
function shortReason(txt, v) {
  const m = txt.match(/^(\d+(?:[.,]\d+)?) % contre (.+?) \(duel\)/);
  if (m) return v > 0 ? `gagne contre ${m[2]} (${m[1]} %)` : `⚠️ difficile contre ${m[2]} (${m[1]} %)`;
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
  const src = d.source === 'counters' ? `${DATA.cnt.source}, ${DATA.cnt.rank}` : 'Challenger / GM / Master';
  if (d.wr != null) {
    const adv = d.wr >= 53 ? 'ally' : d.wr <= 47 ? 'enemy' : 'neutral';
    const reason = adv === 'ally' ? `Duel favorable : ${d.wr} % de victoires (${d.n} parties, ${src})`
      : adv === 'enemy' ? `Duel difficile : ${d.wr} % de victoires (${d.n} parties, ${src})`
      : `Duel équilibré : ${d.wr} % de victoires (${d.n} parties, ${src})`;
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
    return { advantage: adv, reason, timing, advice, wr: d.wr, n: d.n, measured: true };
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
    n: enIds.length, ap, ad, heal: enIds.filter(isHealer).length, tank: enIds.filter(isFront).length, cc: enIds.filter(isEngager).length,
    adBurst: ass.length && assAD >= assAP, apBurst: ass.length && assAP >= assAD,
  };
}
function fitsThreat(item, F) {
  if (ANTIHEAL.includes(item) && !(F.heal >= 1)) return false;
  if (item === '3222' && !(F.cc >= 3)) return false;
  if (hasMR(item) && !hasArmor(item) && !isOffAP(item) && !isOffAD(item) && F.ap < 2 && !F.apBurst) return false;
  if (hasArmor(item) && !hasMR(item) && !isOffAP(item) && !isOffAD(item) && F.ad < 2 && !F.adBurst) return false;
  return true;
}

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
  const offAP = core.some(isOffAP), offAD = core.some(isOffAD);
  const sameVariant = id => (offAP && !offAD && isOffAD(id) && !isOffAP(id)) || (offAD && !offAP && isOffAP(id) && !isOffAD(id)) ? false : true;
  const situational = new Set(Object.values(b.vs || {}).flat().map(x => String(x[0])));
  // Compléter jusqu'à 4 objets avec le pool, sans objet de situation (correction 3)
  for (const [id] of (b.pool || [])) {
    if (core.length >= 4) break;
    const s = String(id);
    if (situational.has(s) || s === '3026' || !sameVariant(s) || !fitsThreat(s, F) || !can(s)) continue;
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
  const mid = getMidAdvice(champion, allyTeam, T, r);
  const late = getLateAdvice(champion);
  const lane = enemyLaner ? getLaneAdvice(champion, enemyLaner, r, build) : (r === 'JUNGLE' ? jungleAdvice(allyTeam, T) : ['Joue safe, farm et attends les opportunités']);
  return {
    early, mid, late, lane,
    build: build ? {
      starter: Object.entries(build.start.reduce((o, x) => { o[x] = (o[x] || 0) + 1; return o; }, {})).map(([x, n]) => (n > 1 ? n + ' × ' : '') + iname(x)).join(' + ') || '—',
      core: [...build.core.map(iname), ...(build.boots ? [iname(build.boots)] : [])],
      situational: build.situational.map(x => `${iname(x.id)} (${x.why})`),
      ids: build, source: `Build le plus joué chez les meilleurs joueurs (${build.games} parties Challenger / GM / Master)`,
    } : { ...legacyBuild(champion), source: 'Pas assez de parties à ce poste : build type de la classe (indicatif)' },
    runes: build && build.runes ? { keystone: build.runes.keystone, primary: build.runes.primary, secondary: build.runes.secondary, description: [...build.runes.primaryRunes, ...build.runes.secondaryRunes].join(' · ') + (build.spells.length ? ` — Sorts : ${build.spells.join(' + ')}` : '') } : legacyRunes(champion),
    commonMistakes: getCommonMistakes(champion, build),
  };
}
function timersFR() {
  const t = meta().timers || {};
  return { scuttle: fmtTime(t.scuttle || 175), dragon: fmtTime(t.dragon || 300), grubs: fmtTime(t.grubs || 480), herald: fmtTime(t.herald || 900), baron: fmtTime(t.baron || 1200), plates: fmtTime(t.platesDecay ? t.platesDecay + 180 : 840) };
}
function getEarlyAdvice(c, role, T) {
  if (role === 'JUNGLE') return [`Full clear terminé vers 3:00-3:20, puis crabe (${T.scuttle}) du côté où tes lanes ont la priorité`, 'Les buffs réapparaissent 5:00 après leur mort : note l\'heure', `Drake à ${T.dragon}, larves à ${T.grubs} : prépare la vision une minute avant`];
  const map = {
    Tank: ['Échanges courts dès le niveau 3', 'Pose des wards offensives', 'Aide ta jungle sur le crabe et les premiers objectifs'],
    Bruiser: ['Échange au niveau 1 si ton profil est fort tôt', 'Pousse la vague avant chaque retour', 'All-in quand ton pic de puissance arrive'],
    Mage: ['Farm et poke quand c\'est possible', 'Pousse la vague puis roam mid / bot', 'Gère ton mana : garde de quoi te défendre'],
    Assassin: ['Farm prudemment jusqu\'au niveau 6', 'Roam à la première occasion', 'Vise le carry le plus fragile'],
    Marksman: ['Last hit prioritaire', 'Reste derrière ton support', 'Méfie-toi des engages de la botlane adverse'],
    Enchanter: ['Zone le carry ennemi', 'Boucliers et soins en réponse à leurs échanges', 'Roam avec ta jungle si ta vague est poussée'],
  };
  return map[c.class] || ['Farm safe', 'Joue les objectifs'];
}
function getMidAdvice(c, allyTeam, T, role) {
  const winCond = getWinCondition(detectSynergies(allyTeam || []));
  // C10 : pas de Héraut pour l'ADC, un conseil de son poste à la place
  const obj = role === 'ADC' ? `Reste avec le groupe pour les drakes (${T.dragon}) et prends la vague bot avant chaque objectif` : `Participe aux drakes et au Héraut (${T.herald})`;
  const generic = [`Condition de victoire : ${winCond}`, obj, 'Pousse ta vague avant chaque objectif'];
  if (c.powerSpike === 'mid') generic.unshift('C\'est ton pic de puissance : force les combats.');
  if (c.powerSpike === 'late') generic.unshift('Farm et évite les combats inutiles, ton pic arrive.');
  if (c.powerSpike === 'early') generic.unshift('Prends les objectifs avant de perdre ton avance.');
  return generic.slice(0, 3);
}
function getLateAdvice(c) {
  const map = {
    Tank: ['Engage les teamfights', 'Sois le premier à plonger', 'Protège tes carries sur le flanc'],
    Bruiser: ['Splitpush ou teamfight selon le score', 'Isole les carries ennemis', 'Reste utile en 5v5'],
    Mage: ['Reste en arrière en teamfight', 'Vise les groupes avec tes zones', 'Garde toujours Flash'],
    Assassin: ['Élimine le carry ennemi avant le combat', 'Utilise tes réinitialisations pour nettoyer', 'Attention au peel ennemi'],
    Marksman: ['Suis le focus de ton tank', 'Kite vers l\'arrière', 'Ne te mets jamais en avant'],
    Enchanter: ['Reste proche de ton carry', 'Priorité : boucliers et soins sur le carry', 'Garde tes contrôles pour les plongeurs'],
  };
  return map[c.class] || ['Joue les objectifs', `Force le Baron quand tu as l'avantage numérique`, 'Ne meurs pas gratuitement'];
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
  const out = [`${adv} : ${m.reason}`, `Timing clé : ${m.timing}`, m.advice];
  const rng = c => ((DATA.champs[c.id] || {}).stats || {}).attackrange >= 300;
  if (role !== 'JUNGLE') {
    if (rng(ally) && !rng(enemy)) out.push(`Tu as la portée : touche ${enemy.name} quand il vient last-hit`);
    else if (!rng(ally) && rng(enemy)) out.push(`${enemy.name} a la portée : farm prudemment et engage quand il a gaspillé un sort`);
  }
  // Téléportation : seulement si le build la prend (C3)
  if (role === 'TOP' && build) {
    if (build.spellIds.includes(12)) out.push('Garde ta Téléportation pour un drake ou un gank');
    else if (build.spellIds.includes(6)) out.push('Garde ton Fantôme pour un all-in ou une poursuite');
    else if (build.spellIds.includes(14)) out.push('Embrasement : cherche le kill aux niveaux 2-3 (il réduit aussi ses soins)');
  }
  const jp = meta().junglers[enemy.id];
  if (role === 'JUNGLE' && jp) out.push(`${enemy.name} : ${jp.note}`);
  return coherentPlan(out, tone);
}
// Aide de jungle (correction 13 et C9) : choisir la lane à ganker d'après le contrôle allié
function jungleAdvice(allyTeam, T) {
  const ctrl = (allyTeam || []).filter(c => isEngager(c.id) || c.class === 'Tank');
  return [
    ctrl.length ? `Ganke en priorité les lanes avec du contrôle : ${ctrl.map(c => c.name).join(', ')}` : ((allyTeam || []).length ? 'Peu de contrôle allié : ganke la lane adverse sans échappatoire et sans Flash' : 'Ajoute tes alliés pour savoir quelle lane ganker'),
    `Crabe à ${T.scuttle} (à vérifier sur le patch en cours) si ta bot ou ta mid peut suivre`,
    `Drake à ${T.dragon}, larves à ${T.grubs}, Baron à ${T.baron}`,
  ];
}
function getCommonMistakes(c, build) {
  const map = {
    Tank: ['Engager sans vision', 'Ne pas utiliser ses contrôles en teamfight', 'Se faire poke hors de portée'],
    Bruiser: ['All-in quand la jungle adverse est proche', 'Mourir pour un kill peu rentable', 'Ne pas splitpush quand tu as l\'avance'],
    Mage: ['Utiliser ses sorts seulement pour nettoyer la vague', 'Rester à portée quand on te roam', 'Pas de vision sur les flancs'],
    Assassin: ['All-in quand l\'ennemi a Flash', 'Négliger la vague pour roam', 'Mourir pour un kill non garanti'],
    Marksman: ['S\'avancer seul', 'Utiliser Flash en attaque', 'Mauvais placement en teamfight'],
    Enchanter: ['Utiliser Flash pour soigner', 'Coller le carry au point de ne plus warder', 'Négliger la vision'],
  };
  const out = [...(map[c.class] || ['Gérer son économie', 'Jouer les objectifs', 'Éviter les morts inutiles'])];
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
