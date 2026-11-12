import React, { useMemo } from 'react';
import { ArrowLeft, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import GameTipsPanel from '@/components/GameTipsPanel';
import DraftScoreBar from '@/components/DraftScoreBar';
import { useGameClock } from '@/components/ingame/useGameClock';
import { fmt, ROLE_ORDER } from '@/lib/inGame';

// Vis-à-vis par rôle : qui affronte qui en lane
const LANE_OPPONENTS = {
  TOP:     ['TOP'],
  JUNGLE:  ['JUNGLE'],
  MID:     ['MID'],
  ADC:     ['ADC', 'SUPPORT'],
  SUPPORT: ['ADC', 'SUPPORT'],
};
const ALERT_TONE = { ward: 'bg-accent text-accent-foreground', obj: 'bg-gold text-[#2b1d02]', danger: 'bg-red-lose text-white', lane: 'bg-blue-info text-white' };

export default function TipsPage({
  myChampion,
  selectedRole,
  allyTeam,
  enemyTeam,
  allyByRole = {},
  enemyByRole,
  draftScore,
  winProbability,
  scoreInfo,
  userPool,
  side = 'blue',
  setSide,
  timerStart = null,
  setTimerStart,
  kills,
  setKills,
  onBack,
  onReset,
}) {
  const opponentRoles = LANE_OPPONENTS[selectedRole] || [selectedRole];
  const laneOpponents = opponentRoles
    .map(role => enemyByRole?.[role] ? { ...enemyByRole[role], _role: role } : null)
    .filter(Boolean);

  // Partie au format du coach (ids Data Dragon par poste)
  const match = useMemo(() => {
    const ids = o => Object.fromEntries(ROLE_ORDER.map(r => [r, o && o[r] ? o[r].id : null]));
    const ally = ids(allyByRole);
    if (myChampion) ally[selectedRole] = myChampion.id;
    return { role: selectedRole, me: myChampion ? myChampion.id : null, ally, enemy: ids(enemyByRole), side, kills: kills || { drakes: [], soul: null } };
  }, [allyByRole, enemyByRole, myChampion, selectedRole, side, kills]);

  const clock = useGameClock(match, timerStart, setTimerStart || (() => { }));
  const a = clock.alert;

  return (
    <div className="flex flex-col min-h-screen" onPointerDown={clock.unlockAudio}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-lg z-10" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}>
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target flex items-center justify-center" aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-grotesk font-semibold text-sm">
          Conseils de jeu{clock.t != null && <span className="ml-2 text-primary tabular-nums">{fmt(clock.t)}</span>}
        </span>
        <button
          onClick={onReset}
          aria-label="Nouvelle draft"
          className="p-2 rounded-full hover:bg-secondary text-muted-foreground tap-target flex items-center justify-center"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Alerte de la chronologie */}
      {a && (
        <div role="alert" className={cn('fixed z-50 left-3 right-3 max-w-md mx-auto rounded-xl px-4 py-3 shadow-2xl flex gap-3 items-start animate-slide-up', ALERT_TONE[a.kind])}
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
          <div className="min-w-0 flex-1">
            <p className="font-grotesk font-bold text-base leading-tight">{fmt(a.t)} · {a.title}</p>
            <p className="text-sm opacity-90 mt-0.5">{a.text}</p>
          </div>
          <button type="button" onClick={clock.dismiss} aria-label="Fermer l'alerte" className="shrink-0 w-9 h-9 grid place-items-center rounded-lg bg-black/15"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 px-4 py-4 space-y-4" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <DraftScoreBar
          score={draftScore}
          winProbability={winProbability}
          scoreInfo={scoreInfo}
        />

        {myChampion ? (
          <GameTipsPanel
            champion={myChampion}
            selectedRole={selectedRole}
            laneOpponents={laneOpponents}
            allyTeam={allyTeam}
            enemyTeam={enemyTeam}
            userPool={userPool}
            match={match}
            clock={clock}
            side={side}
            setSide={setSide}
            kills={kills}
            setKills={setKills}
          />
        ) : (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">Aucun champion sélectionné.</p>
            <button onClick={onBack} className="mt-4 text-primary text-sm font-medium">
              Retour au draft
            </button>
          </div>
        )}

        <button
          onClick={onReset}
          className="w-full py-4 rounded-2xl border-2 border-border text-muted-foreground font-grotesk font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:border-primary hover:text-primary"
        >
          <RotateCcw className="w-4 h-4" />
          Nouvelle Draft
        </button>
      </div>
    </div>
  );
}
