# Mettre Radar en ligne — guide pas à pas (Hostinger)

Ce guide part de zéro. Il faut seulement ton compte **GitHub** (`Arthur-Stoz`) et ton compte **Hostinger**
(offre *Business Web Hosting* ou *Cloud*, qui permettent les applications Node.js). Compte environ 30 minutes.

> Déjà fait pour toi : le dépôt **https://github.com/Arthur-Stoz/radar** est créé et le code est poussé ;
> la première base de données est publiée dans la release **data-latest** et la collecte automatique tourne toutes les 4 heures.
> Tu commences donc directement à l'étape 2.

---

## 1. Comprendre en 30 secondes

- **GitHub** fait la collecte : toutes les 4 heures, un robot (GitHub Actions, gratuit) lit les sites d'annonces, fabrique
  la base de données (`radar.db.gz`) et la dépose dans la « release » `data-latest` du dépôt.
- **Hostinger** fait tourner le site : au démarrage, puis toutes les 10 minutes, le site télécharge la dernière base.
- Chaque fois que le code change sur GitHub (branche `main`), Hostinger reconstruit et redéploie le site tout seul.
- Les données ne sont **jamais** dans le code : elles vivent dans la release, que le site télécharge.

## 2. Vérifier que la collecte fonctionne (2 min)

1. Ouvre https://github.com/Arthur-Stoz/radar/actions
2. Clique sur **Ingest** à gauche : tu dois voir des exécutions avec une coche verte ✅.
   En cliquant sur la dernière, tu vois un tableau « Radar ingest » avec le nombre d'annonces par source.
3. Ouvre https://github.com/Arthur-Stoz/radar/releases/tag/data-latest : tu dois voir les fichiers
   `radar.db.gz` (≈ 50 Mo) et `manifest.json`.

Pour lancer une collecte à la main : *Actions* → *Ingest* → bouton **Run workflow** → **Run workflow**.

## 3. Créer le site sur Hostinger (10 min)

1. Connecte-toi à **hPanel** (https://hpanel.hostinger.com).
2. Menu **Sites web** → **Ajouter un site web** → choisis **Application Web Node.js** (« Node.js Web App »).
3. Choisis **Importer depuis GitHub** (Connect GitHub) et autorise Hostinger à accéder à ton compte GitHub.
   Sélectionne le dépôt **Arthur-Stoz/radar**, branche **main**.
4. Réglages de build (Hostinger les détecte normalement tout seul) :

   | Réglage | Valeur |
   |---|---|
   | Framework | **Next.js** |
   | Version de Node.js | **22** |
   | Commande d'installation | `npm ci` (ou `npm install`) |
   | Commande de build | `npm run build` |
   | Commande de démarrage | `npm start` |
   | Dossier de sortie | laisser par défaut (`.next`) |

5. **Variables d'environnement** (section *Environment variables* avant de déployer) — ajoute :

   | Nom | Valeur | Obligatoire ? |
   |---|---|---|
   | `DATA_URL` | `https://github.com/Arthur-Stoz/radar/releases/download/data-latest/radar.db.gz` | **Oui** |
   | `SITE_URL` | l'adresse de ton site, par ex. `https://radar-xxxx.hostingersite.com` (voir étape 4) | Recommandé |
   | `CONTACT_EMAIL` | l'adresse e-mail publique de contact (affichée sur la page About) | Optionnel |
   | `GEMINI_API_KEY` | ta clé gratuite Google AI Studio (voir étape 7) | Optionnel |

   Ne mets **pas** `PORT` : Hostinger le fournit lui-même.
6. Clique sur **Déployer**. Le premier build prend 3 à 6 minutes (il installe tout et prépare le modèle d'IA local du CV).

## 4. Le domaine temporaire

Hostinger donne une adresse temporaire du type `https://quelque-chose.hostingersite.com`.
- Ouvre-la : la page d'accueil affiche « Loading jobs… » pendant quelques secondes la toute première fois
  (le site télécharge la base de 50 Mo), puis le compteur d'annonces apparaît.
- Recopie cette adresse dans la variable `SITE_URL` (étape 3.5), puis **Redéployer**.

## 5. Vérifier que tout marche (3 min)

1. `https://TON-ADRESSE/api/health` doit afficher `{"ok":true,"dbBuiltAt":"…","jobs":28000…}`.
2. `https://TON-ADRESSE/status` : chaque source avec son état et son nombre d'annonces.
3. Tape « barista auckland » sur l'accueil, clique une annonce, puis **View on Seek ↗** : tu arrives sur l'annonce d'origine.
4. Clique l'icône CV (à droite de la barre de recherche), dépose un CV : des pourcentages « 92% match » apparaissent.

Si `/api/health` affiche `"ok":false` plus de 2 minutes : vérifie l'orthographe exacte de `DATA_URL`, puis redéploie.

## 6. Réglages côté GitHub (une fois)

Dans https://github.com/Arthur-Stoz/radar/settings/variables/actions, onglet **Variables**, ajoute :
- `SITE_URL` = la même adresse que sur Hostinger (elle apparaît dans la signature du robot de collecte) ;
- `CONTACT_EMAIL` = ton e-mail de contact (idem, pour que les sites sachent qui les lit) ;
- optionnel : `DISABLED_SOURCES` = identifiants à couper instantanément, séparés par des virgules (ex. `jobsconz,seasonaljobs`).

Clés officielles Trade Me (si tu les obtiens un jour) : onglet **Secrets** → `TRADEME_CONSUMER_KEY` et `TRADEME_CONSUMER_SECRET`.

## 7. (Optionnel) Le classement IA des correspondances CV

1. Va sur https://aistudio.google.com → **Get API key** → crée une clé (gratuite).
2. Ajoute-la sur Hostinger : variable `GEMINI_API_KEY`, puis **Redéployer**.
Sans clé, tout fonctionne quand même (classement local). Seules les compétences détectées et les titres des 30 meilleures
offres sont envoyés à Google — jamais le CV.

## 8. Plus tard : ton propre nom de domaine

1. Achète le domaine (chez Hostinger c'est le plus simple).
2. hPanel → ton site → **Domaines** → **Connecter un domaine** → suis l'assistant (si le domaine est ailleurs, il donne
   les enregistrements DNS `A`/`CNAME` à copier chez ton registrar ; la propagation prend de quelques minutes à 24 h).
3. Active le **SSL** (gratuit) dans hPanel → *Sécurité* → *SSL*.
4. Mets la nouvelle adresse dans `SITE_URL` (Hostinger **et** GitHub), puis redéploie.

## 9. En cas de souci

| Symptôme | Que faire |
|---|---|
| Le site reste sur « Loading jobs… » | Vérifier `DATA_URL` ; ouvrir le lien dans le navigateur : il doit télécharger un fichier. |
| Une source est « Down » sur /status | Ouvrir *Actions → Ingest* → dernière exécution → le message d'erreur. Le site continue avec les autres sources. |
| Backpacker Board toujours « Down » | Le site renvoie une protection anti-robots (Cloudflare). Demande-leur d'autoriser le robot `RadarNZ/1.0` (ou les IP de GitHub Actions). Radar ne contourne jamais une protection. |
| L'ingestion échoue avec « SAFETY » | Le nombre d'annonces a chuté de plus de 40 % : la base n'est pas publiée (protection). Si c'est normal, relancer *Run workflow* en cochant « force publish ». |
| Le build Hostinger échoue | Vérifier Node **22**. Relancer le déploiement. Le même build tourne en CI sur GitHub (onglet *Actions → CI*). |

## 10. Rappels

- Le dépôt est **public** (minutes GitHub Actions illimitées, `DATA_URL` téléchargeable sans jeton). La base publiée dans la
  release est donc téléchargeable par n'importe qui. Si tes accords avec les sources l'interdisent, passe le dépôt en privé :
  `gh repo edit Arthur-Stoz/radar --visibility private --accept-visibility-change-consequences`, puis crée un jeton GitHub
  « fine-grained » en lecture seule (*Contents: Read*) sur ce dépôt et ajoute-le sur Hostinger dans `DATA_TOKEN`.
  En privé, les minutes gratuites sont limitées (2 000/mois) : passer le cron à toutes les 6 h et `DETAIL_BUDGET` à 400.
- Aucune donnée personnelle n'est stockée : pas de compte, pas de cookie, le CV reste sur l'appareil du visiteur.
