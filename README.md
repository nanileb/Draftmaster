# DraftMaster

Aide à la draft League of Legends, pensée pour le téléphone : recommandations de champions pendant la sélection, score de draft, duels de lane, conseils de partie (build, runes, plan de jeu), meilleures drafts du patch et optimisation d'équipe entre amis.

C'est la reconstruction de l'application Base44 « DraftMaster », **sans Base44** : React + Vite + Tailwind, sans compte et sans serveur à soi. Elle est **autonome** : ses statistiques (`public/data`), leur collecte (`tools/`, `.github/workflows/`) et son relais Riot (`worker/`) sont tous dans ce dépôt. Elle ne dépend plus de l'application Coach LoL (`lol-support-coach`), dont ces éléments ont été repris.

## Lancer en local

```bash
npm install
npm run dev          # http://localhost:5173/Draftmaster/
```

Node 18 ou plus récent (testé avec Node 22).

## Construire

```bash
npm run build        # écrit dist/ (et dist/404.html, copie de index.html)
npm run preview      # sert dist/ sur http://localhost:4173/Draftmaster/
```

`404.html` sert à GitHub Pages : un lien direct comme `/Draftmaster/team` ou un rechargement de page ouvre quand même l'application.

## Publier

`https://nanileb.github.io/Draftmaster/` (`base: '/Draftmaster/'` dans `vite.config.js`), republiée par `.github/workflows/deploy.yml` à chaque push sur `main`. Pour une autre adresse, changer `base` dans `vite.config.js`, ainsi que `start_url` et `scope` dans `public/manifest.webmanifest`.

Le relais Riot accepte l'origine `https://nanileb.github.io` (`ALLOWED_ORIGIN` dans `worker/wrangler.jsonc`).

## D'où viennent les données

| Donnée | Source | Où |
|---|---|---|
| Champions, objets, runes, sorts, icônes (fr_FR) | Data Dragon (Riot) | `src/hooks/useChampions.js`, `src/lib/dataLoader.js` |
| Builds, taux de victoire par poste, duos, ordre des sorts, runes, médianes Challenger | Parties Challenger / GM / Master, EUW + Corée, collectées par `tools/collect.mjs` | `public/data/builds.json` |
| Duels de lane (counters) | Lolalytics, Émeraude+, relevés à la main dans `data/counters-raw/` puis `tools/counters-build.mjs` | `public/data/counters.json` |
| Méta support / ADC, tiers support, engages, frontline, minuteurs | Notes de patch, à la main | `public/data/meta.json` |
| Historique de parties, rang | Relais Riot (`worker/`, Cloudflare) | `src/lib/riot.js` |
| Partie en cours (équipes, côté, chrono) | Route `/live` du relais Riot | `src/lib/liveGame.js` |
| Lane, chronologie (wards, objectifs), ordre d'achat | Port des onglets du coach LoL | `src/lib/inGame.js`, `src/components/ingame/` |
| Carte de la Faille (chronologie) | Minimap officielle (reprise du coach LoL) | `public/data/map-sr.jpg` |
| Combos de sorts (14 champions) | Export de l'ancienne application Base44 | `public/data/combos.json` |
| Meilleures drafts du patch | Calculées par `tools/best-drafts.mjs` | `public/data/best-drafts.json` |

`builds.json`, `counters.json` et `meta.json` sont publiés avec l'application et relus sans cache à chaque ouverture ; hors ligne, l'application reprend la dernière copie gardée dans le navigateur.

**Aucun taux de victoire n'est inventé.** Quand un duel ou un champion n'a pas assez de parties, l'écran le dit (« pas assez de parties », « estimation par classe »). Les pourcentages « victoire est. » sont des aides à la décision, bornés entre 42 et 58 %, et non des statistiques officielles.

## Ce qui est gardé dans le navigateur (localStorage)

Pas de compte. Tout reste sur l'appareil :

- `userChampionPool` : ton pool (champion, maîtrise, postes) ;
- `dm_players` : joueurs de l'optimisation d'équipe, dont les amis importés ;
- `dm_profile` : pseudo affiché quand tu partages ton pool ;
- `dm_settings` : serveur, adresse du relais Riot ;
- `dm_identity` : id de synchro (public, mis dans le lien de partage) et clé secrète du téléphone ; `dm_sync` : état du dernier envoi ;
- `dm_an` : résumés des parties analysées dans Profil (analyse complète et dernière game), `dm_an_role` : poste choisi pour l'analyse, `dm_profile_tab` : dernier onglet ouvert du profil ;
- `dm_team_live` : draft d'équipe suivie en direct (compo choisie, bans, picks des deux côtés), gardée 6 h ;
- `dm_game` : partie en cours (postes, champions, côté, chrono, drakes) pour la retrouver après un rechargement ; `dm_alerts` : son / vibration des alertes ;
- `dm_pc` : code du PC relié ; `dm_pc_n` : numéro de la dernière sélection des champions appliquée ;
- `riotId` ; copies de secours des statistiques (`dm_coach_*`, nom gardé pour ne pas perdre les copies existantes) et de Data Dragon.

Profil › Mon Pool › « Effacer mes données locales » vide tout.

### Partage du pool entre amis (sans compte)

Le pool est encodé dans un lien `…/Draftmaster/home?add=CODE`, avec un QR code. Quand l'ami ouvre le lien, DraftMaster propose de t'ajouter à ses joueurs sous ton pseudo. Le lien est une copie à l'instant du partage : si ton pool change, renvoie-le.

## Draft d'équipe en direct (onglet Équipe)

Une fois les 5 joueurs assignés, chaque compo proposée a un bouton « Jouer cette draft : suivi en direct ». Pendant la sélection : bans, champions verrouillés chez nous, picks adverses par poste. Dès qu'un champion prévu est banni, pris en face ou contré, l'écran le signale et propose le meilleur remplaçant du pool du joueur (même classement que les recommandations de l'Accueil). La barre du bas compare en permanence le score de draft et la victoire estimée des deux équipes. « Passer en jeu » ouvre le plan d'équipe : lanes gagnantes et à quel moment, risques de jungle, timing de la compo, rôle de chacun en teamfight, 5 contre 5 ou split push, condition de victoire. Logique : `src/lib/teamDraft.js` (réutilise `scoreChampion`, `calculateDraftScore`, `calculateWinProbability`, `analyzeLaneMatchup`, `laneAnalysis`).

## PC relié : sélection des champions remplie depuis le PC

Comme Porofessor : `public/pc/DraftMaster-PC.cmd` (page https://nanileb.github.io/Draftmaster/pc/) est un script Windows à double-cliquer, sans installation. Il lit en lecture seule l'API locale du client League (`/lol-gameflow/v1/gameflow-phase`, `/lol-champ-select/v1/session`) et envoie la sélection au relais (`POST /pc`, voir `worker/README.md`). Au premier lancement il affiche un code de 8 caractères (gardé dans `%APPDATA%\DraftMaster\pc.json`) et crée un raccourci « DraftMaster PC » sur le Bureau.

Sur le téléphone, Profil › PC relié : on tape le code une fois. Ensuite `src/lib/pcLink.js` relit le relais (1,5 s pendant une sélection, 5 s sinon, seulement app ouverte) ; `PcDraftSync` remplit la draft solo de l'Accueil (poste, alliés verrouillés, picks adverses, mon champion verrouillé) et `applyPcSelection` (`teamDraft.js`) la draft d'équipe en direct (bans, picks adverses, nos verrouillages). La saisie à la main reste possible : ce qui a été corrigé n'est pas défait, une nouvelle sélection repart de zéro.

## Meilleures drafts du patch

```bash
npm run best-drafts                                        # lit public/data/builds.json, counters.json, meta.json
```

Le script écrit `public/data/best-drafts.json` (10 compositions, une par style puis des variantes). Sans ce fichier, l'écran calcule les drafts dans le navigateur.

## Toujours au dernier patch (batchs quotidiens)

### Collecte des builds (`.github/workflows/collect.yml`)

Chaque jour à 9 h UTC, `tools/patch-check.mjs` compare le patch Data Dragon à celui de `public/data/builds.json`. Si les builds sont en retard, ou chaque mardi, ou à la main (Actions › Builds des meilleurs joueurs › Run workflow), `tools/collect.mjs` relit les parties classées Challenger / GM / Master d'EUW et de Corée par le relais Riot (aucune clé dans GitHub : la clé reste dans le relais), écrit `builds.json`, garde les parties déjà lues dans `data/samples.json.gz`, puis lance le batch ci-dessous. Une collecte complète prend plusieurs heures (limite de requêtes de la clé personnelle).

Quand `counters.json` ou `meta.json` sont en retard sur le patch, le même batch ouvre un ticket GitHub « Patch X : données à revoir à la main » (un seul par patch) :

- counters : relever les tableaux Lolalytics dans `data/counters-raw/*.txt` (format en tête de `tools/counters-build.mjs`), puis `node tools/counters-build.mjs` depuis la racine ;
- méta : modifier `public/data/meta.json` d'après les notes de patch (champs `patch` et `updated` compris).

Un push sur `main` republie le site ; le batch du soir recalcule ensuite les meilleures drafts.

### Meilleures drafts et nouveautés (`.github/workflows/patch-batch.yml`)

`.github/workflows/patch-batch.yml` tourne chaque jour à 10 h et 20 h UTC, plus chaque lundi à 8 h heure de Paris où les meilleures drafts sont recalculées même sans nouveau patch (et à la main : Actions › Batch dernier patch › Run workflow, case « force » pour tout refaire). Il ne fait qu'une vérification rapide, `tools/patch-check.mjs` : le patch Data Dragon et l'état de `public/data/builds.json`, `counters.json`, `meta.json` sont comparés à ceux enregistrés au dernier calcul (champ `inputs` de `best-drafts.json`). S'ils diffèrent, il recalcule les meilleures drafts, les nouveautés du patch (`tools/patch-notes.mjs`), enregistre les fichiers et republie le site.

Lu en direct à chaque ouverture, sans republication : champions, objets, runes, sorts et icônes (Data Dragon, dernière version), historique et partie en cours (relais Riot). Tier list, taux de victoire, synergies, counters et méta sont dans `public/data` : la collecte les republie elle-même. L'application affiche le patch de chaque source quand il diffère.

## Relais Riot

Le code du relais est dans `worker/` (aucune clé Riot dans l'application ni dans GitHub). Cloudflare le redéploie depuis ce dépôt (voir `worker/README.md`).

## Structure

```
src/
  lib/gameData.js         données partagées et calculs (score d'un champion, duels, type de dégâts, tiers) — sans React, utilisé aussi par tools/
  lib/championEngine.js   recommandations, score de draft, duels de lane, conseils de partie et build
  lib/bestDraftsEngine.js meilleures drafts et drafts d'équipe
  lib/dataLoader.js       chargement des données (public/data, Data Dragon)
  lib/localStore.js       stockage local, partage par lien
  lib/riot.js             appels au relais Riot
  pages/, components/     écrans (même apparence que l'application Base44)
public/                   manifest, service worker, icônes, data/ (builds, counters, meta, best-drafts, patch-notes, combos)
data/                     sources de la collecte : counters-raw/ (Lolalytics), samples.json.gz (parties déjà lues)
tools/                    collect.mjs, counters-build.mjs, best-drafts.mjs, patch-check.mjs, patch-notes.mjs, spa-404.mjs
worker/                   relais Riot (Cloudflare Worker)
```

## Synchro des pools entre amis (sans compte)

Le lien de partage (Profil › Partager) contient le pool **et** un id de synchro. Dès qu'on ouvre « Partager », le pool est envoyé au relais Cloudflare (`POST /pool`), puis renvoyé à chaque modification. Chez l'ami, les pools des amis reliés sont relus (`GET /pools`) à l'ouverture de l'app, au retour au premier plan et sur l'onglet Équipe. Code : `src/lib/poolSync.js`.

- Pas de mot de passe : la première écriture réserve l'id pour la clé secrète du téléphone (le relais n'en garde que l'empreinte SHA-256).
- Changer de téléphone : Partager › « Changer de téléphone » donne un code de récupération `DM-…` à coller sur le nouveau.
- « Supprimer mes données » efface aussi le pool sur le relais.
- Sans les routes `/pool` sur le relais, rien ne casse : l'ami garde la copie du pool contenue dans le lien.
- Les anciens liens (v1, sans id) restent acceptés mais ne se mettent pas à jour.

Le relais a besoin d'un espace Workers KV lié sous le nom `POOLS` (voir `worker/README.md`).
