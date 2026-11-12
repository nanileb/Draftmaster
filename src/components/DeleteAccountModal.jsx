import React, { useState } from 'react';
import { AlertTriangle, X, Trash2, Loader2 } from 'lucide-react';
import { clearAll } from '@/lib/localStore';

export default function DeleteAccountModal({ onClose }) {
  const [step, setStep] = useState(1); // 1 = confirm, 2 = deleting, 3 = done
  const [error, setError] = useState(null);

  const handleDelete = () => {
    setStep(2);
    setError(null);
    try {
      // Pas de compte : on efface les données gardées dans ce navigateur
      clearAll();
      try { Object.keys(localStorage).filter(k => k.startsWith('dm_') || k.startsWith('draftmaster_')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* rien */ }
      setStep(3);
      setTimeout(() => { window.location.href = (import.meta.env.BASE_URL || '/') + 'home'; }, 1500);
    } catch (err) {
      setError("Une erreur s'est produite. Veuillez réessayer.");
      setStep(1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70" onClick={step === 1 ? onClose : undefined}>
      <div
        className="w-full max-w-md bg-card rounded-t-2xl p-6 pb-10 animate-slide-up space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {step === 3 ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <Trash2 className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <p className="font-grotesk font-bold text-lg">Données effacées</p>
              <p className="text-sm text-muted-foreground mt-1">L'application va redémarrer…</p>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="w-8 h-8 text-destructive animate-spin" />
            <p className="text-sm text-muted-foreground">Suppression en cours…</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-grotesk font-bold text-base">Effacer mes données locales</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cette action est irréversible. Tout ce que DraftMaster garde dans ce navigateur (pool, joueurs, amis importés, réglages) sera effacé. Rien n'est stocké ailleurs.
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary -mt-1 -mr-1" aria-label="Fermer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Effacer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}