import React, { useState, useMemo } from 'react';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { decodeShare, getPlayers, setPlayers, newId, getIdentity } from '@/lib/localStore';

const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };

// Import d'un joueur partagé par lien / QR : seul le pseudo est à saisir (demande d'Anthony)
export default function ImportProfileModal({ code, champions, onClose, onImported }) {
  const data = useMemo(() => decodeShare(code), [code]);
  const [name, setName] = useState(data?.name || '');

  const pools = useMemo(() => {
    if (!data) return null;
    const out = {};
    Object.entries(data.poolsIds).forEach(([r, ids]) => {
      out[r] = ids.map(id => champions.find(c => c.id === id)?.name).filter(Boolean);
    });
    return out;
  }, [data, champions]);

  const total = pools ? Object.values(pools).reduce((s, l) => s + l.length, 0) : 0;
  const isMe = !!data?.syncId && data.syncId === getIdentity().id;

  const handleImport = () => {
    if (!name.trim() || !pools || isMe) return;
    const list = getPlayers();
    // Même ami déjà ajouté : on le retrouve par son id de synchro, sinon par son pseudo
    const existing = (data.syncId && list.find(p => p.syncId === data.syncId))
      || list.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
    const extra = data.syncId ? { syncId: data.syncId, syncedAt: Date.now() } : {};
    if (existing) Object.assign(existing, { name: name.trim(), pools, imported: true }, extra);
    else list.push({ id: newId(), name: name.trim(), pools, imported: true, ...extra });
    setPlayers(list);
    window.dispatchEvent(new CustomEvent('friends-updated'));
    toast.success(`${name.trim()} ajouté à tes joueurs`);
    onImported?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background/95 rounded-2xl border border-border max-w-sm w-full p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h3 className="font-grotesk font-bold text-lg">Importer un joueur</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-all" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        {!data ? (
          <p className="text-sm text-red-lose">Ce lien de partage est invalide ou incomplet.</p>
        ) : isMe ? (
          <p className="text-sm text-muted-foreground">C'est ton propre lien de partage : envoie-le à tes amis pour qu'ils t'ajoutent.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Ce joueur partage son pool ({total} champion{total > 1 ? 's' : ''}). Choisis le pseudo sous lequel l'ajouter à ton équipe.</p>
            <p className="text-[11px] text-muted-foreground/80">{data.syncId
              ? 'Son pool se mettra à jour tout seul quand il le modifiera.'
              : "Ancien lien : c'est une copie de son pool. Pour la synchro automatique, demande-lui de te renvoyer son lien depuis la dernière version de l'app."}</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {Object.entries(pools).filter(([, l]) => l.length).map(([r, l]) => (
                <p key={r} className="text-xs"><span className="font-semibold text-primary">{ROLE_LABELS[r]} :</span> <span className="text-muted-foreground">{l.join(', ')}</span></p>
              ))}
            </div>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Pseudo du joueur" maxLength={24}
              className="w-full p-3 rounded-lg bg-secondary border border-border text-sm"
            />
            <button onClick={handleImport} disabled={!name.trim()} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground disabled:opacity-50">
              <UserPlus className="w-4 h-4" /> Ajouter à mes joueurs
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full bg-secondary text-foreground py-2 rounded-lg font-semibold text-sm">Fermer</button>
      </div>
    </div>
  );
}
