# Décisions techniques — BYX

Ce document liste les décisions prises quand le cahier des charges ne
précisait pas un choix, comme demandé en §25 ("prends des décisions
raisonnables lorsque quelque chose n'est pas précisé, documente les
décisions importantes").

## 1. VIN comme clé pivot, immatriculation mutable

Le cahier des charges dit "l'immatriculation et le VIN doivent permettre de
retrouver une fiche existante" sans trancher lequel est la clé forte. Une
plaque peut changer de véhicule (revente, réimmatriculation) ; le VIN est
permanent. **Décision : le VIN est la clé unique par atelier
(`vehicles.vin` + contrainte `unique(workshop_id, vin)`), l'immatriculation
est mutable et historisée dans `vehicles.plate_history`.** La création d'un
véhicule vérifie systématiquement l'existence préalable par VIN.

## 2. Offline-first plutôt que "réseau mobile moyen"

Le texte demandait un fonctionnement "avec réseau mobile moyen" sans
préciser de stratégie. **Décision : local-first.** Toute écriture reçoit un
`client_uuid` généré côté appareil avant tout appel réseau ; échec réseau =
mise en file locale (IndexedDB), retry automatique à la reconnexion,
déduplication serveur par `client_uuid`.

## 3. Usure/restant toujours stockés ensemble

Pour lever l'ambiguïté identifiée dans le cahier des charges (§8.3),
**décision : `wear_percent` et `remaining_percent` sont deux colonnes
distinctes toujours renseignées ensemble** (jamais l'une sans l'autre côté
UI), plutôt qu'un seul pourcentage dont le sens serait implicite.

## 4. Garde-fou sécurité sur le rapport client

**Décision : toute observation avec `severity` ou `urgency` ≥ 5 apparaît
obligatoirement dans le rapport client**, contrainte appliquée à trois
niveaux redondants : contrainte SQL (`chk_urgent_always_reported`), logique
applicative (`lib/ref/severity.ts::mustAppearInClientReport`), et filtrage
serveur dans la route de génération de rapport. Objectif : éviter qu'une
case à cocher UI ne devienne, par erreur, un risque juridique pour
l'atelier.

## 5. Gouvernance du référentiel de composants

**Décision : statut `proposition` / `valide` / `rejete` sur `components`.**
Un mécanicien qui ne trouve pas un composant peut le proposer (insert avec
`status='proposition'`) ; seul un `atelier_responsable` ou `admin` peut le
valider (policy RLS dédiée). Évite la fragmentation ("plaquette avt" vs
"plaquettes avant") sans bloquer le travail terrain.

## 6. Confidentialité photo/vidéo

**Décision : champ `evidence.privacy_reviewed` (défaut `false`),
confirmation obligatoire avant analyse IA et avant inclusion dans un
rapport.** Le mécanicien confirme explicitement un cadrage technique
(composant, pas d'habitacle habité, pas de tiers identifiable).

## 7. Provider IA par défaut = mock

**Décision : `AI_DEFAULT_PROVIDER=mock` par défaut dans `.env.example`.**
Le prototype doit être testable en atelier immédiatement, sans attendre la
configuration d'une clé API OpenAI/Anthropic. Le passage à un moteur réel se
fait par variable d'environnement, sans changement de code.

## 8. PDF généré avec pdf-lib plutôt qu'un moteur HTML→PDF

**Décision : génération directe avec `pdf-lib`** (dessin de texte
programmatique) plutôt qu'un rendu HTML→PDF (Puppeteer, etc.), pour éviter
une dépendance lourde (navigateur headless) sur l'environnement de
déploiement serverless (Vercel). Limite connue : mise en page plus simple
qu'un rendu HTML/CSS — acceptable pour le MVP, à revoir si un design de
rapport plus riche est demandé.

## 9. Rôles utilisateurs simplifiés au niveau RLS pour le MVP

Le cahier des charges liste 5 rôles (§18). **Décision : les policies RLS du
MVP autorisent `for all` par atelier pour simplifier le prototype**, la
distinction fine lecteur/mécanicien/responsable étant appliquée au niveau
applicatif (boutons visibles/masqués) plutôt qu'en RLS strict. À durcir en
RLS avant un déploiement multi-ateliers en production (voir
`supabase/migrations/0002_rls.sql`, commentaire final).

## 10. Rapports en trois versions distinctes plutôt qu'un seul document filtré

**Décision : chaque rapport (`client`/`technique`/`interne`) est un
enregistrement `reports` séparé, versionné indépendamment** dans
`report_versions`, plutôt qu'un unique document avec des sections
masquables. Cela évite qu'une préférence d'affichage change accidentellement
ce qui a été historiquement montré au client à une date donnée.
