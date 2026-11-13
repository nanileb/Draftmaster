import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDraft } from '@/lib/DraftContext';
import { usePcLink, readSelection, startPcLink, appliedN as readN, markApplied as writeN } from '@/lib/pcLink';
import { ROLE_LABELS } from '@/lib/championEngine';

// Draft solo de l'Accueil remplie depuis le PC relié. Rien à afficher : ce composant applique seulement les données.
// Nouvelle sélection : l'Accueil ouvre la draft au bon poste ; ailleurs, une notification propose de l'ouvrir
// (sauf dans l'onglet Équipe, où la draft d'équipe en direct reçoit les mêmes données).
const hasTeamLive = () => { try { return !!localStorage.getItem('dm_team_live'); } catch (e) { return false; } };

export default function PcDraftSync({ champions }) {
  const { status, data } = usePcLink();
  const draft = useDraft();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const path = useRef(pathname); path.current = pathname;

  useEffect(() => { startPcLink(); }, []);

  useEffect(() => {
    if (status !== 'select' || !champions.length) return;
    const sel = readSelection(data, champions);
    if (!sel) return;
    const fresh = sel.n !== readN();
    const role = draft.syncFromPc(sel, fresh);
    if (!fresh) return;
    writeN(sel.n);
    const p = path.current;
    // Onglet Équipe : la draft d'équipe en direct reçoit les mêmes données (si elle est lancée)
    if (p.startsWith('/team') && hasTeamLive()) return;
    const where = role ? `/home/draft` : '/home';
    const what = role ? `Poste : ${ROLE_LABELS[role]}` : 'Choisis ton poste : la draft se remplira toute seule.';
    if (p.startsWith('/home')) {
      navigate(where, { replace: p !== '/home' });
      toast.success('Sélection des champions détectée sur le PC', { description: what });
    } else {
      toast('Sélection des champions détectée sur le PC', { description: what, action: { label: 'Ouvrir', onClick: () => navigate(where) }, duration: 10000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data, champions, draft.selectedRole]);

  return null;
}
