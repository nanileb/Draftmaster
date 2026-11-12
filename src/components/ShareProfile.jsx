import React, { useState, useEffect } from 'react';
import { Share2, Copy, X, Link as LinkIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { encodeShare, shareUrl, getProfile, setProfile } from '@/lib/localStore';

// Partage du profil sans compte : un lien (et son QR code) qui contient le pool.
// Celui qui l'ouvre ajoute le joueur et son pool à son équipe (il ne saisit qu'un pseudo).
export default function ShareProfile({ userPool = [] }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState(() => getProfile().name || '');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const count = userPool.reduce((s, e) => s + Object.keys(e.roles || {}).length, 0);
  const url = shareUrl(encodeShare(name, userPool));

  useEffect(() => {
    if (!showModal) return;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#0d0d18', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [showModal, url]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success('Lien copié !'); setTimeout(() => setCopied(false), 2000); }
    catch (e) { toast.error('Copie impossible : sélectionne le lien à la main'); }
  };
  const handleShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Mon pool DraftMaster', text: 'Ajoute mon pool de champions dans DraftMaster', url }); } catch (e) { /* annulé */ } }
    else handleCopy();
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="w-10 h-10 rounded-full glass-strong border border-border flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          title="Partager le profil" aria-label="Partager le profil"
        >
          <Share2 className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-background/95 rounded-2xl border border-border max-w-sm w-full p-6 space-y-4 animate-fade-in max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-grotesk font-bold text-lg">Partager ton profil</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-secondary transition-all" aria-label="Fermer"><X className="w-5 h-5" /></button>
            </div>
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">Ton pool est vide : ajoute tes champions dans Profil › Mon Pool pour pouvoir le partager.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-semibold">Ton pseudo (proposé à ton ami)</label>
                  <input value={name} maxLength={24} onChange={e => { setName(e.target.value); setProfile({ ...getProfile(), name: e.target.value }); }}
                    placeholder="Pseudo" className="w-full p-2.5 rounded-lg bg-secondary border border-border text-sm" />
                </div>
                <p className="text-xs text-muted-foreground text-center">Ton ami ouvre le lien, ou scanne le QR code ci-dessous avec l'appareil photo de son téléphone : ton pool ({count} champion{count > 1 ? 's' : ''}) s'ajoute à ses joueurs.</p>
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-mono break-all text-primary selectable max-h-16 overflow-y-auto">{url}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleCopy} className={cn('py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2', copied ? 'bg-green-win text-white' : 'bg-secondary text-foreground')}>
                    <Copy className="w-4 h-4" />{copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button onClick={handleShare} className="py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground">
                    <LinkIcon className="w-4 h-4" />Partager
                  </button>
                </div>
                {/* QR code sous le bouton de partage (demande d'origine) */}
                {qr && <img src={qr} alt="QR code du lien de partage" className="mx-auto rounded-xl border border-border w-48 h-48" />}
                <p className="text-[10px] text-muted-foreground/70 text-center">Le lien contient une copie de ton pool à cet instant : renvoie-le si ton pool change.</p>
              </>
            )}
            <button onClick={() => setShowModal(false)} className="w-full bg-secondary text-foreground py-2 rounded-lg font-semibold text-sm">Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}
