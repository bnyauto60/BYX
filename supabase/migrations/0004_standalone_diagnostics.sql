-- ============================================================================
-- Diagnostics autonomes : un événement technique peut désormais exister sans
-- véhicule rattaché (cas d'un passage rapide entre deux rendez-vous, type
-- contrôle valise). Le véhicule peut être relié après coup.
-- ============================================================================

alter table technical_events
  alter column technical_record_id drop not null,
  alter column vehicle_id drop not null;

-- Un événement autonome n'a pas de véhicule (donc pas d'atelier déductible
-- par jointure) : on stocke l'atelier directement sur l'événement pour que
-- la RLS reste applicable même sans véhicule.
alter table technical_events
  add column workshop_id uuid references workshops(id);

-- Remplit workshop_id pour les événements déjà liés à un véhicule (rétro-compatibilité).
update technical_events te
set workshop_id = v.workshop_id
from vehicles v
where te.vehicle_id = v.id and te.workshop_id is null;

-- Un événement doit toujours avoir soit un véhicule, soit un atelier explicite.
alter table technical_events
  add constraint chk_event_has_workshop_or_vehicle
  check (vehicle_id is not null or workshop_id is not null);

-- Remplace la policy d'isolation pour couvrir les deux cas (avec ou sans véhicule).
drop policy if exists technical_events_isolation on technical_events;
create policy technical_events_isolation on technical_events for all
  using (
    (vehicle_id is not null and vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
    or (vehicle_id is null and workshop_id = current_workshop_id())
  )
  with check (
    (vehicle_id is not null and vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
    or (vehicle_id is null and workshop_id = current_workshop_id())
  );

-- Les policies qui joignaient observations/evidence/measurements/reports/ai_analyses
-- via technical_events -> vehicles doivent aussi couvrir les événements sans véhicule.
drop policy if exists observations_isolation on observations;
create policy observations_isolation on observations for all
  using (event_id in (
    select te.id from technical_events te
    where (te.vehicle_id is not null and te.vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
       or (te.vehicle_id is null and te.workshop_id = current_workshop_id())
  ));

drop policy if exists evidence_isolation on evidence;
create policy evidence_isolation on evidence for all
  using (
    event_id in (
      select te.id from technical_events te
      where (te.vehicle_id is not null and te.vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
         or (te.vehicle_id is null and te.workshop_id = current_workshop_id())
    )
    or observation_id in (
      select o.id from observations o
      join technical_events te on te.id = o.event_id
      where (te.vehicle_id is not null and te.vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
         or (te.vehicle_id is null and te.workshop_id = current_workshop_id())
    )
  );

drop policy if exists measurements_isolation on measurements;
create policy measurements_isolation on measurements for all
  using (event_id in (
    select te.id from technical_events te
    where (te.vehicle_id is not null and te.vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
       or (te.vehicle_id is null and te.workshop_id = current_workshop_id())
  ));

drop policy if exists reports_isolation on reports;
create policy reports_isolation on reports for all
  using (event_id in (
    select te.id from technical_events te
    where (te.vehicle_id is not null and te.vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
       or (te.vehicle_id is null and te.workshop_id = current_workshop_id())
  ));

drop policy if exists ai_analyses_isolation on ai_analyses;
create policy ai_analyses_isolation on ai_analyses for all
  using (event_id in (
    select te.id from technical_events te
    where (te.vehicle_id is not null and te.vehicle_id in (select id from vehicles where workshop_id = current_workshop_id()))
       or (te.vehicle_id is null and te.workshop_id = current_workshop_id())
  ));
