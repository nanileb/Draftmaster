import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const ROLE_LABELS = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Milieu',
  ADC: 'ADC',
  SUPPORT: 'Soutien',
};
const ROLE_CONFIG = {
  TOP: { icon: '🗡️', label: 'Top' },
  JUNGLE: { icon: '🌿', label: 'Jungle' },
  MID: { icon: '⚡', label: 'Mid' },
  ADC: { icon: '🏹', label: 'ADC' },
  SUPPORT: { icon: '💫', label: 'Support' },
};

export default function TeamAssignment({
  teamAssignment,
  players,
  friends = [],
  currentUser,
  userPool,
  champions,
  onAssign,
  onRemove,
}) {
  const [showDropdown, setShowDropdown] = useState(null);

  const getChampionIcon = (name) => {
    if (!name || !champions) return null;
    return champions.find(c =>
      c.id.toLowerCase() === name.toLowerCase().replace(/[' ]/g, '') ||
      c.name.toLowerCase() === name.toLowerCase()
    );
  };

  const assignedPlayerIds = new Set(Object.values(teamAssignment).map(p => p?.id));
  
  // Create a virtual "me" player object from the user and their pool
  const mePlayer = userPool && currentUser ? {
    id: `me_${currentUser.id}`,
    name: `${currentUser.full_name} (Toi)`,
    pools: userPool,
    isMePlayer: true
  } : null;

  // Friends as virtual players (only those with pools)
  const friendPlayers = friends
    .filter(f => f.pools)
    .map(f => ({
      id: `friend_${f.id}`,
      name: f.name,
      pools: f.pools,
      isFriend: true
    }));
  
  // Get available players for a specific role
  const getAvailablePlayersForRole = (role) => {
    const candidates = [
      ...(mePlayer && !assignedPlayerIds.has(mePlayer.id) ? [mePlayer] : []),
      ...players.filter(p => !assignedPlayerIds.has(p.id)),
      ...friendPlayers.filter(p => !assignedPlayerIds.has(p.id))
    ];
    // Filter only players who have champions in their pool for this role
    return candidates.filter(p => p.pools?.[role]?.length > 0);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
        Assignation de l'équipe ({Object.keys(teamAssignment).length}/5 rôles)
      </p>

      {ROLES.map(role => {
        const assignedPlayer = teamAssignment[role];
        const config = ROLE_CONFIG[role];

        return (
          <div key={role} className="relative">
            {assignedPlayer ? (
              <div className="glass rounded-xl p-3 border border-border flex items-center justify-between group">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{config.icon}</span>
                  <div>
                    <p className="font-grotesk font-bold text-sm text-foreground">
                      {assignedPlayer.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {assignedPlayer.pools?.[role]?.slice(0, 3).map(champ => {
                        const champIcon = getChampionIcon(champ);
                        return champIcon?.iconUrl ? (
                          <img
                            key={champ}
                            src={champIcon.iconUrl}
                            alt={champ}
                            className="w-5 h-5 rounded border border-border"
                            title={champ}
                          />
                        ) : (
                          <span
                            key={champ}
                            className="text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground"
                          >
                            {champ.slice(0, 2)}
                          </span>
                        );
                      })}
                      {(assignedPlayer.pools?.[role]?.length || 0) > 3 && (
                        <span className="text-[11px] text-muted-foreground px-1">
                          +{(assignedPlayer.pools?.[role]?.length || 0) - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(role)}
                  aria-label="Retirer de ce poste"
                  className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(showDropdown === role ? null : role)}
                  className="w-full glass rounded-xl p-3 border border-border hover:border-primary/30 transition-all text-left flex items-center gap-2.5"
                >
                  <span className="text-lg">{config.icon}</span>
                  <span className="text-sm text-muted-foreground">
                    Assigner {config.label}
                  </span>
                </button>

                {showDropdown === role && (
                   <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl border border-border overflow-hidden z-20">
                     {(() => {
                       const availableForRole = getAvailablePlayersForRole(role);
                       return availableForRole.length === 0 ? (
                         <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                           Aucun joueur n'a de champions pour ce rôle
                         </div>
                       ) : (
                         availableForRole.map(player => (
                           <button
                             key={player.id}
                             onClick={() => {
                               onAssign(role, player);
                               setShowDropdown(null);
                             }}
                             className={cn(
                               "w-full px-3 py-2.5 text-left text-sm hover:bg-primary/10 border-b border-border last:border-b-0 transition-all",
                               player.isMePlayer && "bg-primary/5",
                               player.isFriend && "bg-accent/5"
                             )}
                           >
                             <p className="font-semibold text-foreground">{player.name}</p>
                             <p className="text-xs text-muted-foreground">
                               {player.pools?.[role]?.length || 0} champions {ROLE_LABELS[role]}
                             </p>
                           </button>
                         ))
                       );
                     })()}
                   </div>
                 )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}