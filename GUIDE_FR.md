# Radar — le guide complet du produit

Ce document explique **tout** Radar : ce que voit un visiteur, comment chaque fonction marche, d'où viennent les
données, comment le système tourne, et comment l'administrer sans écrire de code. Les chiffres cités sont ceux de la
collecte réelle du 19 octobre 2026.

---

## 1. Radar en une phrase

Un moteur de recherche gratuit, sans compte, qui réunit **toutes les offres d'emploi de Nouvelle-Zélande** en une seule
recherche, montre un résumé propre de chaque annonce et renvoie vers l'annonce d'origine pour postuler. Un visiteur peut aussi
déposer son CV : Radar classe les offres selon son profil **sans que le CV quitte son téléphone ou son ordinateur**.

**Ce que Radar n'est pas :** pas de compte, pas de connexion, pas d'offres publiées par des employeurs, pas de candidature sur Radar,
pas de pub, pas de newsletter, pas de cookies de suivi.

## 2. Pour qui ?

- **Voyageurs en PVT / Working Holiday** : cueillette, hôtellerie, logement fourni, « aucune expérience requise ».
  Radar comprend les mots en français, allemand, espagnol (« serveur », « Kellner », « camarero », « cueillette »).
- **Étudiants** : jobs à temps partiel, week-ends, saisonniers.
- **Tous les Néo-Zélandais** : un seul endroit au lieu de 10 sites, avec le salaire ramené à l'heure pour comparer.

## 3. Les sources et le volume

| Source | Annonces en ligne | Comment Radar les lit |
|---|---:|---|
| Seek | 16 318 | Données JSON du site + pages d'annonce (permission écrite) |
| Trade Me Jobs | 9 678 | Données JSON du site, description complète (permission écrite) |
| NZ Government Jobs (jobs.govt.nz, dont Te Whatu Ora / Health NZ) | 1 839 | Pages de résultats + données structurées |
| jobs.co.nz | 274 | Plan du site + données structurées (permission écrite) |
| Pages carrières d'entreprises (Ashby, Greenhouse, Lever, SmartRecruiters) | 391 | API publiques prévues pour ça (Xero, Rocket Lab, Halter, ZURU, Air New Zealand, Foodstuffs, KPMG…) |
| SeasonalJobs NZ | 173 | Plan du site + page d'annonce (permission écrite) |
| PickNZ | 97 | Plan du site + données structurées (permission écrite) |
| Backpacker Board | 0 pour l'instant | Connecteur prêt (permission écrite), mais le site bloque les robots (Cloudflare) |
| Facebook | — | Désactivé : Meta ne propose plus aucun flux public |
| LinkedIn, Indeed | — | Exclus |

**Total : 28 770 annonces actives**, mises à jour toutes les 4 heures. Le détail à jour est sur la page `/status` du site.

## 4. Le parcours du visiteur

### 4.1 L'accueil (`/`)
- Le grand titre « Every ☕ job in 🥝 New Zealand. 🏔 One search. » (maquette Claude Design reproduite fidèlement).
- **La barre de recherche** : un exemple qui change toutes les 3 secondes (« barista in Auckland », « fruit picking with
  accommodation »…). Quand on clique dedans, un **radar** animé balaie l'arrière-plan.
- **Autocomplétion** : dès la première lettre, des suggestions de vrais intitulés, d'entreprises, de lieux, et des combinaisons
  « barista in Auckland ». Navigation au clavier (flèches, Entrée, Échap).
- **Le bouton CV** (icône document avec une étincelle) à droite de la barre — voir §6.
- **Raccourcis** : Live-in, Hospitality, Fruit picking, No experience, Starts this week, $30+/h (affichés seulement s'il y a des résultats).
- **La ligne en direct** : « 28 770 jobs from 10 sources · updated 14 min ago » — chiffres réels.
- **Fresh today** : les annonces les plus récentes, avec une vraie photo du lieu quand Radar en a une (Queenstown, Wānaka,
  Franz Josef, Milford Sound, Te Puke…), sinon un dégradé avec l'initiale de l'employeur.
- **Browse by type** : Hospitality, Farm & fruit, Live-in, Tourism, Events, Seasonal, avec le **vrai nombre** d'offres.
- Pied de page noir avec le grand mot « Radar » et les liens About, Privacy, Status.

### 4.2 La recherche (`/search`)
**Écrire comme on parle.** Radar découpe la phrase en « puces » qu'on peut retirer d'un clic :

| Ce que tape le visiteur | Ce que Radar comprend |
|---|---|
| `barista auckland` | métier « barista » + lieu Auckland |
| `kitchen hand no experience` | métier + étiquette « No experience » |
| `part time retail wellington` | type de contrat + métier + lieu |
| `$30 an hour`, `30/h`, `60k+` | salaire minimum (ramené à l'heure) |
| `fruit picking backpackers hawkes bay` | métier + « Working holiday friendly » + région |
| `serveur queenstown` | « serveur » → waiter, waitress, food & beverage… + Queenstown |
| `barrista auckand` | fautes corrigées : « Showing results for barista auckland » |

- **Synonymes** : environ 205 groupes (barista ↔ coffee, kitchen hand ↔ KP ↔ dishwasher, hospo ↔ hospitality, dev ↔ software
  engineer, nanny ↔ au pair…), dont les mots français/allemands/espagnols des voyageurs.
- **Lieux** : 16 régions, ~230 villes et districts, ~330 quartiers d'Auckland, Wellington, Christchurch… ; les macrons sont
  ignorés (Whangārei = Whangarei, Ōtautahi = Christchurch, Tāmaki Makaurau = Auckland). Si une ville a moins de 5 offres,
  Radar élargit à la région et le dit.
- **Filtres** (avec le nombre d'offres à côté de chaque choix) : Lieu (région → ville, choix multiples), Type de contrat,
  Salaire horaire minimum, Date de publication (24 h, 3 jours, 7 jours, 30 jours), Avantages (Working holiday friendly, No experience,
  Accommodation, Remote, Visa sponsorship, Student friendly, Immediate start, Seasonal), Source.
- **Tri** : Best match (pertinence), Newest (plus récentes), Highest pay (meilleur salaire).
- **Salaire typique** : « Typical pay: $26–$29/h · median $27/h » calculé sur les résultats.
- **Tout est dans l'adresse** : `/search?q=barista&loc=auckland&type=part-time&pay=25&posted=7d&sort=new` — on peut partager une recherche.
- **Jamais d'impasse** : sans résultat, Radar propose de retirer le filtre le plus restrictif, d'élargir le lieu, etc.
- Sans recherche, `/search` montre les offres les plus récentes de tout le pays.
- 24 résultats par page, défilement infini (bouton « Load more » en secours).

**Ordinateur** : liste à gauche, aperçu de l'annonce à droite (la première est présélectionnée).
**Téléphone** : liste ; un toucher ouvre l'annonce dans un panneau qui monte du bas, qu'on referme en le glissant vers le bas
ou avec le bouton Retour du téléphone.

### 4.3 La carte d'une offre
Intitulé, employeur, lieu, salaire (jamais « N/A » : rien s'il n'est pas indiqué), type de contrat, ancienneté (« 2d »), source,
jusqu'à 2 étiquettes (New, WHV friendly, Accommodation…), et le pourcentage de correspondance si un CV est actif.
Les offres déjà ouvertes sont légèrement grisées (mémorisé dans l'onglet seulement).

### 4.4 L'aperçu et la page d'offre (`/job/…`)
Intitulé, employeur, lieu, **salaire normalisé + texte d'origine**, type, date, source et « Also on Trade Me » si la même offre
existe ailleurs, résumé (« In short »), points forts, étiquettes, début de l'annonce, puis le gros bouton **« View on Seek ↗ »**
(le nom change selon la source) qui ouvre l'annonce d'origine dans un nouvel onglet. Boutons « Copy link » / « Share ».
- Si le salaire est sous le salaire minimum adulte (23,95 $/h depuis le 1er avril 2026) : petite note « Check pay rate », sans accuser.
- Chaque offre a sa page partageable avec image d'aperçu (pour WhatsApp, Facebook…).
- Une offre fermée affiche « This job has closed » et 6 offres similaires encore ouvertes.

### 4.5 Les autres pages
- `/status` : chaque source, son état (Normal / Some errors / Down / Off), sa dernière mise à jour réussie, son nombre d'offres.
- `/about` : ce qu'est Radar, comment ça marche en 3 étapes, la liste des sources, le contact.
- `/privacy` : court et vrai (pas de compte, pas de cookie, CV sur l'appareil, journaux du serveur).
- Page 404 « This page went off the radar. », `sitemap.xml` et `robots.txt` pour Google.

### 4.6 Confort
- **Thème sombre** automatique selon le téléphone/ordinateur, ou forcé via le bouton rond en haut à droite (système → clair → sombre).
- **Raccourcis clavier** : `/` rechercher, `J`/`K` offre suivante/précédente, `Entrée` ouvrir, `O` ouvrir l'annonce d'origine,
  `Échap` fermer, `?` afficher l'aide.
- **Accessibilité** : contrastes conformes, lien « Skip to content », tout est utilisable au clavier et au lecteur d'écran.
  Lighthouse : Accessibilité 100, Bonnes pratiques 100, SEO 100.

## 5. Comment Radar classe les résultats

Score « Best match » = 50 % pertinence du texte (le mot tapé dans le titre compte beaucoup plus que dans la description) +
25 % sens (si activé) + 10 % fraîcheur + 10 % proximité du lieu + 5 % annonce complète (salaire et résumé présents).
Ensuite : les doublons sont regroupés et pas plus de 3 offres d'affilée du même employeur.
Mesure de qualité (`npm run eval`) : **31 requêtes réalistes sur 31 réussies** (top 10 vérifié pour chacune).

## 6. La correspondance avec le CV

1. Clic sur l'icône CV → « Drop your CV (PDF, DOCX or TXT) », « or paste it ». On peut aussi lâcher le fichier n'importe où sur la page.
2. Le CV est **lu dans le navigateur** (PDF, Word, texte ; 5 Mo max ; un PDF scanné sans texte → message clair + collage).
3. La première fois, le navigateur télécharge le « matcher » (petit modèle d'IA, ~23 Mo) avec une barre de progression ;
   ensuite c'est instantané (mis en cache).
4. Radar affiche ce qu'il a compris, sous forme de puces modifiables : métiers, compétences, langues, permis et certificats
   (permis de conduire, cariste, premiers secours, Site Safe, LCQ…), visa (Working holiday…). On retire ce qui est faux, on ajoute ce qui manque,
   on choisit « Where do you want to work? ».
5. « Show my matches » : chaque offre reçoit un **pourcentage de correspondance** (« 92% match ») et les raisons
   (« Matches your: Barista · French »). Ça marche seul ou avec une recherche tapée (« chef » + CV) et tous les filtres.

**Vie privée** : seul un résumé mathématique du CV (une liste de 384 nombres) et les puces validées sont envoyés au serveur pour
classer les offres — jamais le texte, jamais le fichier. Tout est gardé dans l'onglet ; « Clear CV » efface tout.

**Option IA** : si une clé Gemini gratuite est configurée, les 30 premiers résultats sont reclassés par l'IA avec une raison
courte par offre. Seules les puces et les titres/résumés des offres sont envoyés à Google. Sans clé, tout fonctionne.

## 7. Les données : honnêteté et fraîcheur

- **Aucune donnée inventée** : chaque offre vient d'une source réelle, chaque chiffre affiché est calculé.
- **Dédoublonnage** : une même offre publiée sur Seek et Trade Me n'apparaît qu'une fois (la version la plus complète),
  avec « Also on … ». 1 384 doublons fusionnés lors de la collecte complète.
- **Expiration** : une offre disparue deux collectes de suite est retirée ; plafond de 60 jours ; les offres dont la date de
  clôture est passée disparaissent.
- **Étiquettes automatiques** (règles testées, avec gestion des négations comme « no sponsorship ») :
  Working holiday friendly, No experience, Student friendly, Accommodation, Transport provided, Visa sponsorship, Remote,
  Weekends, Night shifts, Immediate start, Seasonal, Driver licence.
- **Salaires** : « $25–$30 per hour », « $28/hr », « $60k–$70k », « $65,000 + super »… ramenés à l'heure (annuel ÷ 2080, journalier ÷ 8).
- **Politesse envers les sites** : au plus 1 requête par seconde et par site, signature `RadarNZ/1.0` avec l'adresse du site,
  pages détail seulement pour les nouvelles annonces, et **jamais de contournement d'une protection anti-robots**.

## 8. Comment ça tourne (sans serveur de base de données)

```
GitHub Actions (toutes les 4 h)                  Hostinger (le site)
  collecte de toutes les sources                    au démarrage puis toutes les 10 min :
  nettoyage, dédoublonnage, expiration              télécharge la nouvelle base si elle a changé,
  calcul des « empreintes de sens »                 la vérifie et l'installe sans coupure
  fabrique radar.db → release « data-latest »       sert les pages et la recherche
```
Tout est gratuit : GitHub (dépôt public) et ton hébergement Hostinger existant. Aucun compte tiers.

## 9. Administrer Radar sans coder

| Je veux… | Comment |
|---|---|
| Voir l'état des sources | Page `/status` du site, ou GitHub → Actions → Ingest → dernière exécution (tableau récapitulatif) |
| Lancer une collecte maintenant | GitHub → Actions → Ingest → Run workflow |
| Couper une source tout de suite | GitHub → Settings → Secrets and variables → Actions → Variables → `DISABLED_SOURCES` = `seek` (par ex.) |
| Publier malgré une forte baisse | Run workflow en cochant « force publish » (sinon Radar refuse de publier si −40 %) |
| Ajouter une entreprise | Ajouter son identifiant dans `ingest/ats-companies.json` (Greenhouse, Lever, SmartRecruiters, Workable, Ashby) |
| Activer l'IA du CV | Variable `GEMINI_API_KEY` sur Hostinger |
| Mettre le site en ligne / changer de domaine | Voir `DEPLOY_FR.md` |

Identifiants des sources : `seek`, `trademe`, `jobsgovt`, `backpackerboard`, `picknz`, `jobsconz`, `seasonaljobs`,
`greenhouse`, `lever`, `smartrecruiters`, `workable`, `ashby`, `facebook`.

## 10. Qualité vérifiée

- 110 tests automatiques (salaires sur 35 vrais exemples, lieux, étiquettes, requêtes, synonymes, dédoublonnage, profil CV, connecteurs sur des pages réelles enregistrées).
- 21 tests de bout en bout dans un vrai navigateur, sur écran d'ordinateur (1440 px) et de téléphone (390 px) :
  recherche, autocomplétion, aperçu, lien vers l'annonce, filtres, fautes, CV en PDF (et vérification que le texte du CV
  n'est jamais envoyé), panneau mobile + bouton Retour, thème sombre, page d'offre, 404, statut.
- Éval de pertinence : 31/31. Lighthouse : Accessibilité, Bonnes pratiques et SEO à 100.

## 11. Limites connues

- **Seek** : à chaque collecte, Radar lit les pages complètes de 1 500 nouvelles annonces ; les autres affichent en attendant le résumé
  et les points clés fournis par Seek. La couverture complète arrive en environ un jour et demi.
- **Backpacker Board** : bloqué par sa protection anti-robots tant qu'ils n'autorisent pas Radar.
- **Première correspondance CV** sur un appareil : téléchargement du modèle (~23 Mo) une seule fois.
- Le dépôt étant public, la base publiée est téléchargeable par tous (voir `DEPLOY_FR.md` §10 pour passer en privé).

## 12. Petit glossaire

- **Release `data-latest`** : l'endroit sur GitHub où le robot dépose la base de données.
- **Embedding / « empreinte de sens »** : une liste de nombres qui résume le sens d'un texte ; deux textes proches ont des
  empreintes proches. C'est ce qui permet la correspondance CV ↔ offre.
- **FTS (recherche plein texte)** : l'index qui retrouve instantanément les mots dans 28 000 annonces.
- **Puces** (chips) : les petites étiquettes cliquables (lieu, salaire, compétences…).
