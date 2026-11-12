import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraft } from '@/lib/DraftContext';
import MatchupAssignment from '@/components/MatchupAssignment';

export default function MatchupRoute() {
  const navigate = useNavigate();
  const draft = useDraft();

  if (!draft.selectedRole) {
    navigate('/home', { replace: true });
    return null;
  }

  return (
    <MatchupAssignment
      enemyTeam={draft.enemyTeam}
      enemyByRole={draft.enemyByRole}
      allyByRole={draft.allyByRole}
      myChampion={draft.myChampion}
      onSetEnemyRole={draft.setEnemyRole}
      onSwapEnemyRoles={draft.swapEnemyRoles}
      onSwapAllyRoles={draft.swapAllyRoles}
      onGoToTips={() => navigate('/home/tips')}
      onBack={() => navigate(-1)}
    />
  );
}
