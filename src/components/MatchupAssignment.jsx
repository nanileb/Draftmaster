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

// Une équipe : touche un champion puis un autre poste pour les échanger (un poste vide accepte aussi le champion)
function TeamRoles({ title, byRole, selected, onPress, myChampion, tone }) {
  return (
    <div className="space-y-2">
      <h3 className={cn('text-xs font-semibold uppercase tracking-wider', tone === 'ally' ? 'text-primary' : 'text-red-lose')}>{title}</h3>
      {ROLES.map(role => {
        const champion = byRole[role.key] || null;
        const isSelected = selected === role.key;
        const isTarget = selected && selected !== role.key;
        const isMe = myChampion && champion && champion.id === myChampion.id;
        return (
          <button
            type="button"
            key={role.key}
            onClick={() => onPress(role.key)}
            disabled={!champion && !selected}
            className={cn(
              'w-full flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all',
              isSelected ? 'border-primary bg-primary/10' : isTarget ? 'border-accent/60 bg-accent/5' : 'border-border bg-secondary/30',
              champion || selected ? 'active:scale-[0.98]' : 'cursor-default'
            )}
          >
            <div className="flex flex-col items-center gap-0.5 w-12 shrink-0">
              <span className="text-xl leading-none">{role.icon}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">{role.label}</span>
            </div>
            {champion ? (
              <div className={cn('flex-1 min-w-0 flex items-center gap-3 rounded-xl px-2 py-1.5', isSelected ? 'bg-primary/20' : 'bg-secondary/60')}>
                <ChampionIcon champion={champion} size="md" />
                <span className="font-grotesk font-semibold text-sm truncate flex-1">{champion.name}</span>
                {isMe && <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">Toi</span>}
                {(isSelected || isTarget) && <ArrowLeftRight className={cn('w-4 h-4 shrink-0', isSelected ? 'text-primary' : 'text-accent')} />}
              </div>
            ) : (
              <div className="flex-1 h-12 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground/60">{isTarget ? 'Mettre ici' : '—'}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function MatchupAssignment({
  enemyTeam,
  enemyByRole,
  allyByRole = {},
  myChampion = null,
  onSetEnemyRole,
  onSwapEnemyRoles,
  onSwapAllyRoles,
  onGoToTips,
  onBack,
}) {
  // { side: 'ally' | 'enemy', role }
  const [sel, setSel] = useState(null);

  const assignedCount = Object.values(enemyByRole).filter(Boolean).length;
  const allAssigned = enemyTeam.length > 0 && assignedCount === enemyTeam.length;

  const press = (side, byRole, swap) => (roleKey) => {
    if (!sel || sel.side !== side) { if (byRole[roleKey]) setSel({ side, role: roleKey }); return; }
    if (sel.role === roleKey) { setSel(null); return; }
    swap(sel.role, roleKey);
    setSel(null);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-lg z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target flex items-center justify-center" aria-label="Retour">
          <span className="text-lg leading-none">←</span>
        </button>
        <div className="min-w-0">
          <h2 className="font-grotesk font-semibold text-base">Postes des champions</h2>
          <p className="text-xs text-muted-foreground truncate">
            {sel ? 'Touche un autre poste pour échanger' : 'Vérifie le poste de chaque champion'}
          </p>
        </div>
        <span className="ml-auto text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full shrink-0">
          {assignedCount}/{enemyTeam.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        {onSwapAllyRoles && Object.values(allyByRole).some(Boolean) && (
          <TeamRoles title="Ton équipe" tone="ally" byRole={allyByRole} myChampion={myChampion}
            selected={sel && sel.side === 'ally' ? sel.role : null}
            onPress={press('ally', allyByRole, onSwapAllyRoles)} />
        )}
        <TeamRoles title="Équipe adverse" tone="enemy" byRole={enemyByRole}
          selected={sel && sel.side === 'enemy' ? sel.role : null}
          onPress={press('enemy', enemyByRole, onSwapEnemyRoles)} />
      </div>

      <div className="fixed left-0 right-0 p-4 bg-background/90 backdrop-blur-lg border-t border-border max-w-md mx-auto" style={{ bottom: 0, paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={onGoToTips}
          disabled={!allAssigned}
          className={cn(
            'w-full py-4 rounded-2xl font-grotesk font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2',
            allAssigned ? 'bg-primary text-primary-foreground glow-primary' : 'bg-secondary text-muted-foreground cursor-not-allowed'
          )}
        >
          <BookOpen className="w-5 h-5" />
          {allAssigned ? 'Voir les conseils de jeu' : `Assigne tous les ennemis (${enemyTeam.length - assignedCount} restants)`}
        </button>
      </div>
    </div>
  );
}
