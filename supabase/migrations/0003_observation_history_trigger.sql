-- ============================================================================
-- Historisation automatique : toute évolution d'une observation (état,
-- gravité, urgence, recommandation) crée une ligne dans observation_history,
-- sans dépendre de ce que l'application pense bien faire à chaque écran.
-- Complète le principe "aucune suppression silencieuse" (cahier des charges §11).
-- ============================================================================

create or replace function log_observation_change() returns trigger as $$
declare
  diff jsonb := '{}'::jsonb;
begin
  if old.state is distinct from new.state then
    diff := diff || jsonb_build_object('state', jsonb_build_object('avant', old.state, 'apres', new.state));
  end if;
  if old.severity is distinct from new.severity then
    diff := diff || jsonb_build_object('severity', jsonb_build_object('avant', old.severity, 'apres', new.severity));
  end if;
  if old.urgency is distinct from new.urgency then
    diff := diff || jsonb_build_object('urgency', jsonb_build_object('avant', old.urgency, 'apres', new.urgency));
  end if;
  if old.recommendation is distinct from new.recommendation then
    diff := diff || jsonb_build_object('recommendation', jsonb_build_object('avant', old.recommendation, 'apres', new.recommendation));
  end if;

  if diff <> '{}'::jsonb then
    insert into observation_history (observation_id, previous_state, new_state, diff)
    values (new.id, old.state, new.state, diff);
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_observation_history
  after update on observations
  for each row execute function log_observation_change();
