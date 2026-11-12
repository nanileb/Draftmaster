import React, { useState } from 'react';
import { Users, X } from 'lucide-react';
import ImportProfileModal from '@/components/ImportProfileModal';

// Ajout d'un ami sans compte : on colle le lien (ou le code) qu'il a partagé depuis son profil.
export default function AddFriendModal({ onClose, onFriendAdded, champions = [] }) {
  const [value, setValue] = useState('');
  const [code, setCode] = useState(null);
  const [error, setError] = useState('');

  const handleNext = () => {
    const v = value.trim();
    const m = v.match(/[?&]add=([A-Za-z0-9_-]+)/);
    const c = m ? m[1] : v;
    if (!/^[A-Za-z0-9_-]{10,}$/.test(c)) { setError('Colle le lien de partage complet de ton ami.'); return; }
    setError(''); setCode(c);
  };

  if (code) return <ImportProfileModal code={code} champions={champions} onClose={onClose} onImported={() => { onFriendAdded?.(); onClose(); }} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background/95 rounded-2xl border border-border max-w-sm w-full p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h3 className="font-grotesk font-bold text-lg">Ajouter un ami</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-all" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground">Demande à ton ami d'ouvrir DraftMaster › bouton Partager (en haut de l'accueil). Il t'envoie un lien ou te montre un QR code : scanne-le avec l'appareil photo, ou colle le lien ici.</p>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-semibold">Lien de partage de l'ami :</label>
          <textarea value={value} onChange={e => setValue(e.target.value)} rows={3} placeholder="https://…/draftmaster/home?add=…"
            className="w-full p-3 rounded-lg bg-secondary border border-border text-xs font-mono" />
          <button onClick={handleNext} disabled={!value.trim()} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground disabled:opacity-50">
            <Users className="w-4 h-4" /> Continuer
          </button>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        </div>
        <button onClick={onClose} className="w-full bg-secondary text-foreground py-2 rounded-lg font-semibold text-sm">Fermer</button>
      </div>
    </div>
  );
}
