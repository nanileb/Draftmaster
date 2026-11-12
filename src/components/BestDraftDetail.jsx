import React, { useState } from 'react';
import { X, Trophy, Zap, ShieldCheck, AlertTriangle, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import SynergiesDetailPanel from './SynergiesDetailPanel';

const ROLE_CONFIG = {
  top:     { label: 'Top',     icon: '🗡️' },
  jungle:  { label: 'Jungle',  icon: '🌿' },
  mid:     { label: 'Mid',     icon: '⚡' },
  adc:     { label: 'ADC',     icon: '🏹' },
  support: { label: 'Support', icon: '💫' },
};

const ROLE_LABELS_FR = {
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Milieu',
  adc: 'ADC',
  support: 'Soutien',
};

const SYNERGY_ICONS = {
  'Protect the Carry': '🛡️',
  'Full Engage': '⚔️',
  'Poke': '🎯',
  'Pick / Catch': '🪤',
  'Scaling': '📈',
  'Dive': '🔥',
  'Split Push': '✂️',
};

function getIconForSynergy(type) {
  for (const [key, icon] of Object.entries(SYNERGY_ICONS)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '✨';
}

function ScoreRing({ score }) {
  const color = score >= 80 ? 'text-green-win border-green-win/40 bg-green-win/10'
    : score >= 65 ? 'text-gold border-gold/40 bg-gold/10'
    : 'text-red-lose border-red-lose/40 bg-red-lose/10';
  return (
    <div className={cn('flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 shrink-0', color)}>
      <span className="font-grotesk font-extrabold text-xl leading-none">{score}</span>
      <span className="text-[9px] leading-none opacity-70 mt-0.5">score</span>
    </div>
  );
}

export default function BestDraftDetail({ draft, champions, onClose }) {
  const [showSynergiesDetail, setShowSynergiesDetail] = useState(false);

  if (!draft) return null;

  const getChampionIcon = (name) => {
    if (!name || !champions) return null;
    return champions.find(c =>
      c.id.toLowerCase() === name.toLowerCase().replace(/[' ]/g, '') ||
      c.name.toLowerCase() === name.toLowerCase()
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-lg">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-grotesk font-bold text-base truncate">{draft.name}</h2>
          <p className="text-xs text-muted-foreground truncate">{draft.playstyle}</p>
        </div>
        <ScoreRing score={draft.draftScore} />
      </div>

      <div className="px-4 py-5 space-y-5 pb-10">
        {/* Header info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Style de jeu</p>
              <p className="text-lg font-grotesk font-bold text-foreground mt-1">{draft.playstyle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Victoire estimée</p>
              <p className={cn('text-2xl font-grotesk font-extrabold mt-1', 
                draft.winRate >= 55 ? 'text-green-win' : draft.winRate >= 52 ? 'text-gold' : 'text-muted-foreground'
              )}>{draft.winRate}%</p>
            </div>
          </div>
        </div>

        {/* Win condition */}
        {draft.winCondition && (
          <div className="glass rounded-2xl p-4 border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-primary uppercase tracking-wider font-medium mb-1">Condition de victoire</p>
                <p className="text-sm text-foreground font-semibold">{draft.winCondition}</p>
              </div>
            </div>
          </div>
        )}

        {/* Champions by role */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Composition</p>
          <div className="space-y-2">
            {Object.entries(ROLE_CONFIG).map(([roleKey, roleConf]) => {
              const champData = Array.isArray(draft.champions) 
                ? draft.champions.find(c => c.role?.toLowerCase() === roleKey.toLowerCase())
                : draft.champions?.[roleKey];
              const champName = champData?.name || champData;
              const champ = getChampionIcon(champName);
              return (
                <div key={roleKey} className="flex items-center gap-3 bg-secondary/40 rounded-xl px-3 py-2.5 border border-border">
                  <span className="text-xl w-7 text-center">{roleConf.icon}</span>
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{roleConf.label}</span>
                  <div className="flex items-center gap-2 flex-1">
                    {champ?.iconUrl ? (
                      <img
                        src={champ.iconUrl}
                        alt={champName}
                        className="w-8 h-8 rounded-lg object-cover border border-border shrink-0"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                        <span className="text-[9px] text-muted-foreground">{champName?.slice(0, 2)}</span>
                      </div>
                    )}
                    <span className="font-grotesk font-semibold text-sm">{champName || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strategy description */}
        {(draft.description || draft.analysis || draft.strategy) && (
          <div className="glass rounded-2xl p-4 border border-accent/20 bg-accent/5">
            <p className="text-xs text-accent uppercase tracking-wider font-medium mb-2">Stratégie</p>
            <p className="text-sm text-foreground/90 leading-relaxed">{draft.description || draft.analysis || draft.strategy}</p>
          </div>
        )}

        {/* Synergies summary + detail button */}
        {draft.synergies?.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Synergies clés</p>
            <div className="grid grid-cols-1 gap-2 mb-3">
              {draft.synergies.map((s, i) => (
                <div key={i} className="flex items-start gap-3 bg-secondary/40 rounded-xl px-3 py-2.5 border border-border hover:border-primary/30 transition-colors">
                  <span className="text-base shrink-0">{getIconForSynergy(s)}</span>
                  <span className="text-sm font-semibold text-foreground leading-snug">{s}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowSynergiesDetail(!showSynergiesDetail)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary font-semibold text-sm hover:bg-primary/10 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              {showSynergiesDetail ? 'Masquer' : 'Afficher'} l'analyse détaillée
            </button>
          </div>
        )}

        {/* Detailed synergies analysis */}
        {showSynergiesDetail && (
          <div className="pt-2">
            <SynergiesDetailPanel draft={draft} />
          </div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 gap-3">
          {draft.strengths?.length > 0 && (
            <div className="bg-green-win/5 rounded-2xl p-4 border border-green-win/20">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-green-win" />
                <p className="text-xs text-green-win uppercase tracking-wider font-medium">Points forts</p>
              </div>
              <ul className="space-y-1.5">
                {draft.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-foreground/85 flex items-start gap-2.5">
                    <span className="text-green-win font-bold mt-0.5">+</span> 
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft.weaknesses?.length > 0 && (
            <div className="bg-red-lose/5 rounded-2xl p-4 border border-red-lose/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-lose" />
                <p className="text-xs text-red-lose uppercase tracking-wider font-medium">Faiblesses</p>
              </div>
              <ul className="space-y-1.5">
                {draft.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-foreground/85 flex items-start gap-2.5">
                    <span className="text-red-lose font-bold mt-0.5">−</span> 
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}