import React from 'react';
import { DATA, DD } from '@/lib/gameData';
import { cn } from '@/lib/utils';

export default function ChampImg({ id, className }) {
  if (!id || !DATA.version) return <div className={cn('bg-secondary border border-border shrink-0', className)} />;
  return (
    <img
      src={`${DD}/cdn/${DATA.version}/img/champion/${id}.png`}
      alt=""
      loading="lazy"
      className={cn('border border-border object-cover shrink-0', className)}
      onError={e => { e.target.style.visibility = 'hidden'; }}
    />
  );
}
