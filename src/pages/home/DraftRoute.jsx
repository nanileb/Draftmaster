import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraft } from '@/lib/DraftContext';
import DraftPage from '@/pages/DraftPage';

export default function DraftRoute({ champions, version }) {
  const navigate = useNavigate();
  const draft = useDraft();

  if (!draft.selectedRole) {
    navigate('/home', { replace: true });
    return null;
  }

  return (
    <DraftPage
      champions={champions}
      selectedRole={draft.selectedRole}
      allyTeam={draft.allyTeam}
      enemyTeam={draft.enemyTeam}
      allyByRole={draft.allyByRole}
      enemyByRole={draft.enemyByRole}
      myChampion={draft.myChampion}
      recommendations={draft.recommendations}
      draftScore={draft.draftScore}
      winProbability={draft.winProbability}
      scoreInfo={draft.scoreInfo}
      allySynergies={draft.allySynergies}
      winCondition={draft.winCondition}
      userPool={draft.userPool}
      onBack={() => { draft.resetDraft(); navigate('/home', { replace: true }); }}
      onSetAllyRole={draft.setAllyRole}
      onRemoveAllyRole={draft.removeAllyRole}
      onAddEnemy={draft.addToEnemy}
      onRemoveEnemy={draft.removeFromEnemy}
      onSetMyPick={draft.setMyPick}
      onGoToMatchup={() => navigate('/home/matchup')}
      canGoToMatchup={draft.canGoToMatchup}
      version={version}
    />
  );
}