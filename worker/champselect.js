// [ajout DraftMaster] Sélection des champions lue sur le PC (compagnon DraftMaster PC) et relayée au téléphone.
// Le compagnon envoie tel quel ce que le client League affiche (/lol-champ-select/v1/session) ;
// on n'en garde ici que ce dont l'application a besoin : bans, picks (survolés / verrouillés) et postes.
// Aucun pseudo, aucun identifiant de joueur n'est gardé.

const POS = { top: 'TOP', jungle: 'JUNGLE', middle: 'MID', mid: 'MID', bottom: 'ADC', bot: 'ADC', utility: 'SUPPORT', support: 'SUPPORT' };
const num = x => (Number.isInteger(x) && x > 0 && x < 100000 ? x : 0);
const PHASES = ['Closed', 'None', 'Lobby', 'Matchmaking', 'CheckedIntoTournament', 'ReadyCheck', 'ChampSelect', 'GameStart', 'FailedToLaunch', 'InProgress', 'Reconnect', 'WaitingForStats', 'PreEndOfGame', 'EndOfGame', 'TerminatedInError'];

export function cleanPhase(p) { return PHASES.includes(p) ? p : 'None'; }

// session : objet renvoyé par le client League ; null si pas de sélection en cours
export function compactSession(session) {
  if (!session || typeof session !== 'object' || !Array.isArray(session.myTeam)) return null;
  const actions = (Array.isArray(session.actions) ? session.actions : []).flat().filter(a => a && typeof a === 'object');
  const picks = {}; // cellId → { c, lock }
  const bans = { ally: [], enemy: [] };
  actions.forEach(a => {
    const cell = Number(a.actorCellId), c = num(a.championId);
    if (a.type === 'pick') {
      // Plusieurs actions de pick pour une même case (rare) : la dernière remplie l'emporte
      if (c) picks[cell] = { c, lock: !!a.completed };
    } else if (a.type === 'ban' && a.completed && c) {
      const side = a.isAllyAction ? bans.ally : bans.enemy;
      if (!side.includes(c)) side.push(c);
    }
  });
  // Ancien format (sans actions détaillées pour les bans)
  const sb = session.bans || {};
  (sb.myTeamBans || []).forEach(x => { const c = num(x); if (c && !bans.ally.includes(c)) bans.ally.push(c); });
  (sb.theirTeamBans || []).forEach(x => { const c = num(x); if (c && !bans.enemy.includes(c)) bans.enemy.push(c); });

  const me = Number(session.localPlayerCellId);
  const member = (m, ally) => {
    const cell = Number(m.cellId);
    const p = picks[cell];
    const shown = num(m.championId);
    // Verrouillé : action de pick terminée ; sans actions (partie normale à l'aveugle, etc.), le champion affiché compte
    let c = 0, lock = false;
    if (p) { c = p.c; lock = p.lock; } else if (shown) { c = shown; lock = !actions.some(a => a.type === 'pick' && Number(a.actorCellId) === cell); }
    const o = { cell, pos: POS[String(m.assignedPosition || '').toLowerCase()] || null, c: c || null, lock: !!(lock && c) };
    // Intention affichée pendant la phase de préparation (alliés seulement)
    if (ally && !o.lock) { const h = num(m.championPickIntent); if (h && !o.c) o.c = h; }
    if (ally && cell === me) o.me = true;
    return o;
  };
  const ally = session.myTeam.map(m => member(m, true));
  const enemy = (Array.isArray(session.theirTeam) ? session.theirTeam : []).map(m => member(m, false));
  const t = session.timer || {};
  const team = session.myTeam[0] && Number(session.myTeam[0].team);
  return {
    side: team === 1 ? 'blue' : team === 2 ? 'red' : null,
    step: typeof t.phase === 'string' ? t.phase.slice(0, 20) : null,
    bans, ally, enemy,
  };
}
