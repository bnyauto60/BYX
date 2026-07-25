-- ============================================================================
-- Dossier historique du vehicule -- archive de photos/documents/notes
-- anterieurs a BYX, rattaches directement au vehicule (pas a un evenement
-- technique), pour conserver l'historique deja existant avant l'usage de
-- l'application (amelioration demandee).
-- ============================================================================

create type archive_item_type as enum ('photo', 'document', 'note');

create table vehicle_archive_items (
    id uuid primary key default gen_random_uuid(),
    vehicle_id uuid not null references vehicles(id) on delete cascade,
    type archive_item_type not null,
    label text,
    note_text text,
    storage_path text,
    file_name text,
    mime_type text,
    file_size integer,
    author_id uuid references users_profile(id),
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    -- Un element porte soit un fichier (storage_path), soit une note texte libre, soit les deux
  check (storage_path is not null or note_text is not null)
  );

create index idx_vehicle_archive_vehicle on vehicle_archive_items (vehicle_id);

alter table vehicle_archive_items enable row level security;

create policy vehicle_archive_isolation on vehicle_archive_items for all
using (vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
with check (vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()));
