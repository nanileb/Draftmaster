# DraftMaster

Aide à la draft League of Legends, pensée pour le téléphone : recommandations de champions pendant la sélection, score de draft, duels de lane, conseils de partie (build, runes, plan de jeu), meilleures drafts du patch et optimisation d'équipe entre amis.

C'est la reconstruction de l'application Base44 « DraftMaster », **sans Base44** : React + Vite + Tailwind, sans compte et sans serveur à soi. Elle reste une application **séparée** de Coach Support, mais elle lit ses données et passe par son relais Riot.

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

## Publier (non fait : à décider par Anthony)

L'application est prévue pour `https://nanileb.github.io/Draftmaster/` (`base: '/Draftmaster/'` dans `vite.config.js`).

1. Créer un dépôt `draftmaster` sur le compte `nanileb` et y mettre le contenu de ce dossier (sans `node_modules/` ni `dist/`).
2. `npm run build`, puis publier `dist/` sur GitHub Pages (branche `gh-pages`, ou une action « Deploy to Pages »).
3. Pour une autre adresse, changer `base` dans `vite.config.js`, ainsi que `start_url` et `scope` dans `public/manifest.webmanifest`.

Comme l'application est sur la même origine que le coach (`https://nanileb.github.io`), le relais Riot l'accepte sans rien changer à son `ALLOWED_ORIGIN`.

## D'où viennent les données

| Donnée | Source | Où |
|---|---|---|
| Champions, objets, runes, sorts, icônes (fr_FR) | Data Dragon (Riot) | `src/hooks/useChampions.js`, `src/lib/dataLoader.js` |
| Builds, taux de victoire par poste, duos, ordre des sorts, runes, médianes Challenger | `builds.json` du coach (parties Challenger / GM / Master, EUW + Corée) | adresse publique du coach, réglable dans Profil › Réglages |
| Duels de lane (counters) | `counters.json` du coach (Lolalytics, Émeraude+) | idem |
| Méta support / ADC, tiers support, engages, frontline, minuteurs | `meta.json` du coach | idem |
| Historique de parties, rang | Relais Riot du coach (worker Cloudflare) | `src/lib/riot.js` |
| Combos de sorts (14 champions) | Export de l'ancienne application Base44 | `public/data/combos.json` |
| Meilleures drafts du patch | Calculées par `tools/best-drafts.mjs` | `public/data/best-drafts.json` |

Adresse par défaut des données du coach : `https://nanileb.github.io/lol-support-coach/`. Si elle ne répond pas, l'application reprend la dernière copie gardée dans le navigateur.

**Aucun taux de victoire n'est inventé.** Quand un duel ou un champion n'a pas assez de parties, l'écran le dit (« pas assez de parties », « estimation par classe »). Les pourcentages « victoire est. » sont des aides à la décision, bornés entre 42 et 58 %, et non des statistiques officielles.

## Ce qui est gardé dans le navigateur (localStorage)

Pas de compte. Tout reste sur l'appareil :

- `userChampionPool` : ton pool (champion, maîtrise, postes) ;
- `dm_players` : joueurs de l'optimisation d'équipe, dont les amis importés ;
- `dm_profile` : pseudo affiché quand tu partages ton pool ;
- `dm_settings` : serveur, adresse du relais Riot, adresse des données du coach ;
- `dm_identity` : id de synchro (public, mis dans le lien de partage) et clé secrète du téléphone ; `dm_sync` : état du dernier envoi ;
- `dm_an` : résumés des parties analysées dans Profil (analyse complète et dernière game), `dm_an_role` : poste choisi pour l'analyse, `dm_profile_tab` : dernier onglet ouvert du profil ;
- `riotId` ; copies de secours des données du coach (`dm_coach_*`) et de Data Dragon.

Profil › Mon Pool › « Effacer mes données locales » vide tout.

### Partage du pool entre amis (sans compte)

Le pool est encodé dans un lien `…/Draftmaster/home?add=CODE`, avec un QR code. Quand l'ami ouvre le lien, DraftMaster propose de t'ajouter à ses joueurs sous ton pseudo. Le lien est une copie à l'instant du partage : si ton pool change, renvoie-le.

## Meilleures drafts du patch

```bash
npm run best-drafts                                        # lit les données publiques du coach
COACH_DIR=../lol-support-coach npm run best-drafts         # ou une copie locale
```

Le script écrit `public/data/best-drafts.json` (10 compositions, une par style puis des variantes). Sans ce fichier, l'écran calcule les drafts dans le navigateur.

`.github/workflows/best-drafts.yml` fait la même chose sur GitHub Actions. Il est **prêt mais pas activé** : seul le lancement à la main est possible. Pour le lancer chaque jour, décommenter le bloc `schedule`.

## Relais Riot

DraftMaster utilise **le même worker** que le coach (aucune clé Riot dans l'application). Deux routes facultatives sont proposées dans `../worker-patch/` (`/match?lite=2` et `/rank`). Sans elles, l'historique marche quand même, en plus lent et sans le rang.

## Structure

```
src/
  lib/gameData.js         données partagées et calculs (score d'un champion, duels, type de dégâts, tiers) — sans React, utilisé aussi par tools/
  lib/championEngine.js   recommandations, score de draft, duels de lane, conseils de partie et build
  lib/bestDraftsEngine.js meilleures drafts et drafts d'équipe
  lib/dataLoader.js       chargement des données (coach, Data Dragon, fichiers locaux)
  lib/localStore.js       stockage local, partage par lien
  lib/riot.js             appels au relais Riot
  pages/, components/     écrans (même apparence que l'application Base44)
public/                   manifest, service worker, icônes, data/
tools/                    best-drafts.mjs, spa-404.mjs
```

## Synchro des pools entre amis (sans compte)

Le lien de partage (Profil › Partager) contient le pool **et** un id de synchro. Dès qu'on ouvre « Partager », le pool est envoyé au relais Cloudflare (`POST /pool`), puis renvoyé à chaque modification. Chez l'ami, les pools des amis reliés sont relus (`GET /pools`) à l'ouverture de l'app, au retour au premier plan et sur l'onglet Équipe. Code : `src/lib/poolSync.js`.

- Pas de mot de passe : la première écriture réserve l'id pour la clé secrète du téléphone (le relais n'en garde que l'empreinte SHA-256).
- Changer de téléphone : Partager › « Changer de téléphone » donne un code de récupération `DM-…` à coller sur le nouveau.
- « Supprimer mes données » efface aussi le pool sur le relais.
- Sans les routes `/pool` sur le relais, rien ne casse : l'ami garde la copie du pool contenue dans le lien.
- Les anciens liens (v1, sans id) restent acceptés mais ne se mettent pas à jour.

Le relais a besoin d'un espace Workers KV lié sous le nom `POOLS` (voir `docs/worker-patch/NOTE.md`).
