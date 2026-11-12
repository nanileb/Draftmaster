import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDraft } from '@/lib/DraftContext';
import { fetchLiveGame, getRiotId } from '@/lib/liveGame';
import { cname } from '@/lib/gameData';

// « Charger ma partie en cours » : équipes, postes devinés, côté de la carte et chrono, puis revalidation des postes
export default function LiveGameButton({ champions, role = null, className, compact = false }) {
  const draft = useDraft();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const riotId = getRiotId();

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const g = await fetchLiveGame(champions, role);
      draft.loadLiveGame(g);
      toast.success(`${g.me ? cname(g.me.id) : 'Partie'} · côté ${g.side === 'blue' ? 'bleu' : 'rouge'}${g.elapsed > 0 ? ' · chrono calé' : ''}`, { description: 'Vérifie le poste de chaque champion.' });
      navigate('/home/matchup');
    } catch (e) {
      setErr(e.message || 'Erreur inconnue.');
    } finally { setBusy(false); }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <button
        type="button"
        onClick={load}
        disabled={busy}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 text-primary font-grotesk font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-60',
          compact ? 'py-3' : 'py-3.5'
        )}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
        {busy ? 'Recherche de ta partie…' : 'Charger ma partie en cours'}
      </button>
      {err ? (
        <p className="text-xs text-red-lose text-center px-2">
          {err}{!riotId && <> <button type="button" className="underline" onClick={() => navigate('/profile')}>Ouvrir le profil</button></>}
        </p>
      ) : !compact && (
        <p className="text-[11px] text-muted-foreground text-center">{riotId ? `Compte : ${riotId}` : 'Ajoute ton Riot ID dans Profil pour l\'utiliser'}</p>
      )}
    </div>
  );
}
