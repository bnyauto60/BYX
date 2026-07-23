import type {
  AIProvider,
  AITextRequest,
  AITextResponse,
  AIVideoAnalysisRequest,
  AIVideoAnalysisResponse,
  AIDocumentExtractionRequest,
  AIDocumentExtractionResponse,
  AICommandRequest,
  AICommandResponse
} from "../types";

/**
 * Provider "mock" — aucune clé API requise. Utilisé par défaut (AI_DEFAULT_PROVIDER=mock)
 * pour que le prototype soit testable en atelier immédiatement, sans dépendre
 * d'un compte OpenAI/Anthropic. Produit des réponses structurées plausibles
 * par extraction de mots-clés simples, à remplacer par un vrai moteur dès
 * qu'une clé API est configurée (aucune autre partie du code à modifier).
 */
export const mockProvider: AIProvider = {
  id: "mock",
  supports: ["structuration", "diagnostic", "comparaison", "rapport", "video"],
  supportsRealtime: false,

  async runText(req: AITextRequest): Promise<AITextResponse> {
    const start = Date.now();
    const lastUserMessage = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    let text: string;
    switch (req.task) {
      case "structuration":
        text = JSON.stringify(mockStructuration(lastUserMessage));
        break;
      case "rapport":
        text = JSON.stringify({ summary: "Synthèse générée par le provider mock à titre de démonstration." });
        break;
      default:
        text = JSON.stringify({ note: "Réponse mock — configurez OPENAI_API_KEY ou ANTHROPIC_API_KEY pour une analyse réelle." });
    }

    return {
      provider: "mock",
      model: "mock-v1",
      text,
      confidence: 0.5,
      latencyMs: Date.now() - start
    };
  },

  async runVideoAnalysis(req: AIVideoAnalysisRequest): Promise<AIVideoAnalysisResponse> {
    const start = Date.now();
    return {
      provider: "mock",
      model: "mock-v1",
      summary: `Analyse simulée pour le contexte "${req.capturedContext ?? "non précisé"}". Configurez une clé IA réelle pour une analyse effective.`,
      observedSigns: [],
      confidence: 0.3,
      latencyMs: Date.now() - start
    };
  },

  async extractDocument(req: AIDocumentExtractionRequest): Promise<AIDocumentExtractionResponse> {
    const start = Date.now();
    const text = req.text ?? "";
    const plateMatch = text.match(/\b([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{2})\b/i);
    const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    const phoneMatch = text.match(/\b0[1-9](\s?\d{2}){4}\b/);

    return {
      provider: "mock",
      model: "mock-v1",
      vin: vinMatch?.[1] ? vinMatch[1].toUpperCase() : null,
      plate: plateMatch?.[1] ? plateMatch[1].toUpperCase().replace(/\s/g, "-") : null,
      make: null,
      model_name: null,
      year: yearMatch ? Number(yearMatch[0]) : null,
      mileage: null,
      customer_name: null,
      customer_phone: phoneMatch?.[0] ?? null,
      confidence: req.imageBase64 ? 0.2 : 0.5,
      latencyMs: Date.now() - start
    };
  },

  async interpretCommand(req: AICommandRequest): Promise<AICommandResponse> {
    const lower = req.text.toLowerCase();
    if (/nouveau v[ée]hicule|cr[ée]e? un v[ée]hicule/.test(lower)) {
      return { provider: "mock", action: "new_vehicle", query: null };
    }
    if (/diagnostic|contr[ôo]le valise|passage rapide/.test(lower)) {
      return { provider: "mock", action: "new_diagnostic", query: null };
    }
    if (/cherche|recherch|trouve/.test(lower)) {
      return { provider: "mock", action: "search_vehicle", query: req.text.replace(/cherche|recherche|trouve/gi, "").trim() };
    }
    return { provider: "mock", action: "unknown", query: null };
  }
};

function mockStructuration(input: string) {
  const lower = input.toLowerCase();
  const wearMatch = lower.match(/(\d{1,3})\s*%/);
  const wear = wearMatch ? Number(wearMatch[1]) : null;

  const isPneu = /pneu/.test(lower);
  const isPlaquette = /plaquette/.test(lower);
  const isFuite = /fuite/.test(lower);
  const urgent = /craquel|crevaison|danger|urgent/.test(lower);

  return {
    component_code: isPneu ? "pneu_arriere_gauche" : isPlaquette ? "plaquettes_avant" : null,
    component_label_if_unknown: !isPneu && !isPlaquette ? "Composant à préciser" : null,
    side: /gauche/.test(lower) ? "gauche" : /droit/.test(lower) ? "droit" : null,
    category: isPneu ? "pneumatiques" : isPlaquette ? "freinage" : isFuite ? "moteur" : null,
    title: input.slice(0, 60),
    description: input,
    state: "ouverte",
    severity: urgent ? 5 : 1,
    urgency: urgent ? 5 : 0,
    wear_percent: wear,
    remaining_percent: wear !== null ? 100 - wear : null,
    recommendation: urgent ? "Intervention conseillée" : "Contrôle au prochain entretien",
    confidence: 0.5,
    needs_confirmation: false,
    clarifying_question: null
  };
}
