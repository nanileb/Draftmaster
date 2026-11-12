# DraftMaster : inventaire de la reconstruction hors Base44

Date : 11/11/2026. Application Base44 d'origine : « DraftMaster » (id `69f9bcf5b8767b1d1fde1927`), lue **en lecture seule**. Rien n'a été modifié sur Base44, rien n'a été poussé, publié ni déployé.

Contenu de ce dossier :

| Dossier | Contenu |
|---|---|
| `app/` | La nouvelle application (React + Vite + Tailwind, sans Base44). Voir `app/README.md`. |
| `base44-original/` | Copie complète du code Base44 (avec `HISTORIQUE-COMMITS.txt` : 203 commits, tous intitulés « File changes »). |
| `data-base44/` | Export JSON des entités utiles (voir « Données récupérées »). |
| `worker-patch/` | Patch compatible du relais Riot du coach (2 routes ajoutées) et sa note. |
| `captures/` | 33 captures Chromium en taille mobile (390 × 844, échelle 1). |

---

## 1. Écrans et fonctions : ce qu'ils deviennent

### Écrans

| Écran Base44 | Dans la nouvelle application | Changement |
|---|---|---|
| Accueil, choix du poste (`RoleSelect`) | Identique | Le bouton de partage ouvre le partage par lien et QR code (plus de compte). Les champions ne sont plus chargés deux fois. |
| Draft (`DraftPage` : alliés par poste, ennemis, mon pick, onglets Reco / Score / Matchups) | Identique | Recommandations, score et victoire estimée calculés avec les données réelles du coach. Les matchups sont maintenant appariés **par poste** (avant : par ordre de sélection). |
| Postes ennemis (`MatchupAssignment`) | Identique | Les ennemis sont placés d'office à leur poste le plus joué (données builds), modifiables. |
| Conseils de jeu (`TipsPage` : Phases, Build, Runes, Erreurs) | Identique, plus un bloc « Plan de lane » | Build, runes et sorts = build le plus joué chez les Challenger / GM / Master pour ce champion à ce poste, avec la source affichée. Objets de situation selon la vraie compo adverse. |
| Meilleures drafts (`BestDrafts`, `BestDraftDetail`) | Identique | Fichier `data/best-drafts.json` calculé par `tools/best-drafts.mjs`, sinon calcul dans le navigateur. Plus d'IA. Source et date affichées. |
| Champions (`ChampionsOverview` + fiche) | Identique | Tiers et taux de victoire tirés de `builds.json` (lissés quand l'échantillon est petit). Fiche : sorts Data Dragon fr_FR, ordre de montée réel, counters avec leur %, synergies de duo réelles. Plus d'IA. |
| Mon Pool (`PoolManager`) | Identique | Enregistré dans le navigateur. « Supprimer mon compte » devient « Effacer mes données locales ». |
| Profil (`ProfilePage` : Riot ID, rang, historique, analyse) | Identique, plus un bloc « Réglages » | Historique et rang via le relais Riot du coach. L'analyse « IA » est remplacée par une comparaison chiffrée aux médianes Challenger du même poste et des suggestions de champions tirées des données. |
| Équipe (`TeamOptimization` : joueurs, amis, assignation, drafts personnalisées) | Identique | Joueurs gardés dans le navigateur ; amis = joueurs importés par lien. Drafts personnalisées calculées depuis les pools (plus d'IA). |
| Connexion, consentement OAuth, « utilisateur non inscrit » | Supprimés | Pas de compte. |
| Scanner un QR dans l'application (`ScanQRCode`) | Supprimé | Il était déjà désactivé (écran noir signalé dans le chat). L'appareil photo du téléphone lit le QR et ouvre le lien. |
| Page 404 | En français, au thème de l'application | |

### Fonctions serveur Base44

| Fonction | Devient |
|---|---|
| `riotProxy` | Data Dragon lu directement par le navigateur (pas besoin de relais). |
| `getMatchHistory` | `src/lib/riot.js` → relais du coach : `/matches`, puis `/match?lite=2` et `/rank` (routes du patch, voir `worker-patch/NOTE.md`). |
| `fetchChampionStats`, `fetchAllChampionStats` (tiers et taux générés par IA ou scrapés) | `championStat()` dans `gameData.js`, depuis `builds.json` et `meta.json`. |
| `getChampionDetails` (counters, combos, ordre des sorts par IA) | `championDetails()` + sorts Data Dragon + `data/combos.json`. |
| `preloadAllSpells` | Sorts chargés à la demande depuis Data Dragon fr_FR, avec cache. |
| `bestDrafts`, `refreshPatchDrafts`, `cleanupOldDrafts` + workflow quotidien | `tools/best-drafts.mjs` + `.github/workflows/best-drafts.yml` (prêt, **pas activé**). |
| `generateCustomDrafts` (IA) | `computeCustomDrafts()` dans `bestDraftsEngine.js`. |
| `generateUserCode`, `addFriendByCode`, `searchUserByEmail`, `getFriendsWithPools`, `updateFriendPools`, `deleteFriendBidirectional` | Partage sans compte : lien `…/home?add=CODE` + QR code ; l'ami est ajouté à « mes joueurs ». |
| `debugLolalytics` | Supprimée (outil de mise au point). |
| Appel IA de l'onglet Analyse (`InvokeLLM`) | Règles chiffrées (médianes `builds.targets`) dans `AnalysisTab.jsx`. |

### Entités

| Entité | Devient |
|---|---|
| `ChampionStats`, `BestDraft`, `ChampionSpells` | Données du coach + Data Dragon + fichiers `public/data/`. |
| `Player` (pool) | `localStorage` (`userChampionPool`). |
| `Friend`, `User` | Pas de compte : joueurs importés gardés dans `dm_players`. |

---

## 2. Règles et intentions tirées du chat Base44

Le chat complet n'a pas pu être lu d'un bloc : l'API renvoie `{"truncated": true}` au-delà d'environ 10 messages par page. Les pages ont donc été lues par échantillons. Il peut manquer des demandes intermédiaires.

Cahier des charges initial (1er message) :
- Aide à la sélection des champions, pensée **mobile d'abord**.
- Pool **facultatif** (Main / À l'aise / Débutant) qui ne doit **jamais empêcher** de recommander le meilleur choix. → Respecté : bonus de maîtrise (+1,5 main, +1 à l'aise) ajouté au score réel, jamais de filtre.
- Recalcul en direct à chaque pick. → Respecté.
- Score de draft sur 100 (80+ très favorable, 60-79 équilibrée, moins de 60 risquée). → Gardé.
- Le % de victoire est une aide à la décision, **pas une statistique officielle**. → Affiché « est. », borné à [42 ; 58] %.
- 100 % des champions via Data Dragon. → 173 champions chargés au patch 16.22.1.
- Conseils de partie : plan, build, runes, erreurs fréquentes ; conseils prudents pour un champion « Débutant ». → Gardé.
- Réponses aux questions de cadrage : joueurs solo (usage personnel), logique algorithmique pure, style moderne et épuré. → La « logique algorithmique pure » va dans le sens de retirer l'IA, ce qui est fait.

Demandes suivantes vues dans le chat :
- Partager son profil par QR code ou lien ; l'ouvrir ajoute le joueur avec tout son pool ; on ne saisit qu'un pseudo. → Fait, sans compte.
- Le bouton QR doit être **physiquement sous** le bouton de partage. → Le QR code s'affiche sous les boutons Copier / Partager.
- La caméra du scanner QR donnait un écran noir. → Le scanner intégré est retiré ; l'appareil photo du téléphone suffit.
- Amitié à sens unique, sans acceptation. → C'est le fonctionnement du lien.
- Plusieurs remises à zéro de la base d'amis. → Sans objet (pas de base).
- Reprendre les tier lists de u.gg (bloqué par reCAPTCHA, Lolalytics scrapé à la place). → Remplacé par les données du coach.
- Précharger les sorts des 172 champions. → Chargement à la demande depuis Data Dragon.

Défauts de l'original corrigés au passage : les notifications (sonner) n'étaient jamais affichées ; le pool était rangé sous deux clés différentes (`userChampionPool` et `draftmaster_pool`, la seconde est migrée) ; `DraftSuggestions` et `OptimizedDraftSuggestion` n'étaient jamais utilisés ; les matchups étaient appariés par ordre de sélection.

---

## 3. Données récupérées (`data-base44/`)

| Fichier | Contenu | Utilisé ? |
|---|---|---|
| `BestDraft.json` | 120 drafts (10 par patch, de 16.10.1 à 16.22.1), **générées par IA** ; champs `created_by` retirés. | Non (archive). |
| `ChampionStats-16.22.json` | 136 fiches du patch 16.22 (418 au total, tous patchs) ; seulement 8 avec des counters, aucune avec un ordre de sorts. | Non : remplacé par les données du coach. |
| `ChampionSpells.json` | 172 champions ; 14 avec des combos. | Oui : les 14 combos sont dans `app/public/data/combos.json` (textes d'origine, **non vérifiés**). |
| Player / Friend / User | **Comptés seulement** : 1 Player, 5 Friend, 7 User. Rien exporté (données personnelles). | — |

**Secrets** : aucune clé ni aucun secret dans le code de l'application. En revanche, l'environnement de la sandbox Base44 (`run_command`) expose des identifiants AWS dans ses variables d'environnement. Ils n'ont été ni utilisés ni recopiés nulle part. À signaler à Base44 si besoin.

---

## 4. Corrections d'audit appliquées (`/mnt/project-files/audit-logique/`)

Elles ont été écrites pour le coach ; voici celles qui concernent la draft et leur traduction dans DraftMaster.

### `corrections.md`

| N° | Correction | État |
|---|---|---|
| 1 | Atlas au départ de tous les supports | ✅ |
| 2 | Pas d'objet de contre contre l'adversaire direct en ADC et en jungle | ✅ |
| 3 | Pas d'objet de situation sans la menace en face | ✅ |
| 4 | Objet contre les plongeurs selon leurs vrais dégâts | ✅ |
| 5 | Défense garantie contre une équipe très AD ou très AP | ✅ |
| 6 | Galio (et les tanks magiques) comptés AP | ✅ |
| 7 | Moins de poids aux petits échantillons, scores réalistes | ✅ (lissage + bornes [42 ; 58] %) |
| 8 | Besoins de compo qui pèsent vraiment | ✅ |
| 9 | Pick à l'aveugle | ✅ |
| 10 | Botlane et draft d'accord | ✅ en partie : le verdict de duel vient des données réelles (counters, puis duels Challenger ≥ 20 parties) ; l'estimation par profil ne sert qu'à défaut et le dit. |
| 11 | Plus de parties | Sans objet : c'est la collecte du coach. |
| 12 | Conseils de matchup top / mid | ✅ (type de duel, un seul plan cohérent) |
| 13 | Vraie aide de jungle | ✅ |
| 14 | Heure des crabes | ✅ tirée de `meta.json` (2:55), **toujours à vérifier** sur les notes de patch. |
| 15 | Analyse post-game | Non appliquée telle quelle (DraftMaster n'a pas d'analyse post-game). L'onglet Analyse du profil en reprend l'esprit : comparaison aux médianes Challenger, jamais un reproche brut. |

### `corrections-recette2.md`

| N° | Correction | État |
|---|---|---|
| 1 | Pondérer chaque paire « avec / contre » selon l'interaction réelle | ✅ (poids 1 / 0,5 / 0,25) |
| 2 | Verdict de duel depuis les données de matchups | ✅ |
| 3 | Objet « contre ton adversaire » : 20 parties minimum | ✅ |
| 4 | Un seul plan de lane, sans contradiction | ✅ |
| 5 | Libellé du build (« Challenger / GM / Master », même nombre de parties que le classement) | ✅ |
| 6 | Analyse post-game | Sans objet (voir n° 15). |
| 7 | Vérifications sur les notes de patch | Crabes : signalé. Bottes de niveau 3 : non affichées par DraftMaster. |

### `corrections-mega-recette.md`

| N° | Correction | État |
|---|---|---|
| C1 | Type de dégâts depuis les achats réels | ✅ |
| C2 | Clés de champion normalisées (Fiddlesticks) | ✅ |
| C3 | Téléportation seulement si le build la prend | ✅ |
| C4 | Passifs uniques exclusifs dans le build | ✅ |
| C5 | Pick à l'aveugle dès le 1er choix | ✅ |
| C6 | Pas de conseil « niveau 1 » tiré du % global | ✅ |
| C7 | Bottes selon la part de la menace | ✅ |
| C8 | Une seule variante de build | ✅ |
| C9 | Chemin de jungle avec les alliés connus | ✅ |
| C10 | Plaques et chronologie ADC | ✅ pour l'ADC (plus de Héraut, conseil de son poste à la place). DraftMaster n'a pas la phrase des plaques en cause. |
| C11 | Counters manquants | À constater côté coach : avec le `counters.json` actuel, 1 seul couple sur 202 (≥ 50 parties) n'a pas de counters (Vladimir top). Quand un duel manque, DraftMaster le dit. |

---

## 5. Choix à valider par Anthony

1. **Amis sans compte (choix fait)** : le pool voyage dans un lien (et son QR code). L'ami l'ajoute à « mes joueurs » sous le pseudo de son choix.
   - Avantages : aucun serveur, aucune donnée personnelle stockée, rien à maintenir.
   - Limite : c'est une copie. Si le pool change, il faut renvoyer le lien. Pas de liste d'amis synchronisée.
   - **Alternative** : une petite base sur le worker existant (Cloudflare **D1** ou **KV**) avec un code par joueur. Il faudrait des routes `/pool` en lecture / écriture, une protection contre l'écriture par un tiers (jeton secret par joueur) et une gestion des données personnelles (RGPD).
2. **Patch du worker** : 2 routes facultatives (`/match?lite=2`, `/rank`) dans `worker-patch/`. Sans elles, l'historique marche mais coûte 2 appels Riot par partie, sans pseudos ni rang.
3. **Adresse de publication** : `https://nanileb.github.io/draftmaster/` (dépôt à créer). La même origine que le coach évite de toucher à `ALLOWED_ORIGIN`.
4. **Workflow des meilleures drafts** : prêt mais en lancement manuel seulement. À activer (cron) si le fichier doit suivre chaque jour les données du coach.
5. **Combos des 14 champions** : textes repris de Base44 (probablement écrits par IA). À garder, à relire ou à retirer.
6. **Icône** : nouvelle icône (deux colonnes de picks bleus et rouges avec un losange violet), distincte du bouclier du coach.
7. **Score de draft** : c'est la note de structure de compo de l'original (engage, frontline, dégâts mixtes…) plus l'avantage mesuré. Il atteint vite 100 pour une compo bien construite, même quand la victoire estimée reste vers 53 %. À garder tel quel ou à recalibrer.

---

## 6. Vérifications faites

- `npm install` et `npm run build` : OK (un seul avertissement : le paquet JavaScript dépasse 500 ko).
- Service worker : enregistré avec la portée `/draftmaster/` (testé avec `vite preview`) ; lien direct `/draftmaster/team` → 200.
- Chromium (Playwright), 390 × 844, échelle 1 : **0 erreur console** sur tous les écrans. 33 captures dans `captures/` : accueil, draft (vide, recos, mon pick, score, matchups), postes ennemis, conseils (phases, build, runes, erreurs), meilleures drafts et détail, champions (Top, Support), fiche (sorts, counters, synergies), pool, profil (historique, partie, analyse, réglages), partage + QR, import d'un ami, équipe (vide, assignée, drafts, détail, joueurs), page 404.
- Conditions de test :
  - `nanileb.github.io` est bloqué dans cet environnement : les données du coach ont été servies depuis la copie locale `/mnt/project-files/lol-support-coach/`.
  - Data Dragon est réel (patch 16.22.1).
  - Le relais Riot n'est pas joignable d'ici : **l'historique et le rang du profil ont été testés avec un faux relais** (10 parties fictives). Le vrai relais n'a pas été appelé.
- Worker patché : vérifié hors ligne avec un faux `fetch` Riot (`/rank`, `lite=2`, `lite=1` inchangé).
- `tools/best-drafts.mjs` : 10 drafts en environ 8 s avec les données locales du coach.

---

## 7. Reste à faire

- Créer le dépôt, publier sur GitHub Pages, appliquer le patch du worker (Anthony).
- Tester le profil contre le **vrai** relais Riot une fois publié (Riot ID réel, limite de requêtes de la clé).
- Vérifier sur les notes de patch 26.x l'heure des crabes (2:55) et les autres minuteurs de `meta.json`.
- Relire les 14 combos repris de Base44.
- Facultatif :
  - découper le paquet JavaScript (chargement différé des pages) ;
  - brancher les garde-fous de l'audit (`audit-logique/checks.mjs`) sur le moteur de DraftMaster dans la CI ;
  - recalibrer le score de draft (point 7 ci-dessus).
- Les icônes PNG ont été dessinées par script : à remplacer par une version faite à la main si besoin.
