-- ============================================================================
-- Row Level Security — isolation stricte par atelier (multi-tenant),
-- droits différenciés par rôle (admin, atelier_responsable, mecanicien, lecteur).
-- ============================================================================

alter table workshops enable row level security;
alter table users_profile enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table technical_records enable row level security;
alter table technical_events enable row level security;
alter table observations enable row level security;
alter table observation_history enable row level security;
alter table evidence enable row level security;
alter table measurements enable row level security;
alter table recommendations enable row level security;
alter table reports enable row level security;
alter table report_versions enable row level security;
alter table ai_analyses enable row level security;
alter table component_states enable row level security;
alter table vehicle_health_snapshots enable row level security;
alter table audit_logs enable row level security;
alter table components enable row level security;
alter table component_families enable row level security;

create or replace function current_workshop_id() returns uuid as $$
  select workshop_id from users_profile where id = auth.uid();
$$ language sql stable security definer;

create or replace function current_user_role() returns user_role as $$
  select role from users_profile where id = auth.uid();
$$ language sql stable security definer;

-- Référentiel des composants : lecture pour tous les membres de l'atelier,
-- écriture (proposition) pour tous, validation réservée aux rôles responsables.
create policy component_families_read on component_families for select using (true);
create policy components_read on components for select using (true);
create policy components_propose on components for insert
  with check (auth.uid() is not null);
create policy components_validate on components for update
  using (current_user_role() in ('admin','atelier_responsable'));

-- Isolation stricte par atelier sur toutes les tables métier
create policy workshops_self on workshops for select using (id = current_workshop_id());

create policy users_profile_same_workshop on users_profile for select
  using (workshop_id = current_workshop_id());

create policy customers_isolation on customers for all
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

create policy vehicles_isolation on vehicles for all
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

create policy technical_records_isolation on technical_records for all
  using (vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()));

create policy technical_events_isolation on technical_events for all
  using (vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()));

create policy observations_isolation on observations for all
  using (event_id in (
    select te.id from technical_events te
    join vehicles v on v.id = te.vehicle_id
    where v.workshop_id = current_workshop_id()
  ));

create policy observation_history_isolation on observation_history for select
  using (observation_id in (
    select o.id from observations o
    join technical_events te on te.id = o.event_id
    join vehicles v on v.id = te.vehicle_id
    where v.workshop_id = current_workshop_id()
  ));

create policy evidence_isolation on evidence for all
  using (
    event_id in (select te.id from technical_events te join vehicles v on v.id = te.vehicle_id where v.workshop_id = current_workshop_id())
    or observation_id in (
      select o.id from observations o
      join technical_events te on te.id = o.event_id
      join vehicles v on v.id = te.vehicle_id
      where v.workshop_id = current_workshop_id()
    )
  );

create policy measurements_isolation on measurements for all
  using (event_id in (select te.id from technical_events te join vehicles v on v.id = te.vehicle_id where v.workshop_id = current_workshop_id()));

create policy recommendations_isolation on recommendations for all
  using (observation_id in (
    select o.id from observations o
    join technical_events te on te.id = o.event_id
    join vehicles v on v.id = te.vehicle_id
    where v.workshop_id = current_workshop_id()
  ));

create policy reports_isolation on reports for all
  using (event_id in (select te.id from technical_events te join vehicles v on v.id = te.vehicle_id where v.workshop_id = current_workshop_id()));

create policy report_versions_isolation on report_versions for select
  using (report_id in (
    select r.id from reports r
    join technical_events te on te.id = r.event_id
    join vehicles v on v.id = te.vehicle_id
    where v.workshop_id = current_workshop_id()
  ));

create policy ai_analyses_isolation on ai_analyses for all
  using (event_id in (select te.id from technical_events te join vehicles v on v.id = te.vehicle_id where v.workshop_id = current_workshop_id()));

create policy component_states_isolation on component_states for all
  using (vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()));

create policy vehicle_health_isolation on vehicle_health_snapshots for all
  using (vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()));

-- Journal d'audit : lecture réservée admin / responsable atelier, jamais de update/delete applicatif
create policy audit_logs_read on audit_logs for select
  using (workshop_id = current_workshop_id() and current_user_role() in ('admin','atelier_responsable'));
create policy audit_logs_insert on audit_logs for insert
  with check (workshop_id = current_workshop_id());

-- Rôle 'lecteur' et 'client_externe' : lecture seule, appliquée au niveau applicatif
-- (les policies ci-dessus autorisent 'all' pour simplifier le prototype ; en production,
-- séparer explicitement select / insert / update / delete par rôle — voir docs/DECISIONS.md).
