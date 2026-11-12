# Relais Riot (Cloudflare Worker)

`riot-proxy.js` garde la clé Riot côté serveur et sert à la fois l'application (historique, rang, partie en cours, synchro des pools d'amis) et la collecte des builds (`tools/collect.mjs`). La liste des routes est en tête du fichier.

C'est le worker `lol-support-coach` déjà en service (`https://lol-support-coach.62z7h87vzm.workers.dev`), repris tel quel du dépôt `lol-support-coach` (même code, même nom dans `wrangler.jsonc`). Garder ce nom permet de redéployer **le même** worker : même adresse, même secret `RIOT_KEY`, même espace KV, rien à changer dans l'application ni chez les amis.

## Le redéployer depuis ce dépôt (une fois, sur Cloudflare)

Aujourd'hui, Cloudflare Workers Builds redéploie le worker quand `main` change dans `lol-support-coach`. Pour qu'il suive ce dépôt à la place :

1. https://dash.cloudflare.com › **Workers & Pages** › worker `lol-support-coach` › **Settings** › **Build**.
2. **Git repository** : déconnecter `nanileb/lol-support-coach`, puis connecter `nanileb/Draftmaster` (si Cloudflare ne le propose pas, lui donner accès au dépôt dans l'application GitHub « Cloudflare Workers and Pages »).
3. Branche `main`, **Root directory** (chemin) : `worker`, commande de déploiement : `npx wrangler deploy` (celle par défaut).
4. Facultatif mais conseillé : **Build watch paths** › inclure `worker/*`, pour ne pas redéployer le worker à chaque mise à jour des données.
5. Relancer un déploiement (ou attendre le prochain changement de `worker/`) et vérifier : `https://lol-support-coach.62z7h87vzm.workers.dev/pool?id=testtesttest` répond (`not_found` ou `sync_unavailable`, pas une erreur Cloudflare).

Le secret `RIOT_KEY` reste dans le worker (il doit être de type **Secret** : une variable Text est effacée à chaque déploiement). Quand la clé personnelle expire, on la change au même endroit : Settings › Variables and Secrets.

## Espace KV « POOLS » (synchro des pools d'amis)

Les routes `/pool` et `/pools` ont besoin d'un espace Workers KV lié sous le nom `POOLS`. Comme le déploiement suit `wrangler.jsonc`, l'espace doit y figurer, sinon il est délié à chaque déploiement :

```jsonc
"kv_namespaces": [{ "binding": "POOLS", "id": "<id de l'espace>" }]
```

L'id se lit dans Cloudflare › Storage & Databases › Workers KV (ou se crée avec `npx wrangler kv namespace create POOLS`). Sans cet espace, la synchro répond `sync_unavailable` et l'application garde la copie du pool contenue dans le lien de partage.

## Relancer un déploiement

Workers Builds redéploie à chaque changement de `main` (ou seulement de `worker/` si les Build watch paths sont réglés). Pour relancer sans rien changer au code : modifier un commentaire d'un fichier de `worker/` et le fusionner, ou, dans Cloudflare, Deployments › dernier build › « … » › Retry.

## Déployer à la main (sans Workers Builds)

```bash
cd worker
npx wrangler deploy
```
