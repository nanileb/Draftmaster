import React from 'react';
import { cn } from '@/lib/utils';
import { championStat } from '@/lib/gameData';

const TIER_STYLES = {
  'S+': 'bg-primary/20 text-primary border-primary/40',
  'S':  'bg-purple-500/20 text-purple-400 border-purple-400/40',
  'A':  'bg-green-win/20 text-green-win border-green-win/40',
  'B':  'bg-gold/20 text-gold border-gold/40',
  'C':  'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/40',
};

// Tier et WR du champion à ce poste (parties Challenger / GM / Master du patch, builds.json du coach)
export default function ChampionStatsBadge({ championId, role }) {
  const stats = championId && role ? championStat(championId, role) : null;
  if (!stats) return null;
  const tierStyle = TIER_STYLES[stats.tier] || TIER_STYLES['B'];
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border', tierStyle)}>{stats.tier}</span>
      {stats.winRate != null && (
        <span className="text-[11px] text-muted-foreground">
          {stats.winRate.toFixed(1)}% WR{stats.games ? ` · ${stats.games} parties` : ''}
        </span>
      )}
    </div>
  );
}
