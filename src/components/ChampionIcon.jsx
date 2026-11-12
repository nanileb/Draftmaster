import React, { useState } from 'react';
import { cn } from '@/lib/utils';

const MASTERY_COLORS = {
  main: 'ring-2 ring-green-win',
  comfortable: 'ring-2 ring-blue-info',
  beginner: 'ring-2 ring-gold',
};

export default function ChampionIcon({
  champion,
  size = 'md',
  onClick,
  isPool = false,
  poolMastery = null,
  isSelected = false,
  isDisabled = false,
  showName = false,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  const sizes = {
    xs: 'w-8 h-8 text-[8px]',
    sm: 'w-10 h-10 text-[9px]',
    md: 'w-14 h-14 text-[10px]',
    lg: 'w-16 h-16 text-xs',
    xl: 'w-20 h-20 text-sm',
  };

  const poolRing = poolMastery ? MASTERY_COLORS[poolMastery] : '';
  const selectedStyle = isSelected ? 'ring-2 ring-primary glow-primary' : '';
  const disabledStyle = isDisabled ? 'opacity-30 grayscale' : '';

  return (
    <div
      className={cn('flex flex-col items-center gap-1', className)}
      onClick={!isDisabled ? onClick : undefined}
    >
      <div
        className={cn(
          'champion-icon rounded-lg overflow-hidden relative flex-shrink-0',
          'bg-secondary border border-border',
          sizes[size],
          poolRing,
          selectedStyle,
          disabledStyle,
          onClick && !isDisabled ? 'cursor-pointer active:scale-95 transition-transform' : '',
        )}
      >
        {champion?.iconUrl && !imgError ? (
          <img
            src={champion.iconUrl}
            alt={champion.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <span className="text-muted-foreground font-bold text-xs">
              {champion?.name?.slice(0, 2) || '?'}
            </span>
          </div>
        )}
        {isPool && poolMastery && (
          <div className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border border-background',
            poolMastery === 'main' ? 'bg-green-win' :
            poolMastery === 'comfortable' ? 'bg-blue-info' : 'bg-gold'
          )} />
        )}
      </div>
      {showName && champion && (
        <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[56px] truncate">
          {champion.name}
        </span>
      )}
    </div>
  );
}