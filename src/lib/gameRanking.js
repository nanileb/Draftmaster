// Classement des 10 joueurs d'une partie (1 = le plus utile, 10 = le moins utile).
// Chaque statistique est comparée à ce qu'on attend du poste (une vision de support n'est pas jugée comme celle d'un top),
// puis pondérée selon le poste : un ADC est surtout jugé sur ses dégâts et ses golds, un support sur la vision,
// la participation aux kills et l'aide apportée, un jungler sur la participation et les objectifs.

// Valeurs « normales » par poste (parties classées, niveau moyen). Au-dessus = mieux que la moyenne du poste.
const BASE = {
  TOP:     { kda: 2.4, kp: 0.45, dpm: 0.22, dmg: 0.24, gpm: 400, cspm: 7.0, vspm: 0.65, tank: 0.26, util: 0.30, obj: 0.40 },
  JUNGLE:  { kda: 3.0, kp: 0.62, dpm: 0.20, dmg: 0.18, gpm: 380, cspm: 5.6, vspm: 0.95, tank: 0.24, util: 0.35, obj: 0.80 },
  MIDDLE:  { kda: 2.8, kp: 0.55, dpm: 0.20, dmg: 0.27, gpm: 410, cspm: 7.4, vspm: 0.70, tank: 0.17, util: 0.30, obj: 0.40 },
  BOTTOM:  { kda: 3.0, kp: 0.55, dpm: 0.18, dmg: 0.28, gpm: 430, cspm: 7.8, vspm: 0.55, tank: 0.13, util: 0.15, obj: 0.45 },
  UTILITY: { kda: 3.0, kp: 0.62, dpm: 0.20, dmg: 0.10, gpm: 270, cspm: 1.0, vspm: 2.00, tank: 0.18, util: 1.00, obj: 0.40 },
};

// Poids de chaque statistique selon le poste (total 1)
const W = {
  TOP:     { kda: 0.14, kp: 0.10, dpm: 0.10, dmg: 0.18, gpm: 0.11, cspm: 0.10, vspm: 0.05, tank: 0.12, util: 0.02, obj: 0.08 },
  JUNGLE:  { kda: 0.14, kp: 0.18, dpm: 0.08, dmg: 0.12, gpm: 0.07, cspm: 0.06, vspm: 0.09, tank: 0.07, util: 0.03, obj: 0.16 },
  MIDDLE:  { kda: 0.16, kp: 0.14, dpm: 0.10, dmg: 0.22, gpm: 0.11, cspm: 0.11, vspm: 0.05, tank: 0.03, util: 0.02, obj: 0.06 },
  BOTTOM:  { kda: 0.16, kp: 0.12, dpm: 0.10, dmg: 0.24, gpm: 0.12, cspm: 0.13, vspm: 0.04, tank: 0.01, util: 0.01, obj: 0.07 },
  UTILITY: { kda: 0.12, kp: 0.19, dpm: 0.09, dmg: 0.05, gpm: 0.02, cspm: 0.00, vspm: 0.24, tank: 0.06, util: 0.18, obj: 0.05 },
};

// Mots affichés pour expliquer un classement
const LABEL = {
  kda: 'KDA', kp: 'participation aux kills', dpm: 'peu de morts', dmg: 'dégâts', gpm: 'golds', cspm: 'farm',
  vspm: 'vision', tank: 'encaisse les dégâts', util: 'soins, boucliers et contrôles', obj: 'objectifs',
};
const LABEL_BAD = { ...LABEL, dpm: 'trop de morts', tank: 'encaisse peu', util: 'peu de soutien' };

const POS = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MIDDLE', MID: 'MIDDLE', BOTTOM: 'BOTTOM', ADC: 'BOTTOM', UTILITY: 'UTILITY', SUPPORT: 'UTILITY' };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Écart à la normale en échelle log : 2 fois mieux = +1, 2 fois moins bien = -1 (borné pour qu'une seule stat ne décide pas tout)
const ratio = (v, b) => clamp(Math.log2(Math.max(v, 0.01) / Math.max(b, 0.01)), -1.5, 1.5);
const sum = (arr, f) => arr.reduce((s, p) => s + (f(p) || 0), 0);

// Poste d'un joueur ; si Riot ne l'a pas donné (rare), on le devine d'après son farm et sa vision
function position(p, min) {
  const r = POS[p.teamPosition];
  if (r) return r;
  const cspm = ((p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0)) / min;
  if ((p.neutralMinionsKilled || 0) / min > 3) return 'JUNGLE';
  if (cspm < 2.5) return 'UTILITY';
  return 'MIDDLE';
}

const objCount = p => {
  const c = p.challenges || {};
  return (c.dragonTakedowns || 0) + (c.riftHeraldTakedown || 0) + (c.voidMonsterKill || 0)
    + (p.baronKills || 0) * 2 + (p.turretTakedowns != null ? p.turretTakedowns : (p.turretKills || 0)) * 0.5;
};

// participants : tels que renvoyés par Riot (ou par le relais, route /match?lite=2), durée en secondes.
// Renvoie, dans l'ordre des participants, { rank, score (0 à 10), role, best: [..], worst: [..] }.
export function rankParticipants(participants, durationSec) {
  const ps = participants || [];
  if (ps.length < 2) return [];
  const min = Math.max(1, (durationSec || 0) / 60);
  const teams = {};
  ps.forEach(p => { (teams[p.teamId] = teams[p.teamId] || []).push(p); });
  const tot = {};
  Object.entries(teams).forEach(([t, list]) => {
    tot[t] = {
      kills: sum(list, p => p.kills), deaths: sum(list, p => p.deaths),
      dmg: sum(list, p => p.totalDamageDealtToChampions),
      taken: sum(list, p => (p.totalDamageTaken || 0) + (p.damageSelfMitigated || 0)),
      objMax: Math.max(...list.map(objCount)),
    };
  });

  const scored = ps.map(p => {
    const role = position(p, min), b = BASE[role], w = W[role], t = tot[p.teamId], ch = p.challenges || {};
    const cs = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
    const kp = ch.killParticipation != null ? ch.killParticipation : (t.kills ? ((p.kills || 0) + (p.assists || 0)) / t.kills : 0.5);
    // Soins et boucliers sur les alliés (400 par minute = 1) + secondes de contrôle infligées par minute
    const support = ((p.totalHealsOnTeammates || 0) + (p.totalDamageShieldedOnTeammates || 0)) / (400 * min) + (p.timeCCingOthers || 0) / min;
    const v = {
      kda: ((p.kills || 0) + (p.assists || 0)) / Math.max(1, p.deaths || 0),
      kp,
      // Part des morts de l'équipe : plus elle est basse, mieux c'est. On inverse le rapport pour que
      // ratio(v, b) = log2(part attendue / part réelle)
      dpm: t.deaths ? b.dpm * b.dpm / Math.max(0.03, (p.deaths || 0) / t.deaths) : b.dpm,
      dmg: ch.teamDamagePercentage != null ? ch.teamDamagePercentage : (t.dmg ? (p.totalDamageDealtToChampions || 0) / t.dmg : 0.2),
      gpm: (p.goldEarned || 0) / min,
      cspm: cs / min,
      vspm: (p.visionScore || 0) / min,
      tank: t.taken ? ((p.totalDamageTaken || 0) + (p.damageSelfMitigated || 0)) / t.taken : 0.2,
      util: support,
      obj: t.objMax ? objCount(p) / t.objMax : b.obj,
    };
    const parts = {};
    let s = 0;
    Object.keys(w).forEach(k => { if (!w[k]) return; parts[k] = ratio(v[k], b[k]); s += w[k] * parts[k]; });
    // Gagner compte un peu : les stats d'un vainqueur ont davantage servi
    s += p.win ? 0.12 : -0.04;
    // Statistiques les plus marquantes (pondérées) pour expliquer le classement
    const byImpact = Object.keys(parts).map(k => ({ k, i: parts[k] * w[k] }));
    const best = byImpact.filter(x => x.i > 0.03).sort((a, c) => c.i - a.i).slice(0, 2).map(x => LABEL[x.k]);
    const worst = byImpact.filter(x => x.i < -0.03).sort((a, c) => a.i - c.i).slice(0, 2).map(x => LABEL_BAD[x.k]);
    return { raw: s, role, best, worst };
  });

  const order = scored.map((x, i) => i).sort((a, c) => scored[c].raw - scored[a].raw);
  const out = scored.map(x => ({ score: Math.round(clamp(5 + x.raw * 6, 0, 10) * 10) / 10, role: x.role, best: x.best, worst: x.worst, rank: 0 }));
  order.forEach((idx, r) => { out[idx].rank = r + 1; });
  return out;
}
