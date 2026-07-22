export interface Vehicle {
  id: string;
  workshop_id: string;
  vin: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  customer_id: string | null;
  created_at: string;
}

export type EventType =
  | "inspection" | "diagnostic" | "entretien" | "reparation" | "controle"
  | "essai_routier" | "contre_visite" | "expertise" | "devis_technique"
  | "reception_vehicule" | "suivi_post_intervention";

export interface TechnicalEvent {
  id: string;
  vehicle_id: string;
  event_type: EventType;
  title: string;
  status: "brouillon" | "en_cours" | "termine" | "archive";
  mileage: number | null;
  created_at: string;
  closed_at: string | null;
}

export type ObservationState =
  | "ouverte" | "surveillee" | "confirmee" | "reparee" | "remplacee" | "resolue" | "classee_sans_suite";

export interface Observation {
  id: string;
  event_id: string;
  component_id: string;
  title: string;
  description: string;
  state: ObservationState;
  severity: number;
  urgency: number;
  confidence: number | null;
  wear_percent: number | null;
  remaining_percent: number | null;
  recommendation: string | null;
  include_in_client_report: boolean;
  created_at: string;
}

export type EvidenceType =
  | "photo" | "video" | "audio" | "mesure" | "capture_ecran" | "rapport_pdf"
  | "document_constructeur" | "releve_valise" | "releve_pression" | "releve_temperature";

export interface Evidence {
  id: string;
  observation_id: string | null;
  event_id: string | null;
  type: EvidenceType;
  storage_path: string;
  duration_seconds: number | null;
  captured_context: string | null;
  is_before: boolean | null;
  privacy_reviewed: boolean;
  ai_analysis_status: "non_demandee" | "en_attente" | "en_cours" | "terminee" | "echec";
  created_at: string;
}

export interface Component {
  id: string;
  family_id: string;
  code: string;
  label: string;
  side: string | null;
  status: "valide" | "proposition" | "rejete";
}
