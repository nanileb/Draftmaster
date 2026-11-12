import React from 'react';
import { cn } from '@/lib/utils';
import { Home, UserCircle, Users, Swords } from 'lucide-react';

export const TABS = {
  HOME: 'home',
  PROFILE: 'profile',
  TEAM: 'team',
  CHAMPIONS: 'champions',
};

const TAB_CONFIG = [
  { key: TABS.HOME,      label: 'Accueil',    Icon: Home },
  { key: TABS.PROFILE,   label: 'Profil',     Icon: UserCircle },
  { key: TABS.TEAM,      label: 'Équipe',     Icon: Users },
  { key: TABS.CHAMPIONS, label: 'Champions',  Icon: Swords },
];

export default function BottomTabBar({ activeTab, onTabPress }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-lg border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center max-w-md mx-auto">
        {TAB_CONFIG.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabPress(key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors tap-target',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label={label}
            >
              <Icon className={cn('w-5 h-5 transition-transform', active && 'scale-110')} />
              <span className={cn('text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}