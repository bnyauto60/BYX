# BYX — Carnet de Santé Technique Intelligent

Prototype fonctionnel pour BNY Auto (Chevrières, Oise). BYX centralise
l'inspection, l'historique, les preuves techniques (photo **et vidéo**) et
l'aide au diagnostic par IA de chaque véhicule, indépendamment du logiciel
de facturation de l'atelier.

## Ce que fait ce prototype (MVP)

- Connexion, tableau de bord d'atelier
- Création/recherche de véhicule (VIN = clé pivot, anti-doublon)
- Fiche véhicule = Carnet de Santé Technique (chronologie, alertes)
- Création d'un événement technique (inspection, diagnostic, réparation…)
- Inspection : dictée vocale **ou** texte libre → structuration automatique
  par IA (composant, gravité, urgence, recommandation, usure/restant
  toujours explicites)
- Capture photo **et vidéo** directement depuis l'appareil, rattachée à
  l'observation, avec analyse IA de la vidéo (bruit moteur, vibration,
  suspension, fuite, tableau de bord, fumée, essai routier)
- Génération de rapport PDF (client / technique / interne), stocké dans le
  cloud
- Garde-fou non contournable : une observation urgente ne peut jamais être
  cachée du rapport client

## Ce qui rend cette base "premium" plutôt que jetable

1. **Indépendance IA** — `src/lib/ai/router.ts` : chaque tâche (structurer,
   diagnostiquer, comparer, rédiger un rapport, analyser une vidéo) peut
   être confiée à un moteur différent (OpenAI, Anthropic, ou un futur
   fournisseur), configurable par variable d'environnement, sans toucher au
   code.
2. **Vidéo traitée comme la photo** — même modèle de données, mêmes règles,
   architecture prête pour une analyse en temps réel dès qu'un provider le
   permet.
3. **Offline-first** — aucune donnée perdue en cas de réseau atelier
   défaillant (`src/lib/offline/queue.ts`).
4. **Traçabilité totale** — aucune suppression physique, historique complet
   des observations, journal d'audit.
5. **Sécurité by design** — RLS Postgres par atelier, garde-fous appliqués à
   la fois en base et en code applicatif.

Voir `docs/ARCHITECTURE.md` pour le détail, et `docs/DECISIONS.md` pour les
choix faits là où le cahier des charges laissait un point ouvert.

## Démarrage rapide

```bash
npm install
cp .env.example .env.local   # renseigner les clés Supabase
# exécuter supabase/migrations/0001_init.sql puis 0002_rls.sql dans Supabase
npm run dev
```

Instructions complètes, y compris déploiement Vercel et configuration IA :
voir `docs/DEPLOYMENT.md`.

## Structure du projet

```
src/
  app/                  pages et routes API (Next.js App Router)
  components/           composants React réutilisables
  lib/
    ai/                 couche d'abstraction multi-fournisseur IA
    supabase/           clients Supabase (navigateur, serveur)
    offline/            file d'attente locale pour l'atelier
    pdf/                génération des rapports PDF
    ref/                référentiels partagés (gravité/urgence)
  types/                types métier partagés
supabase/
  migrations/           schéma SQL (tables, RLS)
  seed.sql              données de démonstration
docs/
  ARCHITECTURE.md
  DECISIONS.md
  DEPLOYMENT.md
```

## Prochaines étapes suggérées

- Tester en atelier sur 3-5 véhicules réels avec le provider `mock`, pour
  valider le workflow terrain avant d'activer une IA payante.
- Une fois validé : activer `AI_DEFAULT_PROVIDER=openai` ou `anthropic` et
  comparer la qualité de structuration sur des cas réels.
- Ajouter la comparaison historique automatique (§9.3 du cahier des
  charges) et l'état calculé des composants (§6), esquissés dans le schéma
  (`component_states`, `vehicle_health_snapshots`) mais pas encore reliés à
  une interface dédiée dans ce premier MVP.
