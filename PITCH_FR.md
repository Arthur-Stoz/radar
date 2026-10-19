# Radar — pitch

## En 15 secondes

**Radar, c'est le Google des offres d'emploi en Nouvelle-Zélande.** Une seule recherche couvre Seek, Trade Me, les offres du
gouvernement, jobs.co.nz, les jobs saisonniers et les pages carrières des entreprises : près de 29 000 offres réelles, mises à jour
toutes les 4 heures. Gratuit, sans compte, et on peut même y déposer son CV : Radar trouve les offres qui correspondent,
sans que le CV quitte le téléphone.

## En 1 minute

**Le problème.** Chercher un job en Nouvelle-Zélande, c'est ouvrir dix sites, refaire dix fois la même recherche, retomber sur les
mêmes annonces en double, et comparer des salaires écrits de dix façons différentes. Pour un voyageur en PVT qui ne connaît ni les
sites ni le vocabulaire local, c'est pire : il cherche « serveur » ou « cueillette » et ne trouve rien.

**La solution.** Radar rassemble toutes ces offres dans un seul moteur, rapide et épuré :
- on écrit comme on parle — « barista à Auckland, temps partiel, 28 $ de l'heure » — et Radar comprend le lieu, le contrat et le salaire ;
- il comprend aussi le français, l'allemand et l'espagnol des voyageurs, et corrige les fautes ;
- les doublons entre sites sont fusionnés, les salaires sont ramenés à l'heure pour comparer d'un coup d'œil ;
- un clic sur une offre montre un résumé clair, un second clic emmène sur l'annonce d'origine pour postuler.

**L'effet « waouh ».** On dépose son CV, et chaque offre affiche un score « 92 % de correspondance » avec les raisons
(« Barista · Français · Permis de conduire »). Le CV est lu **sur l'appareil** : il n'est jamais envoyé, jamais stocké.

**La confiance.** Aucune fausse offre, aucun faux chiffre, la source et la fraîcheur de chaque annonce sont affichées, et
une page publique montre l'état de chaque source en temps réel. Pas de compte, pas de pub, pas de cookie de suivi.

## Les chiffres (réels, collecte automatique du 19 octobre 2026)

- **28 550 offres actives** en Nouvelle-Zélande, issues de **10 sources**.
- Seek 16 431 · Trade Me 9 494 · NZ Government Jobs 1 706 · pages carrières d'entreprises 377 · jobs.co.nz 272 ·
  SeasonalJobs NZ 173 · PickNZ 97.
- Environ 1 500 doublons fusionnés automatiquement à chaque collecte (1 488 le 19 octobre au soir).
- Mise à jour **toutes les 4 heures**, réponse de recherche en quelques dizaines de millisecondes.
- 31 requêtes de test sur 31 réussies (pertinence des 10 premiers résultats vérifiée).

## Pour qui

- **Voyageurs en Working Holiday** (des dizaines de milliers chaque année) : filtres « Working holiday friendly »,
  « Accommodation », « No experience », « Seasonal », et recherche dans leur langue.
- **Étudiants** : temps partiel, week-ends, jobs d'été.
- **Tous les chercheurs d'emploi néo-zélandais** : un seul endroit au lieu de dix.

## Pourquoi Radar est différent

| | Les sites d'annonces | Radar |
|---|---|---|
| Couverture | leur seul catalogue | tous les sites réunis |
| Doublons | fréquents d'un site à l'autre | fusionnés, avec « aussi sur Trade Me » |
| Salaire | formats variés | ramené à l'heure, salaire typique affiché |
| Langue | anglais uniquement | comprend FR / DE / ES et les fautes |
| CV | à envoyer, compte obligatoire | correspondance sur l'appareil, sans compte |
| Vie privée | comptes, cookies, pubs | rien de tout ça |

## Sous le capot (pour les profils techniques)

Recherche plein texte SQLite FTS5 + synonymes + correction orthographique, classement pondéré, modèle d'IA d'« embeddings »
exécuté localement (dans le navigateur pour le CV), hébergement minimal (GitHub + un hébergeur Node), données publiées toutes les
4 heures par un robot GitHub Actions, 110 tests automatiques + 21 tests de bout en bout sur ordinateur et téléphone, score
Lighthouse 100 en accessibilité, bonnes pratiques et SEO.

## La phrase de fin

> « Toutes les offres de Nouvelle-Zélande. Une seule recherche. Et votre CV ne quitte jamais votre poche. »
