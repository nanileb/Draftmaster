import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraft } from '@/lib/DraftContext';
import TipsPage from '@/pages/TipsPage';

export default function TipsRoute() {
  const navigate = useNavigate();
  const draft = useDraft();

  if (!draft.selectedRole) {
    navigate('/home', { replace: true });
    return null;
  }

  return (
    <TipsPage
      myChampion={draft.myChampion}
      selectedRole={draft.selectedRole}
      allyTeam={draft.allyTeam}
      enemyTeam={draft.enemyTeam}
      enemyByRole={draft.enemyByRole}
      draftScore={draft.draftScore}
      winProbability={draft.winProbability}
      scoreInfo={draft.scoreInfo}
      userPool={draft.userPool}
      onBack={() => navigate(-1)}
      onReset={() => { draft.resetDraft(); navigate('/home', { replace: true }); }}
    />
  );
}