import React from 'react';
import { Star, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChampionIcon from '@/components/ChampionIcon';
import ChampionStatsBadge from '@/components/ChampionStatsBadge';

// recommendScore = victoire estimée en % (42 à 58) : WR du champion chez les meilleurs joueurs,
// corrigé par tes alliés, tes adversaires et les besoins de la compo
function ScoreBadge({ score, large = false }) {
  const pct = Math.round(score);
  const color = pct >= 52 ? 'text-green-win' : pct >= 49 ? 'text-gold' : 'text-red-lose';
  const ring  = pct >= 52 ? 'border-green-win/40' : pct >= 49 ? 'border-gold/40' : 'border-red-lose/40';
  const bg    = pct >= 52 ? 'bg-green-win/10' : pct >= 49 ? 'bg-gold/10' : 'bg-red-lose/10';

  if (large) {
    return (
      <div className={cn('flex flex-col items-center justify-center rounded-full border w-12 h-12 shrink-0', bg, ring)} title="Victoire estimée">
        <span className={cn('font-grotesk font-bold text-sm leading-none', color)}>{pct}%</span>
        <span className="text-[8px] text-muted-foreground leading-none mt-0.5">est.</span>
      </div>
    );
  }
  return (
    <span className={cn('text-[10px] font-grotesk font-bold px-1.5 py-0.5 rounded-full border shrink-0', bg, ring, color)} title="Victoire estimée">
      {pct}%
    </span>
  );
}

const MASTERY_LABELS = {
  main: { label: 'Main', color: 'bg-green-win/20 text-green-win' },
  comfortable: { label: 'À l\'aise', color: 'bg-blue-info/20 text-blue-info' },
  beginner: { label: 'Débutant', color: 'bg-gold/20 text-gold' },
};

function ChampRec({ champion, onClick, variant = 'default', userPool = [], selectedRole, version }) {
  if (!champion) return null;
  const poolEntry = userPool.find(p => p.championId === champion.id);
  const mastery = poolEntry?.mastery || champion.poolMastery;
  const masteryInfo = mastery ? MASTERY_LABELS[mastery] : null;

  const variants = {
    best: 'glass-strong border-primary/40 glow-primary',
    default: 'glass border-border',
  };

  return (
    <div
      className={cn(
        'rounded-xl p-3 border cursor-pointer active:scale-[0.98] transition-all',
        variants[variant]
      )}
      onClick={() => onClick?.(champion)}
    >
      <div className="flex items-center gap-3">
        <ChampionIcon
          champion={champion}
          size={variant === 'best' ? 'lg' : 'md'}
          isPool={!!poolEntry}
          poolMastery={mastery}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-grotesk font-bold', variant === 'best' ? 'text-base' : 'text-sm')}>
              {champion.name}
            </span>
            {variant === 'best' && <Star className="w-3.5 h-3.5 text-gold fill-gold" />}
            {masteryInfo && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', masteryInfo.color)}>
                {masteryInfo.label}
              </span>
            )}
            {variant !== 'best' && champion.recommendScore != null && (
              <ScoreBadge score={champion.recommendScore} />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{champion.class}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{champion.damageType}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {champion.powerSpike === 'early' ? '⚡ Early' : champion.powerSpike === 'mid' ? '⚖️ Mid' : '📈 Late'}
            </span>
          </div>
          {version && (
            <div className="mt-1">
              <ChampionStatsBadge championId={champion.id} role={selectedRole} patch={version} />
            </div>
          )}
          {champion.reason && (
            <div className="mt-1.5">
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                variant === 'best'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-secondary text-muted-foreground'
              )}>
                ✦ {champion.reason}
              </span>
            </div>
          )}
        </div>
        {champion.recommendScore != null && (
          <ScoreBadge score={champion.recommendScore} large={variant === 'best'} />
        )}
      </div>
    </div>
  );
}

export default function RecommendationCard({ recommendations, onSelectChampion, userPool = [], selectedRole, version }) {
  const { best, alternatives, risky } = recommendations;

  const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Support' };

  return (
    <div className="space-y-3">
      {/* Best pick */}
      {best && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
            <Star className="w-3 h-3 text-gold" />
            Recommandé {selectedRole && <span className="text-primary normal-case">— {ROLE_LABELS[selectedRole]}</span>}
          </p>
          <ChampRec champion={best} onClick={onSelectChampion} variant="best" userPool={userPool} selectedRole={selectedRole} version={version} />
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
            Alternatives
          </p>
          <div className="space-y-2">
            {alternatives.slice(0, 3).map(c => (
              <ChampRec key={c.id} champion={c} onClick={onSelectChampion} userPool={userPool} selectedRole={selectedRole} version={version} />
            ))}
          </div>
        </div>
      )}

      {/* Risky picks */}
      {risky.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-gold" />
            Risqués
          </p>
          <div className="space-y-2">
            {risky.map(c => (
              <div key={c.id} className="glass rounded-xl p-2 border border-gold/20 opacity-75">
                <div className="flex items-center gap-2">
                  <ChampionIcon champion={c} size="sm" />
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">{c.name}</span>
                    <p className="text-[10px] text-gold">{c.riskReason || 'Déconseillé vs cette compo'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}