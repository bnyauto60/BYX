/**
 * Couche d'abstraction IA — BYX ne dépend d'aucun fournisseur unique.
 *
 * Chaque provider (OpenAI, Anthropic, futur modèle) implémente la même
 * interface AIProvider. Le reste de l'application (routes API, composants)
 * n'appelle jamais un SDK de fournisseur directement : il passe toujours
 * par lib/ai/router.ts::runAITask(), qui choisit le provider selon la tâche.
 *
 * Pour ajouter un nouveau fournisseur : implémenter AIProvider dans
 * lib/ai/providers/<nom>.ts puis l'enregistrer dans router.ts. Aucun autre
 * fichier du projet n'a besoin d'être modifié.
 */

export type AITask =
  | "structuration"   // dictée / texte libre -> observation structurée
  | "diagnostic"       // hypothèses de diagnostic à partir d'observations/mesures
  | "comparaison"      // comparaison avec l'historique du véhicule
  | "rapport"          // génération du texte des rapports (client/technique/interne)
  | "video"            // analyse d'une vidéo de diagnostic (asynchrone ou temps réel)
  | "document"         // extraction de champs depuis une photo (carte grise, fiche client) ou une dictée
  | "command";         // interprétation d'une commande vocale globale ("cherche AB123CD", "nouveau véhicule"...)

export interface AIMessage {
  role: "system" | "user";
  content: string;
}

export interface AITextRequest {
  task: AITask;
  messages: AIMessage[];
  /** Force un format de réponse JSON strict, avec schéma indicatif en commentaire du prompt. */
  jsonMode?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AITextResponse {
  provider: string;
  model: string;
  text: string;
  /** Confiance auto-évaluée si le modèle la fournit dans le JSON, sinon undefined. */
  confidence?: number;
  latencyMs: number;
  raw?: unknown;
}

export interface AIVideoAnalysisRequest {
  task: "video";
  /** URL signée temporaire vers le fichier vidéo dans Supabase Storage. */
  videoUrl: string;
  /** Contexte donné par le mécanicien : 'bruit_moteur' | 'vibration' | 'fuite' | etc. */
  capturedContext?: string;
  /** true si un flux temps réel doit être analysé image par image plutôt qu'un fichier fini. */
  realtime?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AIVideoAnalysisResponse {
  provider: string;
  model: string;
  summary: string;
  observedSigns: string[];
  suggestedComponent?: string;
  confidence?: number;
  latencyMs: number;
  raw?: unknown;
}

/** Extraction de champs véhicule/client depuis une photo (carte grise, fiche
 * client, plaque) ou depuis une dictée libre — au choix, l'une des deux. */
export interface AIDocumentExtractionRequest {
  task: "document";
  imageBase64?: string;
  imageMediaType?: string;
  text?: string;
  kind: "registration" | "customer_card" | "plate_photo" | "voice";
}

export interface AIDocumentExtractionResponse {
  provider: string;
  model: string;
  vin: string | null;
  plate: string | null;
  make: string | null;
  model_name: string | null;
  year: number | null;
  mileage: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  confidence: number;
  latencyMs: number;
}

/** Interprétation d'une commande vocale globale, dictée depuis le bouton
 * micro flottant présent partout dans l'app. */
export interface AICommandRequest {
  task: "command";
  text: string;
}

export interface AICommandResponse {
  provider: string;
  action: "search_vehicle" | "new_vehicle" | "new_diagnostic" | "unknown";
  query: string | null;
}

export interface AIProvider {
  /** Identifiant stable utilisé dans AI_TASK_ROUTING et stocké dans ai_analyses.provider */
  id: string;
  /** Tâches que ce provider sait effectivement traiter. */
  supports: AITask[];
  runText(req: AITextRequest): Promise<AITextResponse>;
  /** Optionnel : seuls certains providers savent analyser une vidéo. */
  runVideoAnalysis?(req: AIVideoAnalysisRequest): Promise<AIVideoAnalysisResponse>;
  /** Optionnel : capacité d'analyse en flux temps réel (voir docs/ARCHITECTURE.md §Vidéo temps réel). */
  supportsRealtime?: boolean;
  /** Optionnel : extraction de champs depuis une photo de document ou une dictée. */
  extractDocument?(req: AIDocumentExtractionRequest): Promise<AIDocumentExtractionResponse>;
  /** Optionnel : interprétation d'une commande vocale globale. */
  interpretCommand?(req: AICommandRequest): Promise<AICommandResponse>;
}

/** Résultat structuré attendu pour la tâche "structuration" (dictée -> observation). */
export interface StructuredObservation {
  component_code: string | null;
  component_label_if_unknown: string | null;
  side: string | null;
  category: string | null;
  title: string;
  description: string;
  state: "ouverte" | "surveillee" | "confirmee";
  severity: number; // 0-6
  urgency: number;  // 0-6
  wear_percent: number | null;
  remaining_percent: number | null;
  recommendation: string | null;
  confidence: number; // 0-1
  needs_confirmation: boolean;
  clarifying_question: string | null;
}
