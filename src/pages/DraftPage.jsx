import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, User, BarChart2, Lightbulb, BookOpen } from 'lucide-react';
import RoleTeamSlots from '@/components/RoleTeamSlots';
import TeamSlots from '@/components/TeamSlots';
import ChampionPicker from '@/components/ChampionPicker';
import RecommendationCard from '@/components/RecommendationCard';
import DraftScoreBar from '@/components/DraftScoreBar';
import SynergyPanel from '@/components/SynergyPanel';
import MatchupPanel from '@/components/MatchupPanel';
import { ROLE_LABELS } from '@/lib/championEngine';

function Swords({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" />
      <path d="M9.5 6.5L8 5" /><path d="M6.5 3.5L5 2" />
    </svg>
  );
}

const PICKER_MODES = { none: null, enemy: 'enemy', my: 'my' };

export default function DraftPage({
  champions,
  selectedRole,
  allyTeam,
  enemyTeam,
  allyByRole,
  enemyByRole,
  myChampion,
  recommendations,
  draftScore,
  winProbability,
  scoreInfo,
  allySynergies,
  winCondition,
  userPool,
  onBack,
  onSetAllyRole,
  onRemoveAllyRole,
  onAddEnemy,
  onRemoveEnemy,
  onSetMyPick,
  onGoToMatchup,
  canGoToMatchup,
  topPickChampions = [],
  version = null,
}) {
  const [pickerMode, setPickerMode] = useState(PICKER_MODES.none);
  const [activeTab, setActiveTab] = useState('reco');

  const excludeIds = [...allyTeam.map(c => c.id), ...enemyTeam.map(c => c.id)];

  const handlePickerSelect = (champion) => {
    if (pickerMode === PICKER_MODES.enemy) onAddEnemy(champion);
    else if (pickerMode === PICKER_MODES.my) onSetMyPick(champion);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-lg z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-grotesk font-semibold text-sm">{ROLE_LABELS[selectedRole]}</span>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
            {allyTeam.length + enemyTeam.length} picks
          </span>
        </div>
        <DraftScoreBar score={draftScore} winProbability={winProbability} scoreInfo={scoreInfo} compact />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-none px-4 pb-28" style={{paddingBottom: 'max(7rem, calc(7rem + env(safe-area-inset-bottom)))'}}>
        {/* Ally slots by role */}
        <div className="py-4 space-y-3">
          <RoleTeamSlots
            champions={champions}
            allyByRole={allyByRole}
            myRole={selectedRole}
            myChampion={myChampion}
            userPool={userPool}
            onSetAllyRole={onSetAllyRole}
            onRemoveAllyRole={onRemoveAllyRole}
            topPickNames={topPickChampions}
          />

          {/* Enemy slots (flat) */}
          <TeamSlots
            team={enemyTeam}
            onAdd={() => setPickerMode(PICKER_MODES.enemy)}
            onRemove={onRemoveEnemy}
            label="Ennemis"
            isAlly={false}
          />
        </div>

        {/* My pick */}
        {!myChampion ? (
          <button
            onClick={() => setPickerMode(PICKER_MODES.my)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-semibold mb-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            Choisir mon champion
          </button>
        ) : (
          <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={myChampion.iconUrl}
                alt={myChampion.name}
                className="w-10 h-10 rounded-lg"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div>
                <span className="text-sm font-semibold">Mon pick : <span className="text-primary">{myChampion.name}</span></span>
                <p className="text-xs text-muted-foreground">{myChampion.class} · {ROLE_LABELS[selectedRole]}</p>
              </div>
            </div>
            <button onClick={() => setPickerMode(PICKER_MODES.my)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg tap-target">
              Changer
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
          {[
            { key: 'reco', label: 'Reco', icon: Lightbulb },
            { key: 'score', label: 'Score', icon: BarChart2 },
            { key: 'matchup', label: 'Matchups', icon: Swords },
          ].map(tab => {
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

        <div className="space-y-3 animate-slide-up">
          {activeTab === 'reco' && (
            <>
              <RecommendationCard recommendations={recommendations} onSelectChampion={onSetMyPick} userPool={userPool} selectedRole={selectedRole} version={version} />
              {allySynergies.length > 0 && <SynergyPanel synergies={allySynergies} winCondition={winCondition} />}
            </>
          )}
          {activeTab === 'score' && (
            <DraftScoreBar score={draftScore} winProbability={winProbability} scoreInfo={scoreInfo} />
          )}
          {activeTab === 'matchup' && (
            <MatchupPanel allyTeam={allyTeam} enemyTeam={enemyTeam} selectedRole={selectedRole} allyByRole={allyByRole} enemyByRole={enemyByRole} />
          )}
        </div>
      </div>

      {/* CTA */}
      {canGoToMatchup && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-lg border-t border-border safe-bottom">
          <button
            onClick={onGoToMatchup}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-grotesk font-bold text-base glow-primary active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            Valider le draft & voir les matchups
          </button>
        </div>
      )}

      {/* Pickers */}
      {pickerMode !== PICKER_MODES.none && (
        <ChampionPicker
          champions={champions}
          role={pickerMode === PICKER_MODES.my ? selectedRole : null}
          lockedRole={false}
          onSelect={handlePickerSelect}
          onClose={() => setPickerMode(PICKER_MODES.none)}
          excludeIds={excludeIds}
          userPool={userPool}
          title={pickerMode === PICKER_MODES.my ? 'Mon Champion' : 'Pick Ennemi'}
          topPickNames={topPickChampions}
        />
      )}
    </div>
  );
}