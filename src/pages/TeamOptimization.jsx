import React, { useState, useEffect } from 'react';
import { X, Plus, Users } from 'lucide-react';
import PlayerManagement from '@/components/TeamOptimization/PlayerManagement';
import TeamAssignment from '@/components/TeamOptimization/TeamAssignment';
import CustomDrafts from '@/components/TeamOptimization/CustomDrafts';
import { getPlayers, setPlayers as savePlayers, getPool, poolByRole, getProfile, newId } from '@/lib/localStore';

// Joueurs et amis gardés dans ce navigateur. Les « amis » sont les joueurs importés par lien / QR de partage.
export default function TeamOptimization({ champions, version, onClose, embedded = false }) {
  const [all, setAll] = useState(() => getPlayers());
  const [teamAssignment, setTeamAssignment] = useState({});
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [activeTab, setActiveTab] = useState('team');
  const [userPool, setUserPool] = useState(null);
  const currentUser = { id: 'local', full_name: getProfile().name || 'Moi' };

  const players = all.filter(p => !p.imported);
  const friends = all.filter(p => p.imported);
  const persist = (list) => { setAll(list); savePlayers(list); };

  useEffect(() => {
    const loadPool = () => {
      const rolesMap = poolByRole(getPool(), champions);
      setUserPool(Object.values(rolesMap).some(arr => arr.length > 0) ? rolesMap : null);
    };
    if (champions.length > 0) loadPool();
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
    <div className={embedded ? "flex flex-col min-h-screen bg-background" : "fixed inset-0 z-50 flex flex-col bg-background animate-fade-in overflow-y-auto"}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-lg">
        {!embedded && (
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-secondary tap-target">
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-grotesk font-bold text-base">Optimisation d'équipe</h2>
          <p className="text-xs text-muted-foreground">Patch {version}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-border sticky top-12 bg-background/80 backdrop-blur-lg">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-10">
        {activeTab === 'team' ? (
          <div className="space-y-5">
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
    </div>
  );
}