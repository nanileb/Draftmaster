import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDraft } from '@/lib/DraftContext';
import { usePcLink, readSelection, startPcLink } from '@/lib/pcLink';
import { ROLE_LABELS } from '@/lib/championEngine';

// Draft solo de l'Accueil remplie depuis le PC relié. Rien à afficher : ce composant applique seulement les données.
// Nouvelle sélection : l'Accueil ouvre la draft au bon poste ; ailleurs, une notification propose de l'ouvrir
// (sauf dans l'onglet Équipe, où la draft d'équipe en direct reçoit les mêmes données).
const N_KEY = 'dm_pc_n';
const readN = () => { try { return Number(localStorage.getItem(N_KEY)) || 0; } catch (e) { return 0; } };
const writeN = (n) => { try { localStorage.setItem(N_KEY, String(n)); } catch (e) { /* rien */ } };

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
    draft.syncFromPc(sel, fresh);
    if (!fresh) return;
    writeN(sel.n);
    const p = path.current;
    if (p.startsWith('/team')) return;
    const where = sel.myRole ? `/home/draft` : '/home';
    const what = sel.myRole ? `Poste : ${ROLE_LABELS[sel.myRole]}` : 'Choisis ton poste : la draft se remplira toute seule.';
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
