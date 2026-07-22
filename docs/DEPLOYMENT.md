# Déploiement BYX

## 1. Prérequis

- Node.js ≥ 18.18
- Un projet Supabase (gratuit pour démarrer) : https://supabase.com
- Un compte Vercel (ou tout hébergeur compatible Next.js)
- Optionnel pour l'IA réelle : une clé OpenAI et/ou Anthropic

## 2. Installation locale

```bash
npm install
cp .env.example .env.local
# renseigner NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY (Project Settings > API dans Supabase)
```

## 3. Base de données

Dans le tableau de bord Supabase (SQL Editor), exécuter dans l'ordre :

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`
3. (optionnel, pour tester immédiatement) `supabase/seed.sql`

Ou, avec la CLI Supabase installée :

```bash
supabase link --project-ref <votre-ref-projet>
supabase db push
```

## 4. Buckets de stockage

Créer deux buckets dans Supabase Storage :

- `evidence` (privé) — photos, vidéos, audio des inspections
- `reports` (privé) — PDF générés

Activer l'accès par URL signée (déjà utilisé dans le code via
`createSignedUrl`) plutôt que de rendre les buckets publics, pour respecter
la confidentialité des données client.

## 5. Authentification

Dans Supabase Auth, créer les premiers comptes utilisateurs (email/mot de
passe suffit pour le MVP), puis leur associer une ligne dans
`users_profile` :

```sql
insert into users_profile (id, workshop_id, full_name, role)
values ('<uuid-auth-user>', '00000000-0000-0000-0000-000000000001', 'Nom Prénom', 'mecanicien');
```

(Remplacer l'UUID de l'atelier par celui inséré via `supabase/seed.sql`, ou
créer votre propre atelier au préalable.)

## 6. Lancer en local

```bash
npm run dev
```

L'application est accessible sur http://localhost:3000, avec redirection
automatique vers `/login` si non connecté.

## 7. Déploiement Vercel

```bash
npm i -g vercel
vercel
```

Renseigner les mêmes variables d'environnement que `.env.local` dans les
paramètres du projet Vercel (Environment Variables). Le build Next.js
standard fonctionne sans configuration supplémentaire.

## 8. Configurer le moteur IA

Par défaut (`AI_DEFAULT_PROVIDER=mock`), l'application fonctionne sans
aucune clé IA — utile pour valider le flux complet en atelier avant de
payer un abonnement API. Pour activer une IA réelle :

```bash
OPENAI_API_KEY=sk-...
AI_DEFAULT_PROVIDER=openai
```

Pour répartir les tâches entre plusieurs moteurs (ex : Claude pour le
diagnostic, GPT-4o pour la vidéo) :

```bash
AI_TASK_ROUTING={"diagnostic":"anthropic","video":"openai"}
```

Aucun redéploiement de code n'est nécessaire, uniquement une mise à jour des
variables d'environnement.

## 9. Export des données (indépendance, §17 du cahier des charges)

Le schéma étant standard PostgreSQL, un export complet est possible à tout
moment via :

```bash
supabase db dump --data-only > export.sql
```

ou via l'outil de sauvegarde intégré de Supabase (CSV par table depuis le
Table Editor). Les fichiers (buckets `evidence`, `reports`) s'exportent avec
la CLI `supabase storage` ou un script utilisant `@supabase/supabase-js`
(`storage.from('evidence').list()` puis téléchargement).
