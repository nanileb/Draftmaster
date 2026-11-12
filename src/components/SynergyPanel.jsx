import React from 'react';
import { cn } from '@/lib/utils';

export default function SynergyPanel({ synergies, winCondition }) {
  if (!synergies || synergies.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
        Synergies détectées
      </p>
      <div className="space-y-2">
        {synergies.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">{s.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-semibold', s.color)}>{s.type}</span>
                {i === 0 && winCondition === s.type && (
                  <span className="text-[11px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                    Win con.
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}