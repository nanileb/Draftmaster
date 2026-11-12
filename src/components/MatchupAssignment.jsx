import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { BookOpen, ArrowLeftRight } from 'lucide-react';
import ChampionIcon from './ChampionIcon';

const ROLES = [
  { key: 'TOP',     label: 'Top',     icon: '🗡️' },
  { key: 'JUNGLE',  label: 'Jungle',  icon: '🌿' },
  { key: 'MID',     label: 'Mid',     icon: '⚡' },
  { key: 'ADC',     label: 'ADC',     icon: '🏹' },
  { key: 'SUPPORT', label: 'Support', icon: '💫' },
];

export default function MatchupAssignment({
  enemyTeam,
  enemyByRole,
  onSetEnemyRole,
  onSwapEnemyRoles,
  onGoToTips,
  onBack,
}) {
  const [selectedRole, setSelectedRole] = useState(null);

  const assignedCount = Object.values(enemyByRole).filter(Boolean).length;
  const allAssigned = enemyTeam.length > 0 && assignedCount === enemyTeam.length;

  const handleRolePress = (roleKey) => {
    const champion = enemyByRole[roleKey];
    if (!champion) return; // slot vide, rien à faire

    if (!selectedRole) {
      // Première sélection
      setSelectedRole(roleKey);
    } else if (selectedRole === roleKey) {
      // Désélectionner
      setSelectedRole(null);
    } else {
      // Échanger avec le poste sélectionné
      onSwapEnemyRoles(selectedRole, roleKey);
      setSelectedRole(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-lg z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target flex items-center justify-center">
          <span className="text-lg leading-none">←</span>
        </button>
        <div>
          <h2 className="font-grotesk font-semibold text-base">Postes ennemis</h2>
          <p className="text-xs text-muted-foreground">
            {selectedRole
              ? 'Appuie sur un autre poste pour échanger'
              : 'Appuie sur un champion pour l\'échanger'}
          </p>
        </div>
        <span className="ml-auto text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full">
          {assignedCount}/{enemyTeam.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-3">
        {ROLES.map(role => {
          const champion = enemyByRole[role.key] || null;
          const isSelected = selectedRole === role.key;
          const isSwapTarget = selectedRole && selectedRole !== role.key && champion;

          return (
            <div
              key={role.key}
              onClick={() => handleRolePress(role.key)}
              className={cn(
                'flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : isSwapTarget
                    ? 'border-accent/60 bg-accent/5'
                    : 'border-border bg-secondary/30',
                champion ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
              )}
            >
              {/* Icône + label du rôle */}
              <div className="flex flex-col items-center gap-0.5 w-12 shrink-0">
                <span className="text-2xl">{role.icon}</span>
                <span className="text-xs font-semibold text-muted-foreground">{role.label}</span>
              </div>

              {/* Champion */}
              <div className="flex-1 flex items-center">
                {champion ? (
                  <div className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 transition-all w-full',
                    isSelected ? 'bg-primary/20' : 'bg-secondary/60'
                  )}>
                    <ChampionIcon champion={champion} size="md" />
                    <span className="font-grotesk font-semibold text-sm truncate flex-1">{champion.name}</span>
                    {isSelected && <ArrowLeftRight className="w-4 h-4 text-primary shrink-0" />}
                    {isSwapTarget && <ArrowLeftRight className="w-4 h-4 text-accent shrink-0" />}
                  </div>
                ) : (
                  <div className="w-full h-14 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/50">—</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="fixed left-0 right-0 p-4 bg-background/90 backdrop-blur-lg border-t border-border" style={{ bottom: 0, paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={onGoToTips}
          disabled={!allAssigned}
          className={cn(
            'w-full py-4 rounded-2xl font-grotesk font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2',
            allAssigned
              ? 'bg-primary text-primary-foreground glow-primary'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
          )}
        >
          <BookOpen className="w-5 h-5" />
          {allAssigned
            ? 'Voir les conseils de jeu'
            : `Assigne tous les ennemis (${enemyTeam.length - assignedCount} restants)`}
        </button>
      </div>
    </div>
  );
}