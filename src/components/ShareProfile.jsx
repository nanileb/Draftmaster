import React, { useState, useEffect } from 'react';
import { Share2, Copy, X, Link as LinkIcon, RefreshCw, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { encodeShare, shareUrl, getProfile, setProfile, getIdentity, exportIdentity, importIdentity } from '@/lib/localStore';
import { pushMyPool } from '@/lib/poolSync';

// Partage du profil sans compte : un lien (et son QR code) qui contient le pool et l'id de synchro.
// Celui qui l'ouvre ajoute le joueur et son pool à son équipe (il ne saisit qu'un pseudo) ;
// ensuite le pool se met à jour chez lui quand il change ici (relais, voir lib/poolSync.js).
export default function ShareProfile({ userPool = [] }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState(() => getProfile().name || '');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [sync, setSync] = useState('pending'); // pending | ok | unavailable
  const [showDevice, setShowDevice] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [syncId, setSyncId] = useState(() => getIdentity().id);

  const count = userPool.reduce((s, e) => s + Object.keys(e.roles || {}).length, 0);
  const url = shareUrl(encodeShare(name, userPool, syncId));

  // Ouvrir le partage active la synchro : le pool est envoyé au relais
  useEffect(() => {
    if (!showModal || count === 0) return;
    setSync('pending');
    pushMyPool({ force: true }).then(r => setSync(r === 'ok' ? 'ok' : 'unavailable'));
  }, [showModal, count, syncId]);

  const handleRecovery = () => {
    if (!importIdentity(recovery)) { toast.error('Code de récupération invalide'); return; }
    setSyncId(getIdentity().id); setRecovery(''); setShowDevice(false);
    toast.success('Ce téléphone reprend ton profil de partage');
  };

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
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-mono break-all text-primary selectable max-h-16 overflow-y-auto">{url}</div>
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
                <p className={cn('text-[11px] text-center flex items-center justify-center gap-1.5', sync === 'ok' ? 'text-green-win' : 'text-muted-foreground/70')}>
                  {sync === 'pending' && <><RefreshCw className="w-3 h-3 animate-spin" />Activation de la synchro…</>}
                  {sync === 'ok' && <>✓ Synchro active : quand tu modifies ton pool, il se met à jour chez tes amis. Pas besoin de renvoyer le lien.</>}
                  {sync === 'unavailable' && <>Synchro indisponible pour l'instant : le lien contient quand même ton pool actuel, et la synchro démarrera d'elle-même dès que le relais répondra.</>}
                </p>
                <div className="border-t border-border pt-3">
                  <button onClick={() => setShowDevice(v => !v)} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <Smartphone className="w-3.5 h-3.5" />Changer de téléphone
                  </button>
                  {showDevice && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[11px] text-muted-foreground">Garde ce code de récupération pour toi. Colle-le sur ton nouveau téléphone : tes amis continueront à recevoir ton pool sans rien refaire.</p>
                      <div className="p-2 rounded-lg bg-secondary border border-border text-[11px] font-mono break-all selectable">{exportIdentity()}</div>
                      <input value={recovery} onChange={e => setRecovery(e.target.value)} placeholder="Coller un code DM-…" className="w-full p-2.5 rounded-lg bg-secondary border border-border text-base font-mono" />
                      <button onClick={handleRecovery} disabled={!recovery.trim()} className="w-full py-2 rounded-lg font-semibold text-sm bg-secondary text-foreground disabled:opacity-50">Utiliser ce code sur ce téléphone</button>
                    </div>
                  )}
                </div>
              </>
            )}
            <button onClick={() => setShowModal(false)} className="w-full bg-secondary text-foreground py-2 rounded-lg font-semibold text-sm">Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}
