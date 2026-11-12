import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SynergiesDetailPanel({ draft }) {
  const [expandedSections, setExpandedSections] = React.useState({
    engage: true,
    macro: true,
    botlane: true,
    teamfight: true,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!draft) return null;

  // Extraire les champions par rôle
  const championsByRole = {};
  if (Array.isArray(draft.champions)) {
    draft.champions.forEach(c => {
      championsByRole[c.role?.toLowerCase()] = c.name;
    });
  }

  const jgl = championsByRole.jungle;
  const top = championsByRole.top;
  const mid = championsByRole.mid;
  const adc = championsByRole.adc;
  const supp = championsByRole.support;

  const SectionHeader = ({ title, section, icon }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/40 border border-border hover:bg-secondary/60 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-grotesk font-semibold text-foreground">{title}</span>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );

  const Content = ({ children }) => (
    <div className="px-4 py-3 bg-secondary/20 rounded-lg text-sm text-foreground/85 leading-relaxed space-y-2">
      {children}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Engage par lane */}
      <div>
        <SectionHeader title="Engages par lane" section="engage" icon="⚔️" />
        {expandedSections.engage && (
          <Content>
            <div>
              <p className="font-semibold text-foreground mb-1">🗡️ Top Lane ({top}):</p>
              <p>Le {jgl} engage sur le {top} en utilisant les murs et passe par la jungle pour des ganks par derrière. Le {top} suit l'engage du jungle et crée de la présence en lane.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">⚡ Mid Lane ({mid}):</p>
              <p>Le {jgl} se positionne en contrôle de vue mid pour permettre des dives ou des engages rapides. Le {mid} initie quand le jungle est en position pour follow-up.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">🏹 Bot Lane ({adc}/{supp}):</p>
              <p>Le {jgl} arrive pour créer une surcharge numérique. Le {supp} initie l'engage pendant que le {adc} positionne les dégâts. Le {jgl} doit sécuriser le retrait post-engage.</p>
            </div>
          </Content>
        )}
      </div>

      {/* Macro */}
      <div>
        <SectionHeader title="Stratégie Macro" section="macro" icon="🗺️" />
        {expandedSections.macro && (
          <Content>
            <div>
              <p className="font-semibold text-foreground mb-1">📊 Rotation:</p>
              <p>Le {jgl} prioritize le contrôle des points clés (dragon, baron). Groupez-vous régulièrement avec le {adc}/{supp} pour les teamfights.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">🔄 Échanges de ressources:</p>
              <p>Sacrifiez les courtes skirmishes pour les gros objectifs. Utilisez {top} pour hold les lanes et créer de la pression pendant que le reste du team prend des murs/objectives.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">⏱️ Timing clés:</p>
              <p>Cherchez à exploiter les power spikes du team (après items clés). Groupez avant les importants Dragons/Baron spawns pour avoir la majorité numérique.</p>
            </div>
          </Content>
        )}
      </div>

      {/* Team fights */}
      <div>
        <SectionHeader title="Team Fights" section="teamfight" icon="🔥" />
        {expandedSections.teamfight && (
          <Content>
            <div>
              <p className="font-semibold text-foreground mb-1">🎯 Premier à engager:</p>
              <p>Le {supp} ou {jgl} ouvre le fight avec un engage durable. Votre {top} suit immédiatement pour du follow-up.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">🛡️ Positionnement:</p>
              <p>Le {adc} se positionne derrière en sécurité. Le {mid} gère le contrôle des zones (CC, dégâts AoE). Le {supp} peel pour le {adc}.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">💪 Win con du fight:</p>
              <p>Appliquez votre composition à travers {draft.winCondition || 'l\'avantage compositionnel'}. Focus les targets clés et finissez les kills rapidement.</p>
            </div>
          </Content>
        )}
      </div>

      {/* Synergies Bot Lane */}
      <div>
        <SectionHeader title="Synergies Bot Lane" section="botlane" icon="🤝" />
        {expandedSections.botlane && (
          <Content>
            <div>
              <p className="font-semibold text-foreground mb-1">💫 {adc} + {supp}:</p>
              <p>Cette paire crée un duo {draft.synergies?.[0] || 'synergique'}. Le support setup les kills pour l'ADC qui scale sur les items. Maintenez la wave au bon endroit pour éviter les ganks.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">🛡️ Durabilité & Damage:</p>
              <p>Le {supp} absorbe les dégâts grâce à {draft.strengths?.[0] || 'ses défenses'}. Le {adc} deals les dégâts continus. Ne forcez pas les fights si vous êtes en retard d'items.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">🎯 Trading & Poke:</p>
              <p>Positionnez-vous derrière les minions pour poke en sécurité. Utilisez la durée de vie du {supp} pour imposer votre presence en lane.</p>
            </div>
          </Content>
        )}
      </div>
    </div>
  );
}