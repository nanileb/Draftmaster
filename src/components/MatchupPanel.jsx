import React from 'react';
import { cn } from '@/lib/utils';
import { analyzeLaneMatchup } from '@/lib/championEngine';
import ChampionIcon from '@/components/ChampionIcon';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ROLE_POSITIONS = {
  TOP: 0,
  JUNGLE: 1,
  MID: 2,
  ADC: 3,
  SUPPORT: 4,
};

function MatchupRow({ allyChamp, enemyChamp, role, roleKey }) {
  const matchup = allyChamp && enemyChamp ? analyzeLaneMatchup(allyChamp, enemyChamp, roleKey) : null;

  const advColor = matchup?.advantage === 'ally' ? 'text-green-win' :
    matchup?.advantage === 'enemy' ? 'text-red-lose' : 'text-gold';
  const AdvIcon = matchup?.advantage === 'ally' ? TrendingUp :
    matchup?.advantage === 'enemy' ? TrendingDown : Minus;

  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1">
          {allyChamp ? (
            <ChampionIcon champion={allyChamp} size="xs" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center">
              <span className="text-[11px] text-muted-foreground">{role}</span>
            </div>
          )}
          <span className="text-xs font-medium text-primary">
            {allyChamp?.name || role}
          </span>
        </div>

        {matchup && (
          <div className={cn('flex items-center gap-1', advColor)}>
            <AdvIcon className="w-4 h-4" />
          </div>
        )}

        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-xs font-medium text-red-lose text-right">
            {enemyChamp?.name || '?'}
          </span>
          {enemyChamp ? (
            <ChampionIcon champion={enemyChamp} size="xs" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center">
              <span className="text-[11px] text-muted-foreground">{role}</span>
            </div>
          )}
        </div>
      </div>

      {matchup && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">{matchup.reason}</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">🕐 {matchup.timing}</span>
          </div>
          <p className={cn('text-[11px] font-medium', advColor)}>{matchup.advice}</p>
        </div>
      )}
    </div>
  );
}

export default function MatchupPanel({ allyTeam, enemyTeam, selectedRole, allyByRole = {}, enemyByRole = {} }) {
  if (allyTeam.length === 0 && enemyTeam.length === 0) return null;

  // Duels par poste (et non plus par ordre de sélection)
  const roleKeys = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  const roleLabels = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };
  const rows = roleKeys.filter(r => allyByRole[r] || enemyByRole[r]);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Matchups par lane
      </p>
      {rows.map(r => (
        <MatchupRow
          key={r}
          allyChamp={allyByRole[r]}
          enemyChamp={enemyByRole[r]}
          role={roleLabels[r]}
          roleKey={r}
        />
      ))}
    </div>
  );
}
