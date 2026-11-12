import React from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import GameTipsPanel from '@/components/GameTipsPanel';
import DraftScoreBar from '@/components/DraftScoreBar';

// Vis-à-vis par rôle : qui affronte qui en lane
const LANE_OPPONENTS = {
  TOP:     ['TOP'],
  JUNGLE:  ['JUNGLE'],
  MID:     ['MID'],
  ADC:     ['ADC', 'SUPPORT'],
  SUPPORT: ['ADC', 'SUPPORT'],
};

export default function TipsPage({
  myChampion,
  selectedRole,
  allyTeam,
  enemyTeam,
  enemyByRole,
  draftScore,
  winProbability,
  scoreInfo,
  userPool,
  onBack,
  onReset,
}) {
  // Construire la liste des vis-à-vis selon le rôle
  const opponentRoles = LANE_OPPONENTS[selectedRole] || [selectedRole];
  const laneOpponents = opponentRoles
    .map(role => enemyByRole?.[role] ? { ...enemyByRole[role], _role: role } : null)
    .filter(Boolean);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-lg z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-grotesk font-semibold text-sm">Conseils de jeu</span>
        <button
          onClick={onReset}
          className="p-2 rounded-full hover:bg-secondary text-muted-foreground tap-target flex items-center justify-center"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe pb-10 space-y-4">
        {/* Score recap */}
        <DraftScoreBar
          score={draftScore}
          winProbability={winProbability}
          scoreInfo={scoreInfo}
        />

        {/* Tips */}
        {myChampion ? (
          <GameTipsPanel
            champion={myChampion}
            selectedRole={selectedRole}
            laneOpponents={laneOpponents}
            allyTeam={allyTeam}
            enemyTeam={enemyTeam}
            userPool={userPool}
          />
        ) : (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">Aucun champion sélectionné.</p>
            <button onClick={onBack} className="mt-4 text-primary text-sm font-medium">
              Retour au draft
            </button>
          </div>
        )}

        {/* New draft button */}
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