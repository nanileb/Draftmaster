import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import AddFriendModal from '../AddFriendModal';

const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

function sinceText(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 2) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}
const ROLE_LABELS = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Milieu',
  ADC: 'ADC',
  SUPPORT: 'Soutien',
};

export default function PlayerManagement({
  players,
  champions,
  onAddPlayer,
  onDeletePlayer,
  onUpdatePlayer,
  onDeleteFriend,
  showForm,
  setShowForm,
  friends = [],
}) {
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [expandedFriends, setExpandedFriends] = useState({});

  const toggleFriendExpand = (friendId) => {
    setExpandedFriends(prev => ({ ...prev, [friendId]: !prev[friendId] }));
  };
  const emptyPools = () => ({ TOP: [], JUNGLE: [], MID: [], ADC: [], SUPPORT: [] });
  const [formData, setFormData] = useState({ name: '', pools: emptyPools() });
  // id du joueur en cours de modification (null = création)
  const [editingId, setEditingId] = useState(null);
  const formRef = useRef(null);
  useEffect(() => {
    if (editingId) formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [editingId]);
  const [selectedRole, setSelectedRole] = useState('TOP');
  const [expandedPlayers, setExpandedPlayers] = useState({});
  const [championSearch, setChampionSearch] = useState('');

  const handleAddChampion = (champName) => {
    if (!formData.pools[selectedRole].includes(champName)) {
      setFormData(prev => ({
        ...prev,
        pools: {
          ...prev.pools,
          [selectedRole]: [...prev.pools[selectedRole], champName],
        },
      }));
    }
  };

  const handleRemoveChampion = (champName) => {
    setFormData(prev => ({
      ...prev,
      pools: {
        ...prev.pools,
        [selectedRole]: prev.pools[selectedRole].filter(c => c !== champName),
      },
    }));
  };

  const resetForm = () => {
    setFormData({ name: '', pools: emptyPools() });
    setEditingId(null);
    setSelectedRole('TOP');
    setChampionSearch('');
    setShowForm(false);
  };

  const startEdit = (player) => {
    setFormData({ name: player.name, pools: { ...emptyPools(), ...(player.pools || {}) } });
    setEditingId(player.id);
    const firstRole = ROLES.find(r => player.pools?.[r]?.length > 0) || 'TOP';
    setSelectedRole(firstRole);
    setChampionSearch('');
    setShowForm(true);
  };

  const hasChampions = Object.values(formData.pools).some(pool => pool.length > 0);
  const canSubmit = formData.name.trim() && hasChampions;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const data = { name: formData.name.trim(), pools: formData.pools };
    if (editingId) onUpdatePlayer(editingId, data);
    else onAddPlayer(data);
    resetForm();
  };

  const togglePlayerExpand = (playerId) => {
    setExpandedPlayers(prev => ({
      ...prev,
      [playerId]: !prev[playerId],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      {showForm && (
        <div ref={formRef} className="glass rounded-2xl p-4 border border-border space-y-3 scroll-mt-28">
          <p className="font-grotesk font-bold text-sm text-foreground">
            {editingId ? `Modifier ${players.find(p => p.id === editingId)?.name || 'le joueur'}` : 'Nouveau joueur'}
          </p>
          <input
            type="text"
            placeholder="Nom du joueur"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground border border-border"
          />

          {/* Role selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Sélectionner un rôle:</p>
            <div className="grid grid-cols-5 gap-1.5">
              {ROLES.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    'text-xs py-1.5 rounded-lg font-semibold transition-all',
                    selectedRole === role
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {ROLE_LABELS[role]}
                  {formData.pools[role].length > 0 && (
                    <span className="block text-[10px] font-normal opacity-80">{formData.pools[role].length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              Champions {ROLE_LABELS[selectedRole]} ({formData.pools[selectedRole].length}):
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5 mb-3">
              {formData.pools[selectedRole].map(champ => (
                <div
                  key={champ}
                  className="flex items-center justify-between bg-primary/10 rounded-lg px-2.5 py-1.5 text-sm"
                >
                  <span className="text-foreground font-semibold">{champ}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChampion(champ)}
                    aria-label={`Retirer ${champ}`}
                    className="text-muted-foreground hover:text-destructive transition-colors px-2 -mr-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="Chercher un champion..."
              value={championSearch}
              onChange={(e) => setChampionSearch(e.target.value)}
              className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground border border-border mb-2"
            />

            <div className="grid grid-cols-3 gap-1.5">
              {champions?.filter(champ => champ.name.toLowerCase().includes(championSearch.toLowerCase())).map(champ => (
                <button
                  key={champ.id}
                  onClick={() => handleAddChampion(champ.name)}
                  disabled={formData.pools[selectedRole].includes(champ.name)}
                  className={cn(
                    'text-xs py-1.5 px-2 rounded-lg font-semibold transition-all',
                    formData.pools[selectedRole].includes(champ.name)
                      ? 'bg-primary/30 text-primary'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {champ.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {editingId ? 'Enregistrer' : 'Créer joueur'}
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-secondary text-foreground py-2 rounded-lg font-semibold text-sm hover:bg-secondary/80 transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!showForm && (
        <div className="space-y-2">
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary font-semibold text-sm hover:bg-primary/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer un joueur
          </button>
          <button
            onClick={() => setShowAddFriendModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-sm hover:bg-accent/10 transition-all"
          >
            <Users className="w-4 h-4" />
            Ajouter un ami
          </button>
        </div>
      )}

      {/* Friends Section */}
      {friends.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-grotesk font-bold text-sm text-foreground mb-2">Mes Amis ({friends.length})</h3>
          {friends.map(friend => (
            <div
              key={friend.id}
              className="glass rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => toggleFriendExpand(friend.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-all"
              >
                <div className="text-left">
                  <p className="font-grotesk font-bold text-foreground">{friend.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {friend.pools ? Object.values(friend.pools).reduce((sum, pool) => sum + pool.length, 0) : '—'} champions
                    {' · '}
                    {friend.syncId
                      ? <span className="text-accent">synchro auto{friend.syncedAt ? `, modifié ${sinceText(friend.syncedAt)}` : ''}</span>
                      : <span>copie de son lien</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  {expandedFriends[friend.id] ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {expandedFriends[friend.id] && (
                <div className="px-4 py-3 border-t border-border bg-secondary/20 space-y-2">
                  {friend.pools && ROLES.map(role => (
                    <div key={role}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{ROLE_LABELS[role]}:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {friend.pools[role]?.length > 0 ? (
                          friend.pools[role].map(champ => (
                            <span
                              key={champ}
                              className="text-xs bg-accent/20 text-accent px-2.5 py-1 rounded-lg font-semibold"
                            >
                              {champ}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!friend.syncId && (
                    <p className="text-[11px] text-muted-foreground pt-1">Ce pool ne se met pas à jour tout seul : demande à {friend.name} de te renvoyer son lien de partage depuis la dernière version de l'app, puis ajoute-le à nouveau.</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => onDeleteFriend(friend.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-destructive/10 text-destructive py-2 rounded-lg text-sm font-semibold hover:bg-destructive/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Players List */}
      <div className="space-y-2">
        {players.length === 0 && friends.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Aucun joueur ou ami</p>
            <p className="text-xs mt-1">Créez un joueur ou ajoutez un ami</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Aucun joueur créé</p>
          </div>
        ) : (
          players.map(player => (
            <div
              key={player.id}
              className="glass rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => togglePlayerExpand(player.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-all"
              >
                <div className="text-left">
                  <p className="font-grotesk font-bold text-foreground">{player.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.values(player.pools || {}).reduce((sum, pool) => sum + pool.length, 0)} champions
                  </p>
                </div>
                {expandedPlayers[player.id] ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedPlayers[player.id] && (
                <div className="px-4 py-3 border-t border-border bg-secondary/20 space-y-2">
                  {ROLES.map(role => (
                    <div key={role}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{ROLE_LABELS[role]}:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {player.pools?.[role]?.length > 0 ? (
                          player.pools[role].map(champ => (
                            <span
                              key={champ}
                              className="text-xs bg-primary/20 text-primary px-2.5 py-1 rounded-lg font-semibold"
                            >
                              {champ}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                   <div className="flex gap-2 pt-2">
                     <button
                       onClick={() => startEdit(player)}
                       className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary py-2 rounded-lg text-sm font-semibold hover:bg-primary/20 transition-all"
                     >
                       <Edit2 className="w-3.5 h-3.5" />
                       Modifier
                     </button>
                     <button
                       onClick={() => onDeletePlayer(player.id)}
                       className="flex-1 flex items-center justify-center gap-1.5 bg-destructive/10 text-destructive py-2 rounded-lg text-sm font-semibold hover:bg-destructive/20 transition-all"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                       Supprimer
                     </button>
                   </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriendModal && (
        <AddFriendModal
          champions={champions}
          onClose={() => setShowAddFriendModal(false)}
          onFriendAdded={() => {
            window.dispatchEvent(new CustomEvent('friends-updated'));
          }}
        />
      )}
    </div>
  );
}