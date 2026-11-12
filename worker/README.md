# Relais Riot (Cloudflare Worker)

`riot-proxy.js` garde la clé Riot côté serveur et sert à la fois l'application (historique, rang, partie en cours, synchro des pools d'amis) et la collecte des builds (`tools/collect.mjs`). La liste des routes est en tête du fichier.

Le worker s'appelle toujours `lol-support-coach` (`https://lol-support-coach.62z7h87vzm.workers.dev`, nom dans `wrangler.jsonc`) : il a été repris du dépôt du coach et garder ce nom conserve la même adresse, le même secret `RIOT_KEY` et le même espace KV, sans rien changer dans l'application ni chez les amis.

## Déploiement (Cloudflare Workers Builds)

Cloudflare redéploie le worker depuis ce dépôt : worker `lol-support-coach` › Settings › Build, dépôt `nanileb/Draftmaster`, branche `main`, Root directory `worker`, commande `npx wrangler deploy`. Conseillé : **Build watch paths** › `worker/*`, pour ne pas redéployer à chaque mise à jour des données.

Vérification : `https://lol-support-coach.62z7h87vzm.workers.dev/pool?id=testtesttest` répond (`not_found` ou `sync_unavailable`, pas une erreur Cloudflare).

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
