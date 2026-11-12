import React from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionIcon from './ChampionIcon';

export default function TeamSlots({
  team,
  onAdd,
  onRemove,
  label,
  isAlly,
  myChampionId,
  maxSlots = 5,
  myChampion = null,
}) {
  const filled = team.length;
  const slots = Array.from({ length: maxSlots });

  return (
    <div className={cn('rounded-xl p-3', isAlly ? 'bg-primary/5 border border-primary/20' : 'bg-red-lose/5 border border-red-lose/20')}>
      <div className="flex items-center justify-between mb-2.5">
        <span className={cn('text-xs font-semibold uppercase tracking-wider', isAlly ? 'text-primary' : 'text-red-lose')}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{filled}/{maxSlots}</span>
      </div>
      <div className="flex gap-2">
        {myChampion !== null && (
          <div className="relative flex-1 min-w-0">
            <div className="relative">
              <ChampionIcon champion={myChampion} size="sm" isSelected />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] font-bold px-1 rounded-full whitespace-nowrap">
                Moi
              </div>
            </div>
          </div>
        )}
        {slots.map((_, i) => {
          const champ = team[i];
          const isMy = champ?.id === myChampionId;
          return (
            <div key={i} className="relative flex-1 min-w-0">
              {champ ? (
                <div className="relative">
                  <ChampionIcon
                    champion={champ}
                    size="sm"
                    isSelected={isMy}
                  />
                  <button
                    onClick={() => onRemove(champ.id)}
                    aria-label="Retirer ce champion"
                    className={cn(
                      'hit-area absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center',
                      'bg-background border border-border shadow-sm',
                      isAlly ? 'text-primary' : 'text-red-lose'
                    )}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                  {isMy && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
              ) : (
                <button
                  onClick={onAdd}
                  aria-label="Ajouter un champion"
                  className={cn(
                    'w-full h-10 rounded-lg border-2 border-dashed flex items-center justify-center',
                    'transition-all active:scale-95',
                    isAlly ? 'border-primary/30 hover:border-primary/60' : 'border-red-lose/30 hover:border-red-lose/60'
                  )}
                >
                  <Plus className={cn('w-4 h-4', isAlly ? 'text-primary/40' : 'text-red-lose/40')} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}