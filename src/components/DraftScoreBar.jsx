import React from 'react';
import { cn } from '@/lib/utils';

export default function DraftScoreBar({ score, winProbability, scoreInfo, compact = false }) {
  const scoreColor = score >= 80 ? 'text-green-win' : score >= 60 ? 'text-gold' : 'text-red-lose';
  const barColor = score >= 80 ? 'bg-green-win' : score >= 60 ? 'bg-gold' : 'bg-red-lose';
  const winColor = winProbability >= 55 ? 'text-green-win' : winProbability <= 45 ? 'text-red-lose' : 'text-gold';

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Draft</span>
          <span className={cn('font-grotesk font-bold text-sm', scoreColor)}>{score}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Win%</span>
          <span className={cn('font-grotesk font-bold text-sm', winColor)}>{winProbability}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Score de Draft</p>
          <div className="flex items-end gap-2 mt-1">
            <span className={cn('font-grotesk font-extrabold text-3xl', scoreColor)}>{score}</span>
            <span className="text-muted-foreground text-sm mb-1">/100</span>
            <span className={cn('text-sm font-semibold mb-1', scoreColor)}>{scoreInfo?.label}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Victoire</p>
          <span className={cn('font-grotesk font-extrabold text-3xl', winColor)}>{winProbability}%</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${score}%` }}
          />
        </div>
        {/* Win% bar */}
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden relative">
          <div
            className="absolute inset-y-0 bg-red-lose rounded-l-full transition-all duration-700"
            style={{ width: `${100 - winProbability}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-green-win rounded-r-full transition-all duration-700"
            style={{ width: `${winProbability}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-border"
            style={{ left: '50%' }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Ennemi {100 - winProbability}%</span>
          <span>Allié {winProbability}%</span>
        </div>
      </div>
    </div>
  );
}