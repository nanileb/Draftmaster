import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { generateGameTips } from '@/lib/championEngine';
import ChampionIcon from '@/components/ChampionIcon';
import { Clock, ShoppingBag, AlertCircle, ChevronDown, ChevronUp, Swords, ListChecks } from 'lucide-react';
import LanePanel from '@/components/ingame/LanePanel';
import BuildPanel from '@/components/ingame/BuildPanel';
import TimingPanel from '@/components/ingame/TimingPanel';
import { LANE_TAB } from '@/lib/inGame';

// Onglets en jeu : Lane et Timing repris du coach LoL, Build au design du coach, Plan = conseils DraftMaster par phase
const TAB_CONFIG = [
  { key: 'lane', label: 'Lane', icon: Swords },
  { key: 'build', label: 'Build', icon: ShoppingBag },
  { key: 'timing', label: 'Timing', icon: Clock },
  { key: 'plan', label: 'Plan', icon: ListChecks },
];
const TAB_KEY = 'dm_tips_tab';
const readTab = () => { try { const v = localStorage.getItem(TAB_KEY); return TAB_CONFIG.some(t => t.key === v) ? v : 'lane'; } catch (e) { return 'lane'; } };

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

export default function GameTipsPanel({ champion, selectedRole, laneOpponents = [], allyTeam, enemyTeam = [], userPool = [], match, clock, side, setSide, kills, setKills }) {
  const [activeTab, setTab] = useState(readTab);
  const setActiveTab = (k) => { setTab(k); try { localStorage.setItem(TAB_KEY, k); } catch (e) { /* rien */ } };

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
                'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg transition-all text-xs font-medium',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.key === 'lane' ? (LANE_TAB[selectedRole] || tab.label) : tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'lane' && (
        <div className="animate-slide-up">
          {match ? <LanePanel match={match} build={tips.build && tips.build.ids} /> : null}
        </div>
      )}

      {activeTab === 'build' && (
        <div className="animate-slide-up">
          <BuildPanel tips={tips} champion={champion} role={selectedRole} match={match} />
        </div>
      )}

      {activeTab === 'timing' && clock && (
        <div className="animate-slide-up">
          <TimingPanel clock={clock} match={match} side={side} setSide={setSide} kills={kills} setKills={setKills} role={selectedRole} />
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="space-y-3 animate-slide-up">
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
          <Section title="🚫 Erreurs fréquentes">
            {tips.commonMistakes.map((mistake, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-lose flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{mistake}</p>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}