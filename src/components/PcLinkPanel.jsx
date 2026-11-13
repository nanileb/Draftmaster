import React, { useState } from 'react';
import { Monitor, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePcLink, getPcCode, setPcCode, normCode, showCode } from '@/lib/pcLink';

// Profil › PC relié : la sélection des champions lue sur le PC remplit la draft toute seule
const PAGE = 'nanileb.github.io/Draftmaster/pc';
const STATUS = {
  select: ['Sélection en cours : la draft se remplit toute seule', 'text-green-win'],
  noclient: ['Connecté : le client League n\'est pas lancé sur le PC', 'text-green-win'],
  idle: ['Connecté : en attente de la sélection des champions', 'text-green-win'],
  game: ['Connecté : partie en cours', 'text-green-win'],
  waiting: ['Pas de nouvelles du PC : lance DraftMaster PC sur l\'ordinateur', 'text-gold'],
  error: ['Relais injoignable pour l\'instant', 'text-gold'],
};

export default function PcLinkPanel() {
  const { status } = usePcLink();
  const code = getPcCode();
  const [open, setOpen] = useState(!code);
  const [input, setInput] = useState('');
  const field = 'w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary';
  const link = () => {
    const c = normCode(input);
    if (c.length !== 8) { toast.error('Le code fait 8 caractères, par exemple ABCD-2345'); return; }
    setPcCode(c); setInput('');
    toast.success('PC relié', { description: 'La draft se remplira toute seule pendant la sélection des champions.' });
  };
  const copy = async () => { try { await navigator.clipboard.writeText('https://' + PAGE); toast.success('Adresse copiée'); } catch (e) { /* rien */ } };
  const st = STATUS[status];
  return (
    <div className="glass rounded-xl border border-border mt-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 p-3 text-left">
        <Monitor className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">PC relié {code && <span className={cn('text-xs font-medium', st ? st[1] : 'text-muted-foreground')}>· {status === 'waiting' ? 'hors ligne' : status === 'error' ? 'relais injoignable' : 'connecté'}</span>}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {code ? (
            <>
              <p className={cn('text-sm font-medium', st ? st[1] : '')}>{st ? st[0] : ''}</p>
              <p className="text-xs text-muted-foreground">Code du PC : <span className="font-mono font-semibold text-foreground">{showCode(code)}</span></p>
              <p className="text-[11px] text-muted-foreground leading-snug">Pendant la sélection des champions, l'Accueil ouvre la draft à ton poste et coche tout seul les picks des deux équipes. Dans l'onglet Équipe, la draft en direct reçoit aussi les bans et les verrouillages. Tu peux toujours corriger à la main.</p>
              <button onClick={() => { setPcCode(''); setOpen(true); }} className="w-full py-2 rounded-xl bg-secondary text-sm font-semibold">Délier ce PC</button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground leading-snug">Comme Porofessor : un petit programme sur ton PC lit la sélection des champions dans le client League et l'envoie ici. Il ne fait que lire, il ne touche à rien dans le jeu.</p>
              <ol className="text-xs space-y-2 list-decimal pl-4">
                <li>Sur ton PC, ouvre <button onClick={copy} className="font-semibold text-primary inline-flex items-center gap-1">{PAGE} <Copy className="w-3 h-3" /></button> et télécharge <b>DraftMaster PC</b>.</li>
                <li>Double-clique sur le fichier. Il affiche un code à 8 caractères.</li>
                <li>Tape ce code ici (une seule fois) :</li>
              </ol>
              <div className="flex gap-2">
                <input className={cn(field, 'font-mono uppercase tracking-widest')} value={input} onChange={e => setInput(e.target.value)} placeholder="ABCD-2345" maxLength={9} autoCapitalize="characters" autoCorrect="off" spellCheck={false} onKeyDown={e => { if (e.key === 'Enter') link(); }} />
                <button onClick={link} className="px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shrink-0">Relier</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
