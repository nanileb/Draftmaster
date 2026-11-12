# Patch du relais Riot (worker « lol-relais ») pour DraftMaster

DraftMaster utilise **le même worker** que Coach Support. Il n'y a pas de second worker.
Ce dossier contient `riot-proxy.js` : c'est le fichier du coach (`lol-support-coach/worker/riot-proxy.js`) avec **deux ajouts**. Aucune route existante ne change.

## Ce qui est ajouté

| Route | Rôle | Appels Riot |
|---|---|---|
| `/match?id=&platform=&lite=2` | Une partie **sans la chronologie** : statistiques des 10 joueurs (mêmes champs que la route complète, plus `riotIdGameName`). Sert à l'historique et à l'analyse du profil. | 1 (au lieu de 2) |
| `/rank?puuid=&platform=` | Rang classé Solo/Duo et Flex (tier, division, LP, victoires, défaites). | 1 |

`lite=1` et la route complète (sans `lite`) ne changent pas. Le coach n'utilise ni `lite=2` ni `/rank`, donc il continue de marcher tel quel.

## Sans ce patch

DraftMaster marche quand même :
- `/match?lite=2` est lu par l'ancien worker comme la route complète. L'historique s'affiche, mais chaque partie coûte 2 appels Riot (chronologie comprise) et les pseudos des autres joueurs ne s'affichent pas (on voit le nom du champion à la place).
- `/rank` répond `not_found` : le rang n'est simplement pas affiché.

## Pour l'appliquer (à faire par Anthony, rien n'a été déployé)

1. Comparer avec le fichier du coach : `diff lol-support-coach/worker/riot-proxy.js draftmaster/worker-patch/riot-proxy.js`. Il y a 3 blocs, tous marqués `[ajout DraftMaster]`.
2. Copier le fichier à la place de `lol-support-coach/worker/riot-proxy.js`, puis `npx wrangler deploy` depuis `lol-support-coach/worker/`.
3. `ALLOWED_ORIGIN` reste `https://nanileb.github.io` : DraftMaster est publié sur la même origine (`https://nanileb.github.io/draftmaster/`), il n'y a rien à changer.

## Vérification faite

Test hors ligne avec un `fetch` Riot simulé (Node 22) : `/rank` renvoie les entrées filtrées ; `lite=2` renvoie 10 participants avec `riotIdGameName` et sans `frames` ; `lite=1` est inchangé. Rien n'a été testé contre la vraie API Riot (pas de clé ici, et rien n'a été déployé).
