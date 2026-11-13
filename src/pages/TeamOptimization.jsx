import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Users, Radio } from 'lucide-react';
import PlayerManagement from '@/components/TeamOptimization/PlayerManagement';
import TeamAssignment from '@/components/TeamOptimization/TeamAssignment';
import CustomDrafts from '@/components/TeamOptimization/CustomDrafts';
import { getPlayers, setPlayers as savePlayers, getPool, poolByRole, getProfile, newId } from '@/lib/localStore';
import { refreshFriends } from '@/lib/poolSync';
import TeamLiveDraft from '@/components/TeamOptimization/TeamLiveDraft';
import TeamGamePlan from '@/components/TeamOptimization/TeamGamePlan';
import { newLiveDraft, analyzeLiveDraft, applyPcSelection } from '@/lib/teamDraft';
import { usePcLink, readSelection } from '@/lib/pcLink';

// Draft d'équipe suivie en direct, gardée dans ce navigateur (un rechargement en pleine sélection ne perd rien)
const LIVE_KEY = 'dm_team_live';
const readLive = () => { try { const o = JSON.parse(localStorage.getItem(LIVE_KEY) || 'null'); return o && o.v === 1 && Date.now() - (o.startedAt || 0) < 6 * 3600 * 1000 ? o : null; } catch (e) { return null; } };
const writeLive = (o) => { try { if (o) localStorage.setItem(LIVE_KEY, JSON.stringify(o)); else localStorage.removeItem(LIVE_KEY); } catch (e) { /* stockage indisponible */ } };

// Joueurs et amis gardés dans ce navigateur. Les « amis » sont les joueurs importés par lien / QR de partage.
export default function TeamOptimization({ champions, version, onClose, embedded = false }) {
  const [all, setAll] = useState(() => getPlayers());
  const [teamAssignment, setTeamAssignment] = useState({});
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [activeTab, setActiveTab] = useState('team');
  const [userPool, setUserPool] = useState(null);
  const [live, setLive] = useState(() => readLive());
  useEffect(() => { writeLive(live); }, [live]);
  const byId = useMemo(() => Object.fromEntries((champions || []).map(c => [c.id, c])), [champions]);
  const liveOurs = useMemo(() => (live && live.view === 'game' ? analyzeLiveDraft(live, byId).ours : null), [live, byId]);
  // PC relié : bans, picks adverses et nos verrouillages se cochent tout seuls pendant la draft d'équipe en direct
  const pc = usePcLink();
  useEffect(() => {
    if (pc.status !== 'select' || !champions.length) return;
    const sel = readSelection(pc.data, champions);
    setLive(prev => (prev ? applyPcSelection(prev, sel, byId) : prev));
  }, [pc, byId]);
  const startLive = (draft) => setLive({ ...newLiveDraft(draft, teamAssignment, byId), view: 'draft' });
  const setView = (view) => setLive(prev => (prev ? { ...prev, view } : prev));
  const currentUser = { id: 'local', full_name: getProfile().name || 'Moi' };

  const players = all.filter(p => !p.imported);
  const friends = all.filter(p => p.imported);
  const persist = (list) => { setAll(list); savePlayers(list); };

  useEffect(() => {
    const loadPool = () => {
      const rolesMap = poolByRole(getPool(), champions);
      setUserPool(Object.values(rolesMap).some(arr => arr.length > 0) ? rolesMap : null);
    };
    if (champions.length > 0) { loadPool(); refreshFriends(champions); }
    const reload = () => { setAll(getPlayers()); loadPool(); };
    window.addEventListener('friends-updated', reload);
    window.addEventListener('pool-updated', reload);
    return () => { window.removeEventListener('friends-updated', reload); window.removeEventListener('pool-updated', reload); };
  }, [champions]);

  const unassign = (playerId) => {
    setTeamAssignment(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(role => { if (next[role]?.id === playerId || next[role]?.id === 'friend_' + playerId) delete next[role]; });
      return next;
    });
  };

  const handleAddPlayer = (playerData) => {
    persist([...all, { id: newId(), ...playerData }]);
    setShowPlayerForm(false);
  };

  const handleDeletePlayer = (playerId) => {
    persist(all.filter(p => p.id !== playerId));
    unassign(playerId);
  };

  const handleDeleteFriend = (friendId) => {
    persist(all.filter(p => p.id !== friendId));
    unassign(friendId);
  };

  const handleUpdatePlayer = (playerId, playerData) => {
    persist(all.map(p => p.id === playerId ? { ...p, ...playerData } : p));
    // Garder l'équipe en cours à jour : retirer le joueur des postes qu'il ne peut plus jouer
    setTeamAssignment(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(role => {
        if (next[role]?.id !== playerId) return;
        if (playerData.pools?.[role]?.length > 0) next[role] = { ...next[role], ...playerData };
        else delete next[role];
      });
      return next;
    });
  };

  const handleAssignPlayer = (role, player) => {
    setTeamAssignment(prev => ({
      ...prev,
      [role]: player
    }));
  };

  const handleRemoveFromRole = (role) => {
    setTeamAssignment(prev => {
      const newAssignment = { ...prev };
      delete newAssignment[role];
      return newAssignment;
    });
  };

  return (
    <div className={embedded ? "flex flex-col bg-background" : "fixed inset-0 z-50 flex flex-col bg-background animate-fade-in overflow-y-auto"}>
      {/* En-tête et onglets collés ensemble en haut (le contenu ne passe plus sous les onglets en défilant) */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {!embedded && (
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-grotesk font-bold text-base">Optimisation d'équipe</h2>
          <p className="text-xs text-muted-foreground">Patch {version}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-border">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'team'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Équipe
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'players'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="w-4 h-4 inline mr-1.5" />
          Joueurs
        </button>
      </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-10">
        {activeTab === 'team' ? (
          <div className="space-y-5">
            {live && (
              <button onClick={() => setView('draft')} className="w-full glass rounded-2xl border border-primary/40 p-3 flex items-center gap-3 text-left">
                <Radio className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Draft en direct : {live.name}</p>
                  <p className="text-xs text-muted-foreground">Touchez pour reprendre la sélection ou le plan de jeu</p>
                </div>
                <span onClick={(e) => { e.stopPropagation(); setLive(null); }} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary" role="button" aria-label="Terminer la draft en direct"><X className="w-4 h-4" /></span>
              </button>
            )}
            <TeamAssignment
              teamAssignment={teamAssignment}
              players={players}
              friends={friends}
              currentUser={currentUser}
              userPool={userPool}
              champions={champions}
              onAssign={handleAssignPlayer}
              onRemove={handleRemoveFromRole}
            />
            {Object.keys(teamAssignment).length === 5 && (
              <CustomDrafts
                teamAssignment={teamAssignment}
                champions={champions}
                version={version}
                onFollow={startLive}
              />
            )}
          </div>
        ) : (
          <PlayerManagement
            players={players}
            friends={friends}
            champions={champions}
            onAddPlayer={handleAddPlayer}
            onDeletePlayer={handleDeletePlayer}
            onUpdatePlayer={handleUpdatePlayer}
            onDeleteFriend={handleDeleteFriend}
            showForm={showPlayerForm}
            setShowForm={setShowPlayerForm}
          />
        )}
      </div>

      {live && live.view === 'draft' && (
        <TeamLiveDraft live={live} setLive={setLive} champions={champions} onClose={() => setView(null)} onGame={() => setView('game')} />
      )}
      {live && live.view === 'game' && liveOurs && (
        <TeamGamePlan live={live} ours={liveOurs} champions={champions} onBack={() => setView('draft')} />
      )}
    </div>
  );
}