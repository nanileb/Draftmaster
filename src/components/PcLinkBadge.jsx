import React from 'react';
import { Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePcLink } from '@/lib/pcLink';

// Petit bandeau « PC relié » : rien quand aucun PC n'est relié
const TEXT = {
  select: ['Sélection lue sur le PC : tout se remplit seul', 'text-green-win border-green-win/40 bg-green-win/10'],
  noclient: ['PC relié · lance League, la sélection se remplira toute seule', 'text-muted-foreground border-border'],
  idle: ['PC relié · en attente de la sélection des champions', 'text-muted-foreground border-border'],
  game: ['PC relié · partie en cours', 'text-muted-foreground border-border'],
  waiting: ['PC relié mais pas de nouvelles : lance DraftMaster PC sur l\'ordinateur', 'text-gold border-gold/40 bg-gold/5'],
  error: ['PC relié · relais injoignable pour l\'instant', 'text-gold border-gold/40 bg-gold/5'],
};

export default function PcLinkBadge({ className }) {
  const { status } = usePcLink();
  const t = TEXT[status];
  if (!t) return null;
  return (
    <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium', t[1], className)}>
      <Monitor className="w-3.5 h-3.5 shrink-0" />
      <span>{t[0]}</span>
      {status === 'select' && <span className="ml-auto w-2 h-2 rounded-full bg-green-win animate-pulse shrink-0" />}
    </div>
  );
}
