import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraft } from '@/lib/DraftContext';
import RoleSelect from '@/pages/RoleSelect';
import ImportProfileModal from '@/components/ImportProfileModal';
import LiveGameButton from '@/components/ingame/LiveGameButton';
import { Play } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/championEngine';
import { usePcLink } from '@/lib/pcLink';

export default function RoleSelectRoute({ champions, version, addParam }) {
  const navigate = useNavigate();
  const draft = useDraft();
  // PC relié : dans le client sans sélection ni partie en cours, l'ancienne draft n'est plus d'actualité
  const pc = usePcLink();
  const inClient = pc.status === 'idle';
  // Lien ou QR de partage : …/home?add=CODE → import du joueur et de son pool (pseudo à saisir)
  const [importCode, setImportCode] = useState(addParam || null);

  const handleSelectRole = (role) => {
    draft.selectRole(role);
    navigate('/home/draft');
  };

  return (
    <>
      <RoleSelect
        onSelectRole={handleSelectRole}
        championCount={champions.length}
        version={version}
        onShowBestDrafts={() => navigate('/home/best-drafts')}
        onShowPatchNotes={() => navigate('/home/patch')}
        onShowTeamOptimization={() => navigate('/team')}
        userPool={draft.userPool}
        champions={champions}
        liveSlot={(
          <>
            {!inClient && draft.selectedRole && (draft.myChampion || draft.allyTeam.length > 0 || draft.enemyTeam.length > 0 || draft.bans.length > 0) && (
              <button
                type="button"
                onClick={() => navigate(draft.myChampion && draft.enemyTeam.length ? '/home/tips' : '/home/draft')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-grotesk font-bold text-sm glow-primary active:scale-[0.98] transition-all"
              >
                <Play className="w-4 h-4" />
                Reprendre : {draft.myChampion ? draft.myChampion.name + ' · ' : 'draft · '}{ROLE_LABELS[draft.selectedRole]}
              </button>
            )}
            <LiveGameButton champions={champions} compact />
          </>
        )}
      />
      {importCode && (
        <ImportProfileModal
          code={importCode}
          champions={champions}
          onClose={() => { setImportCode(null); navigate('/home', { replace: true }); }}
          onImported={() => { setImportCode(null); navigate('/team', { replace: true }); }}
        />
      )}
    </>
  );
}
