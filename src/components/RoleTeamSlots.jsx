import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionIcon from './ChampionIcon';
import ChampionPicker from './ChampionPicker';

const ALLY_ROLES = [
  { key: 'TOP', label: 'Top', icon: '🗡️' },
  { key: 'JUNGLE', label: 'Jgl', icon: '🌿' },
  { key: 'MID', label: 'Mid', icon: '⚡' },
  { key: 'ADC', label: 'ADC', icon: '🏹' },
  { key: 'SUPPORT', label: 'Sup', icon: '💫' },
];

export default function RoleTeamSlots({
  champions,
  allyByRole,       // { TOP: champion|null, JUNGLE: ..., ... }
  myRole,           // e.g. 'MID'
  myChampion,
  userPool,
  onSetAllyRole,    // (role, champion) => void
  onRemoveAllyRole, // (role) => void
  topPickNames = [],
  bannedIds = [],   // champions bannis : absents du choix
}) {
  const [pickerRole, setPickerRole] = useState(null);

  const excludeIds = [...Object.values(allyByRole)
    .filter(Boolean)
    .map(c => c.id), ...bannedIds];

  return (
    <>
      <div className="rounded-xl p-3 bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Alliés</span>
          <span className="text-xs text-muted-foreground">
            {Object.values(allyByRole).filter(Boolean).length}/5
          </span>
        </div>
        <div className="flex gap-2">
          {ALLY_ROLES.map(role => {
            const champ = allyByRole[role.key];
            const isMyRole = role.key === myRole;
            const displayChamp = isMyRole ? myChampion : champ;

            return (
              <div key={role.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{role.icon}</span>
                {displayChamp ? (
                  <div className="relative">
                    <ChampionIcon
                      champion={displayChamp}
                      size="sm"
                      isSelected={isMyRole}
                    />
                    {!isMyRole && (
                      <button
                        onClick={() => onRemoveAllyRole(role.key)}
                        aria-label="Retirer ce champion"
                        className="hit-area absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center text-primary"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {isMyRole && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold px-1.5 rounded-full whitespace-nowrap">
                        Moi
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => !isMyRole && setPickerRole(role.key)}
                    disabled={isMyRole}
                    aria-label="Ajouter un champion"
                    className={cn(
                      'w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center transition-all active:scale-95',
                      isMyRole
                        ? 'border-primary/20 opacity-40 cursor-not-allowed'
                        : 'border-primary/30 hover:border-primary/60'
                    )}
                  >
                    <span className="text-xs text-primary/40">+</span>
                  </button>
                )}
                <span className="text-xs text-muted-foreground">{role.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {pickerRole && (
        <ChampionPicker
          champions={champions}
          role={pickerRole}
          lockedRole={false}
          onSelect={(c) => { onSetAllyRole(pickerRole, c); setPickerRole(null); }}
          onClose={() => setPickerRole(null)}
          excludeIds={excludeIds}
          userPool={userPool}
          title={`Pick allié — ${ALLY_ROLES.find(r => r.key === pickerRole)?.label}`}
          topPickNames={topPickNames}
        />
      )}
    </>
  );
}