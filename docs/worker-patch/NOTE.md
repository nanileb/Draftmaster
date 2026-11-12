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

## Ajout de novembre 2026 : synchro des pools entre amis

Quatre routes en plus, qui ne demandent pas la clé Riot : `GET /pool?id=`, `GET /pools?ids=`, `POST /pool?id=` et `DELETE /pool?id=`. Elles stockent les pools dans un espace Workers KV lié sous le nom `POOLS`. Le fichier de ce dossier est aussi proposé dans le dépôt du coach (`lol-support-coach/worker/riot-proxy.js`).

Déploiement, depuis `lol-support-coach/worker/` :

1. `npx wrangler kv namespace create POOLS --binding POOLS --update-config` (ajoute l'espace dans `wrangler.jsonc`). Si ta version de wrangler refuse ces options, lance `npx wrangler kv namespace create POOLS` et ajoute à la main dans `wrangler.jsonc` : `"kv_namespaces": [{ "binding": "POOLS", "id": "<id affiché>" }]`.
2. `npx wrangler deploy`.

Vérification : `curl https://lol-support-coach.62z7h87vzm.workers.dev/pool?id=testtesttest` doit répondre `{"error":"not_found"}` (et non `sync_unavailable`, qui veut dire que l'espace KV n'est pas lié).
