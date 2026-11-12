import React from 'react';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_LABELS } from '@/lib/championEngine';
import { Sword, TreePine, Flame, Target, Heart, TrendingUp, Users, RefreshCw } from 'lucide-react';
import ShareProfile from '@/components/ShareProfile';

const ROLE_CONFIG = {
  TOP: {
    icon: Sword,
    gradient: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/30',
    iconColor: 'text-orange-400',
    activeBg: 'bg-orange-500/20',
    desc: 'Lane haute',
  },
  JUNGLE: {
    icon: TreePine,
    gradient: 'from-green-500/20 to-green-600/5',
    border: 'border-green-500/30',
    iconColor: 'text-green-400',
    activeBg: 'bg-green-500/20',
    desc: 'Contrôle de map',
  },
  MID: {
    icon: Flame,
    gradient: 'from-primary/20 to-primary/5',
    border: 'border-primary/30',
    iconColor: 'text-primary',
    activeBg: 'bg-primary/20',
    desc: 'Lane centrale',
  },
  ADC: {
    icon: Target,
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-500/30',
    iconColor: 'text-cyan-400',
    activeBg: 'bg-cyan-500/20',
    desc: 'Carry à distance',
  },
  SUPPORT: {
    icon: Heart,
    gradient: 'from-pink-500/20 to-pink-600/5',
    border: 'border-pink-500/30',
    iconColor: 'text-pink-400',
    activeBg: 'bg-pink-500/20',
    desc: 'Soutien d\'équipe',
  },
};

function RoleButton({ role, onSelect }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <button
      onClick={() => onSelect(role)}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-2xl border w-full py-4 min-h-[64px]',
        'bg-gradient-to-b', config.gradient,
        config.border,
        'active:scale-[0.97] transition-all duration-200 hover:brightness-110'
      )}
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', config.activeBg)}>
        <Icon className={cn('w-4 h-4', config.iconColor)} />
      </div>
      <span className="font-grotesk font-bold text-xs">{ROLE_LABELS[role]}</span>
    </button>
  );
}

export default function RoleSelect({ onSelectRole, championCount, version, onShowBestDrafts, onShowTeamOptimization, userPool, champions = [], liveSlot = null }) {
  const topRow = ROLES.slice(0, 3);
  const bottomRow = ROLES.slice(3);



  return (
    <div className="flex flex-col px-5 py-4 overflow-y-auto justify-between gap-4" style={{ minHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="relative text-center space-y-1.5 pt-2">
        <div className="absolute right-0 top-0">
          <ShareProfile userPool={userPool} champions={champions} />
        </div>
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
          {championCount > 0 ? `${championCount} champions · Patch ${version}` : 'Chargement...'}
        </div>
        <h1 className="font-grotesk font-extrabold text-4xl text-foreground leading-tight">
          Draft<span className="text-primary">Master</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Votre poste pour cette partie ?
        </p>
      </div>

      {/* Role grid — 3 + 2 layout */}
      <div className="flex flex-col gap-3">
        {/* Row 1: 3 roles */}
        <div className="grid grid-cols-3 gap-3">
          {topRow.map(role => <RoleButton key={role} role={role} onSelect={onSelectRole} />)}
        </div>
        {/* Row 2: 2 roles centered */}
        <div className="flex gap-3 justify-center">
          {bottomRow.map(role => (
            <div key={role} style={{ width: 'calc(33.333% - 8px)' }}>
              <RoleButton role={role} onSelect={onSelectRole} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="space-y-2.5 pb-2">
        {liveSlot}
        <button
          onClick={onShowTeamOptimization}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-accent/30 bg-accent/5 text-accent font-grotesk font-semibold text-sm active:scale-[0.98] transition-all"
        >
          <Users className="w-4 h-4" />
          Optimisation d'équipe
        </button>
        <button
          onClick={onShowBestDrafts}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gold/30 bg-gold/5 text-gold font-grotesk font-semibold text-sm active:scale-[0.98] transition-all"
        >
          <TrendingUp className="w-4 h-4" />
          Meilleures drafts actuelles
        </button>
        <p className="text-center text-xs text-muted-foreground opacity-60">
          Données Riot Games (Data Dragon) · stats Challenger à Master et Lolalytics
        </p>
      </div>
    </div>
  );
}