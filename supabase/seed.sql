-- ============================================================================
-- Données de démonstration BYX — un atelier, un mécanicien, deux véhicules,
-- couvrant les trois exemples du cahier des charges (pneu, freinage, ABS).
-- À exécuter après 0001_init.sql et 0002_rls.sql : supabase db execute -f supabase/seed.sql
-- ============================================================================

insert into workshops (id, name, city, address) values
  ('00000000-0000-0000-0000-000000000001', 'BNY Auto', 'Chevrières (60)', '2 rue de l''Atelier, 60730 Chevrières');

insert into component_families (id, code, label) values
  ('10000000-0000-0000-0000-000000000001', 'freinage', 'Freinage'),
  ('10000000-0000-0000-0000-000000000002', 'pneumatiques', 'Pneumatiques'),
  ('10000000-0000-0000-0000-000000000003', 'electronique', 'Électronique');

insert into components (id, family_id, code, label, side, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'plaquettes_avant', 'Plaquettes avant', null, 'valide'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'pneu_arriere_gauche', 'Pneu arrière gauche', 'arriere_gauche', 'valide'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'bloc_abs', 'Bloc ABS', null, 'valide');

insert into customers (id, workshop_id, full_name, phone, email, consent_media, consent_media_at) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'M. Lefèvre', '0600000000', 'lefevre@example.com', true, now());

insert into vehicles (id, workshop_id, vin, plate, make, model, year, mileage, customer_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'VF1AB000000000001', 'AB-123-CD', 'Renault', 'Clio IV', 2015, 118400, '30000000-0000-0000-0000-000000000001');

insert into technical_records (id, vehicle_id) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');

insert into technical_events (id, technical_record_id, vehicle_id, event_type, title, mileage, status) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'inspection', 'Inspection générale', 118400, 'termine');

-- Exemple 1 — pneu (cahier des charges §21)
insert into observations (id, event_id, component_id, title, description, state, severity, urgency, confidence, recommendation, include_in_client_report)
values (
  '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  'Pneu arrière gauche dégradé',
  'Pneu daté de 2016, craquelures, réparation antérieure par mèche, crevaison proche du flanc.',
  'confirmee', 5, 5, 0.9, 'Remplacement recommandé pour raison de sécurité', true
);

-- Exemple 2 — freinage (usure/restant explicites, jamais ambigu)
insert into observations (id, event_id, component_id, title, description, state, severity, urgency, confidence, wear_percent, remaining_percent, recommendation, include_in_client_report)
values (
  '70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  'Plaquettes avant', 'Usure normale constatée au contrôle visuel.',
  'ouverte', 1, 0, 0.85, 40.0, 60.0, 'Contrôle au prochain entretien', true
);

-- Exemple 3 — ABS (hypothèse IA avec confiance, jamais un diagnostic certain)
insert into observations (id, event_id, component_id, title, description, state, severity, urgency, confidence, recommendation, include_in_client_report)
values (
  '70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003',
  'Absence de pression sortie AR droite du bloc ABS',
  'Les trois autres sorties fonctionnent normalement. Hypothèse : défaillance interne du bloc ABS. À confirmer après vérification de l''alimentation en entrée.',
  'surveillee', 4, 4, 0.7, 'Contrôler l''alimentation en entrée avant de statuer sur le remplacement', true
);
