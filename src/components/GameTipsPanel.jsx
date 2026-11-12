import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { generateGameTips, analyzeLaneMatchup } from '@/lib/championEngine';
import ChampionIcon from '@/components/ChampionIcon';
import { Clock, ShoppingBag, Diamond, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const TAB_CONFIG = [
  { key: 'phases', label: 'Phases', icon: Clock },
  { key: 'build', label: 'Build', icon: ShoppingBag },
  { key: 'runes', label: 'Runes', icon: Diamond },
  { key: 'mistakes', label: 'Erreurs', icon: AlertCircle },
];

const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jgl', MID: 'Mid', ADC: 'ADC', SUPPORT: 'Sup' };

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-1.5">{children}</div>}
    </div>
  );
}

// Bloc matchup vs un seul champion adverse
function MatchupBlock({ myChampion, opponent, role }) {
  const matchup = analyzeLaneMatchup(myChampion, opponent, role);
  if (!matchup) return null;

  const advColor =
    matchup.advantage === 'ally' ? 'text-green-win' :
    matchup.advantage === 'enemy' ? 'text-red-lose' :
    'text-gold';

  const advLabel =
    matchup.advantage === 'ally' ? '✅ Avantage' :
    matchup.advantage === 'enemy' ? '⚠️ Désavantage' :
    '⚖️ Neutre';

  return (
    <div className="glass rounded-xl p-3 space-y-2">
      {/* Champion header */}
      <div className="flex items-center gap-2.5">
        <ChampionIcon champion={opponent} size="sm" />
        <div>
          <p className="text-sm font-semibold">{opponent.name}</p>
          <p className="text-[10px] text-muted-foreground">{opponent.class}</p>
        </div>
        <span className={cn('ml-auto text-xs font-bold', advColor)}>{advLabel}</span>
      </div>
      {/* Tips */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{matchup.reason}</p>
        <p className="text-xs text-muted-foreground"><span className="text-foreground font-medium">Timing :</span> {matchup.timing}</p>
        <p className="text-xs text-primary font-medium">→ {matchup.advice}</p>
      </div>
    </div>
  );
}

export default function GameTipsPanel({ champion, selectedRole, laneOpponents = [], allyTeam, enemyTeam = [], userPool = [] }) {
  const [activeTab, setActiveTab] = useState('phases');

  const poolEntry = userPool.find(p => p.championId === champion?.id);
  const isBeginnerInPool = poolEntry?.mastery === 'beginner';

  // On passe le premier vis-à-vis pour les conseils généraux de lane
  const primaryOpponent = laneOpponents[0] || null;
  // Vis-à-vis direct en priorité (même poste), sinon le premier de la lane
  const primary = laneOpponents.find(o => o._role === selectedRole) || primaryOpponent;
  const tips = generateGameTips(champion, primary, allyTeam, isBeginnerInPool, selectedRole, enemyTeam);
  if (!tips) return null;

  const roleLabel = ROLE_LABELS[selectedRole] || selectedRole;

  return (
    <div className="space-y-4">
      {/* Champion header */}
      <div className="glass-strong rounded-2xl p-4 flex items-center gap-4">
        <ChampionIcon champion={champion} size="xl" />
        <div>
          <h2 className="font-grotesk font-bold text-xl">{champion.name}</h2>
          <p className="text-muted-foreground text-sm capitalize">{champion.title}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{champion.class}</span>
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{champion.damageType}</span>
            {roleLabel && (
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{roleLabel}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all text-xs font-medium',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Phases tab */}
      {activeTab === 'phases' && (
        <div className="space-y-3 animate-slide-up">

          {/* Matchups vs vis-à-vis */}
          {laneOpponents.length > 0 && (
            <Section title={`⚔️ Vs ${laneOpponents.map(o => o.name).join(' & ')}`} defaultOpen={true}>
              <div className="space-y-2 pt-1">
                {laneOpponents.map(opp => (
                  <MatchupBlock key={opp.id} myChampion={champion} opponent={opp} role={selectedRole} />
                ))}
              </div>
            </Section>
          )}

          {tips.lane?.length > 0 && (
            <Section title="🛡️ Plan de lane" defaultOpen={true}>
              {tips.lane.map((tip, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </Section>
          )}

          <Section title="⚡ Début de partie" defaultOpen={true}>
            {tips.early.map((tip, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            ))}
          </Section>
          <Section title="⚖️ Milieu de partie">
            {tips.mid.map((tip, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gold mt-0.5">•</span>
                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            ))}
          </Section>
          <Section title="📈 Fin de partie">
            {tips.late.map((tip, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-green-win mt-0.5">•</span>
                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            ))}
          </Section>
        </div>
      )}

      {/* Build tab */}
      {activeTab === 'build' && (
        <div className="space-y-3 animate-slide-up">
          <div className="glass rounded-xl p-4 space-y-3">
            {tips.build.source && <p className="text-[11px] text-muted-foreground italic">{tips.build.source}</p>}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Départ</p>
              <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-lg inline-block">
                {tips.build.starter}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Objets principaux</p>
              <div className="flex flex-wrap gap-2">
                {tips.build.core.map((item, i) => (
                  <span key={i} className="text-sm font-medium bg-gold/10 text-gold px-3 py-1.5 rounded-lg">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Situationnels</p>
              <div className="flex flex-wrap gap-2">
                {tips.build.situational.map((item, i) => (
                  <span key={i} className="text-sm text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg">
                    {item}
                  </span>
                ))}
                {tips.build.situational.length === 0 && (
                  <span className="text-xs text-muted-foreground">Rien de particulier contre cette compo : le build principal suffit.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Runes tab */}
      {activeTab === 'runes' && (
        <div className="space-y-3 animate-slide-up">
          <div className="glass rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Keystone</p>
              <span className="text-base font-bold text-primary">{tips.runes.keystone}</span>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Primaire</p>
                <span className="text-sm font-medium">{tips.runes.primary}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Secondaire</p>
                <span className="text-sm font-medium">{tips.runes.secondary}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">{tips.runes.description}</p>
          </div>
        </div>
      )}

      {/* Mistakes tab */}
      {activeTab === 'mistakes' && (
        <div className="space-y-2 animate-slide-up">
          {tips.commonMistakes.map((mistake, i) => (
            <div key={i} className="glass rounded-xl p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-lose flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{mistake}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}