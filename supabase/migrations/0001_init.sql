-- ============================================================================
-- BYX — Schéma initial
-- Principe : Véhicule → Carnet de Santé Technique (CST) → Événement Technique
--            → Observation Technique → Preuve Technique
-- Décisions clés (voir docs/DECISIONS.md) :
--   - Le VIN est la clé pivot forte du véhicule (l'immatriculation est mutable).
--   - Aucune suppression physique des observations/preuves (deleted_at only).
--   - Toute évolution d'observation crée une ligne dans observation_history.
--   - Les preuves (evidence) couvrent photo ET vidéo de façon symétrique.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Ateliers, utilisateurs, clients
-- ----------------------------------------------------------------------------

create table workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  address text,
  siret text,
  created_at timestamptz not null default now()
);

create type user_role as enum ('admin', 'atelier_responsable', 'mecanicien', 'lecteur', 'client_externe');

create table users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  workshop_id uuid not null references workshops(id) on delete restrict,
  full_name text not null,
  role user_role not null default 'mecanicien',
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  -- Consentement RGPD explicite requis avant tout enregistrement photo/vidéo du véhicule
  consent_media boolean not null default false,
  consent_media_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Référentiel des composants (gouverné, extensible sans fragmentation)
-- ----------------------------------------------------------------------------

create table component_families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,     -- ex: 'freinage'
  label text not null            -- ex: 'Freinage'
);

create type component_status as enum ('valide', 'proposition', 'rejete');

create table components (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references component_families(id) on delete restrict,
  code text not null unique,      -- ex: 'plaquettes_avant'
  label text not null,            -- ex: 'Plaquettes avant'
  side text,                      -- 'avant_gauche' | 'avant_droit' | 'arriere_gauche' | 'arriere_droit' | null
  status component_status not null default 'valide',
  -- Gouvernance : un mécanicien qui ne trouve pas son composant peut le proposer.
  -- Il reste en 'proposition' jusqu'à validation par un atelier_responsable ou admin,
  -- évitant la fragmentation du référentiel (ex: "plaquette avt" vs "plaquettes avant").
  proposed_by uuid references users_profile(id),
  validated_by uuid references users_profile(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Véhicules — le VIN est la clé pivot forte, l'immatriculation est mutable
-- ----------------------------------------------------------------------------

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  vin text not null,                    -- clé pivot forte, unique par atelier
  plate text not null,                  -- mutable : une plaque peut changer de véhicule
  plate_history jsonb not null default '[]'::jsonb, -- [{plate, from, to}] pour traçabilité
  make text,
  model text,
  version text,
  engine text,
  fuel_type text,
  gearbox text,
  power_hp integer,
  year integer,
  first_registration_date date,
  mileage integer,
  color text,
  customer_id uuid references customers(id) on delete set null,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, vin)
);

create index idx_vehicles_plate on vehicles (workshop_id, plate);
create index idx_vehicles_vin on vehicles (workshop_id, vin);

-- Un véhicule possède un seul CST : la table matérialise ce lien 1-1
-- et sert d'ancrage pour les agrégats calculés (voir vehicle_health_snapshots).
create table technical_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null unique references vehicles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Événements techniques
-- ----------------------------------------------------------------------------

create type event_type as enum (
  'inspection', 'diagnostic', 'entretien', 'reparation', 'controle',
  'essai_routier', 'contre_visite', 'expertise', 'devis_technique',
  'reception_vehicule', 'suivi_post_intervention'
);

create type event_status as enum ('brouillon', 'en_cours', 'termine', 'archive');

create table technical_events (
  id uuid primary key default gen_random_uuid(),
  technical_record_id uuid not null references technical_records(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  event_type event_type not null,
  title text not null,
  description text,
  technician_id uuid references users_profile(id),
  mileage integer,
  status event_status not null default 'brouillon',
  -- Origine locale pour la synchronisation offline-first (voir docs/ARCHITECTURE.md §Offline)
  client_uuid uuid, -- généré côté appareil avant toute connexion réseau, pour dédupliquer à la sync
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index idx_events_client_uuid on technical_events (client_uuid) where client_uuid is not null;

-- ----------------------------------------------------------------------------
-- 5. Observations techniques (unité de connaissance de base) + historique
-- ----------------------------------------------------------------------------

create type observation_state as enum (
  'ouverte', 'surveillee', 'confirmee', 'reparee', 'remplacee', 'resolue', 'classee_sans_suite'
);

-- Gravité et urgence sont volontairement deux échelles distinctes (cahier des charges §5) :
-- une courroie proche de l'échéance peut être urgente sans être défectueuse.
create table observations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references technical_events(id) on delete cascade,
  component_id uuid not null references components(id) on delete restrict,
  title text not null,
  description text not null,
  state observation_state not null default 'ouverte',
  severity smallint not null check (severity between 0 and 6), -- 0=Information … 6=Danger/immobilisation
  urgency smallint not null check (urgency between 0 and 6),
  confidence numeric(3,2) check (confidence between 0 and 1), -- confiance de l'IA ou du technicien
  -- Toute donnée d'usure doit stocker les deux faces pour lever toute ambiguïté
  -- (cf. cahier des charges §8.3 — "usure 40% / reste 60%" ne doit jamais être implicite).
  wear_percent numeric(5,2),
  remaining_percent numeric(5,2),
  mileage integer,
  technician_id uuid references users_profile(id),
  recommendation text,
  next_check_date date,
  next_check_mileage integer,
  previous_observation_id uuid references observations(id), -- lien vers le constat précédent sur le même point
  include_in_client_report boolean not null default true,
  -- Garde-fou sécurité : une observation classée urgente/dangereuse (severity/urgency >= 5)
  -- ne peut JAMAIS être exclue du rapport client. Appliqué en base ET côté application.
  constraint chk_urgent_always_reported check (
    not (greatest(severity, urgency) >= 5 and include_in_client_report = false)
  ),
  deleted_at timestamptz, -- suppression logique uniquement, jamais physique
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_uuid uuid
);

create unique index idx_observations_client_uuid on observations (client_uuid) where client_uuid is not null;
create index idx_observations_event on observations (event_id);
create index idx_observations_component on observations (component_id);

create table observation_history (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references observations(id) on delete cascade,
  changed_by uuid references users_profile(id),
  previous_state observation_state,
  new_state observation_state,
  diff jsonb not null,           -- champs modifiés {champ: {avant, apres}}
  reason text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. Preuves techniques — photo ET vidéo traitées symétriquement
-- ----------------------------------------------------------------------------

create type evidence_type as enum (
  'photo', 'video', 'audio', 'mesure', 'capture_ecran', 'rapport_pdf',
  'document_constructeur', 'releve_valise', 'releve_pression', 'releve_temperature'
);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references observations(id) on delete cascade,
  event_id uuid references technical_events(id) on delete cascade,
  type evidence_type not null,
  storage_path text not null,           -- chemin dans Supabase Storage (bucket 'evidence')
  duration_seconds integer,             -- pour vidéo/audio
  captured_context text,                -- ex: 'bruit_moteur','vibration','suspension','fuite','tableau_de_bord','fumee','essai_routier'
  author_id uuid references users_profile(id),
  comment text,
  is_before boolean,                    -- avant / après intervention, pour comparaison visuelle
  privacy_reviewed boolean not null default false, -- confirme : cadrage technique uniquement, pas d'habitacle habité / tiers identifiables
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  -- Analyse IA de la vidéo/photo, calculée en tâche asynchrone (voir ai_analyses)
  ai_analysis_status text not null default 'non_demandee' check (ai_analysis_status in ('non_demandee','en_attente','en_cours','terminee','echec')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (observation_id is not null or event_id is not null)
);

create index idx_evidence_observation on evidence (observation_id);
create index idx_evidence_event on evidence (event_id);

-- ----------------------------------------------------------------------------
-- 7. Mesures
-- ----------------------------------------------------------------------------

create table measurements (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references observations(id) on delete cascade,
  event_id uuid not null references technical_events(id) on delete cascade,
  component_id uuid references components(id),
  label text not null,          -- ex: 'Épaisseur plaquette'
  value numeric not null,
  unit text not null,           -- 'mm','bar','°C','V','%','ms'...
  method text,
  reference_threshold text,
  is_compliant boolean,
  technician_id uuid references users_profile(id),
  mileage integer,
  evidence_id uuid references evidence(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. Recommandations
-- ----------------------------------------------------------------------------

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references observations(id) on delete cascade,
  label text not null,
  priority smallint not null check (priority between 0 and 6),
  due_date date,
  due_mileage integer,
  status text not null default 'ouverte' check (status in ('ouverte','planifiee','realisee','abandonnee')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. Rapports (vues générées à partir du CST — jamais la source de vérité)
-- ----------------------------------------------------------------------------

create type report_kind as enum ('client', 'technique', 'interne');

create table reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references technical_events(id) on delete cascade,
  kind report_kind not null,
  version integer not null default 1,
  content jsonb not null,        -- snapshot structuré utilisé pour générer le PDF
  pdf_storage_path text,
  generated_by uuid references users_profile(id),
  created_at timestamptz not null default now()
);

create table report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  version integer not null,
  content jsonb not null,
  pdf_storage_path text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. IA — traçabilité des analyses, indépendante du fournisseur
-- ----------------------------------------------------------------------------

create table ai_analyses (
  id uuid primary key default gen_random_uuid(),
  task text not null,                 -- 'structuration' | 'diagnostic' | 'comparaison' | 'rapport' | 'video'
  provider text not null,             -- 'openai' | 'anthropic' | 'mock' | ...
  model text not null,
  input_ref jsonb not null,           -- pointeurs vers observation/evidence/event concernés
  output jsonb not null,
  confidence numeric(3,2),
  latency_ms integer,
  event_id uuid references technical_events(id) on delete set null,
  observation_id uuid references observations(id) on delete set null,
  evidence_id uuid references evidence(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 11. État calculé des composants et santé générale (vues matérialisées légères)
-- ----------------------------------------------------------------------------

create table component_states (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  component_id uuid not null references components(id) on delete restrict,
  current_state text not null,
  severity smallint,
  recommendation text,
  next_check_date date,
  next_check_mileage integer,
  last_observation_id uuid references observations(id),
  computed_at timestamptz not null default now(),
  unique (vehicle_id, component_id)
);

create table vehicle_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  overall_state text not null,          -- ex: 'bon' | 'a_surveiller' | 'intervention_conseillee' | 'danger'
  urgent_count integer not null default 0,
  watch_count integer not null default 0,
  recommended_count integer not null default 0,
  explanation jsonb not null,           -- liste des observations qui justifient le score (jamais un score opaque)
  computed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. Journal d'audit (RGPD, traçabilité, sécurité)
-- ----------------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references workshops(id),
  actor_id uuid references users_profile(id),
  action text not null,          -- 'create'|'update'|'delete_logical'|'export'|'view_sensitive'
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. updated_at automatique
-- ----------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_vehicles_updated_at before update on vehicles
  for each row execute function set_updated_at();
create trigger trg_observations_updated_at before update on observations
  for each row execute function set_updated_at();
