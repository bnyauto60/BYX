# Architecture BYX

## Vue d'ensemble

```
Application web/mobile (Next.js, responsive, PWA-ready)
        │
        ▼
API Next.js (Route Handlers, server components)
        │
        ├── Supabase Postgres — source de vérité (le CST)
        ├── Supabase Storage — photos, vidéos, PDF
        ├── Supabase Auth — authentification, rôles
        ├── lib/ai/router.ts — couche d'abstraction multi-IA
        └── lib/pdf/generateReport.ts — génération PDF
```

Le code applicatif ne parle jamais directement à un SDK Supabase Storage
exotique ni à un SDK IA propriétaire en dehors des dossiers `lib/supabase`
et `lib/ai`. Cela garde la possibilité de changer de fournisseur cloud ou de
moteur IA sans réécrire les pages ou les routes API.

## Couche d'abstraction IA

Voir `src/lib/ai/`. Principe : toute la logique métier appelle
`runAITask()` ou `runVideoAnalysis()` depuis `router.ts` — jamais un
provider directement. Le choix du moteur se fait par variables
d'environnement (`AI_DEFAULT_PROVIDER`, `AI_TASK_ROUTING`), ce qui permet :

- de changer de fournisseur sans déploiement de code ;
- d'attribuer des tâches différentes à des moteurs différents (ex : GPT-4o
  pour l'analyse vidéo, Claude pour le raisonnement diagnostic) ;
- d'ajouter un nouveau fournisseur en implémentant une seule interface
  (`AIProvider`) et en l'enregistrant dans `registry`.

Le provider `mock` ne nécessite aucune clé API : il permet de tester tout le
flux applicatif (structuration, upload, rapport) avant même d'avoir un
compte OpenAI ou Anthropic.

## Vidéo — traitement au même niveau que la photo

Le modèle de données (`evidence`) traite `photo` et `video` de façon
symétrique : même table, mêmes relations vers `observations` et
`technical_events`, mêmes règles de confidentialité (`privacy_reviewed`).
Seuls quelques champs sont spécifiques à la vidéo (`duration_seconds`,
`captured_context` avec les valeurs bruit moteur / vibration / suspension /
fuite / tableau de bord / fumée / essai routier).

### Analyse asynchrone (MVP actuel)

`POST /api/ai/video` : le fichier déjà uploadé est signé (URL temporaire),
transmis au provider IA configuré pour la tâche `video`, et le résultat est
stocké dans `ai_analyses` + le statut `evidence.ai_analysis_status` est mis
à jour (`en_attente` → `en_cours` → `terminee`/`echec`).

### Vers le temps réel

`AIProvider.supportsRealtime` indique si le provider actif sait traiter un
flux vidéo en direct (ex : OpenAI Realtime API). `isRealtimeVideoAvailable()`
expose cette capacité à l'interface, qui peut alors proposer un mode "essai
routier commenté en direct" plutôt qu'un enregistrement puis analyse
différée. Aucun changement de schéma de données n'est nécessaire pour
activer ce mode : `evidence.duration_seconds` reste nul tant que
l'enregistrement n'est pas terminé, et les résultats intermédiaires peuvent
être poussés dans `ai_analyses` au fur et à mesure (plusieurs lignes pour
une même `evidence_id`, ordonnées par `created_at`).

## Offline-first (atelier à réseau faible)

Voir `src/lib/offline/queue.ts`. Toute création d'événement ou
d'observation reçoit un `client_uuid` généré côté appareil avant tout appel
réseau. En cas d'échec de synchronisation, l'écriture reste en file
(IndexedDB) et est retentée à la reconnexion. Le serveur déduplique sur ce
`client_uuid` (index unique partiel sur `technical_events` et
`observations`).

Pour la version production, remplacer le stockage IndexedDB minimal par
`idb` + un Service Worker, afin que la synchronisation continue même
application fermée.

## Sécurité

- RLS Postgres : isolation stricte par atelier (`workshop_id`) sur toutes
  les tables métier — voir `supabase/migrations/0002_rls.sql`.
- Garde-fou non contournable : une observation dont `severity` ou `urgency`
  ≥ 5 ne peut jamais être exclue du rapport client (contrainte SQL
  `chk_urgent_always_reported` + vérification applicative dans
  `lib/ref/severity.ts` et la route `/api/reports/:eventId/pdf`).
- Aucune suppression physique des observations/preuves : `deleted_at`
  uniquement, historique conservé dans `observation_history`.
- Confidentialité vidéo/photo : `evidence.privacy_reviewed` doit être
  confirmé explicitement par le mécanicien avant analyse IA, garantissant
  qu'un cadrage technique (et non l'habitacle habité ou des tiers) a été
  vérifié.

## Indépendance vis-à-vis des fournisseurs

- IA : voir ci-dessus.
- Cloud : Supabase est utilisé pour le MVP, mais les accès sont concentrés
  dans `lib/supabase/`. Un export complet (CSV, JSON, PDF, ZIP des médias)
  est prévu pour éviter le verrouillage propriétaire (cahier des charges §17).
- Le schéma de base est documenté et migré via SQL standard (pas
  d'extension propriétaire bloquante).
