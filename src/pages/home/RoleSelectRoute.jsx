import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraft } from '@/lib/DraftContext';
import RoleSelect from '@/pages/RoleSelect';
import ImportProfileModal from '@/components/ImportProfileModal';

export default function RoleSelectRoute({ champions, version, addParam }) {
  const navigate = useNavigate();
  const draft = useDraft();
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
        onShowTeamOptimization={() => navigate('/team')}
        userPool={draft.userPool}
        champions={champions}
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
