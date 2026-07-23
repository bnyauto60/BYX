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
import { DOCUMENT_EXTRACTION_SYSTEM_PROMPT, COMMAND_INTERPRETATION_SYSTEM_PROMPT } from "../prompts";

const API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Provider OpenAI. N'est jamais appelé directement en dehors de ce fichier :
 * voir lib/ai/router.ts. Pour changer de modèle, modifier OPENAI_MODEL dans
 * .env — aucune modification de code nécessaire.
 */
export const openaiProvider: AIProvider = {
  id: "openai",
  supports: ["structuration", "diagnostic", "comparaison", "rapport", "video"],
  supportsRealtime: true, // via Realtime API — voir docs/ARCHITECTURE.md §Vidéo temps réel

  async runText(req: AITextRequest): Promise<AITextResponse> {
    const start = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquant — configurez .env ou utilisez AI_DEFAULT_PROVIDER=mock");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: req.messages,
        response_format: req.jsonMode ? { type: "json_object" } : undefined,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      text,
      latencyMs: Date.now() - start,
      raw: data
    };
  },

  async runVideoAnalysis(req: AIVideoAnalysisRequest): Promise<AIVideoAnalysisResponse> {
    // Prototype : extraction de frames côté serveur puis analyse image-par-image
    // via le modèle vision (voir docs/ARCHITECTURE.md §Vidéo). L'appel réel de
    // téléchargement + extraction de frames est délégué à lib/ai/video.ts.
    const start = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

    // Implémentation simplifiée pour le MVP : le modèle reçoit l'URL et le contexte,
    // et raisonne sur la base des frames déjà extraites en amont (req.metadata.frames).
    const framesDescription = (req.metadata?.frames as string[] | undefined)?.join("\n") ?? "";

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Analyse une vidéo de diagnostic automobile décrite par ses frames-clés. Réponds en JSON avec summary, observed_signs (array), suggested_component, confidence."
          },
          {
            role: "user",
            content: `Contexte fourni par le mécanicien : ${req.capturedContext ?? "non précisé"}\nFrames-clés :\n${framesDescription}`
          }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      summary: parsed.summary ?? "",
      observedSigns: parsed.observed_signs ?? [],
      suggestedComponent: parsed.suggested_component,
      confidence: parsed.confidence,
      latencyMs: Date.now() - start,
      raw: data
    };
  },

  async extractDocument(req: AIDocumentExtractionRequest): Promise<AIDocumentExtractionResponse> {
    const start = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

    const userContent: unknown[] = [];
    if (req.text) userContent.push({ type: "text", text: `Dictée du mécanicien : ${req.text}` });
    if (req.imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${req.imageMediaType ?? "image/jpeg"};base64,${req.imageBase64}` }
      });
    }
    userContent.push({ type: "text", text: `Type de document : ${req.kind}` });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DOCUMENT_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userContent }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      vin: parsed.vin ?? null,
      plate: parsed.plate ?? null,
      make: parsed.make ?? null,
      model_name: parsed.model_name ?? null,
      year: parsed.year ?? null,
      mileage: parsed.mileage ?? null,
      customer_name: parsed.customer_name ?? null,
      customer_phone: parsed.customer_phone ?? null,
      confidence: parsed.confidence ?? 0.5,
      latencyMs: Date.now() - start
    };
  },

  async interpretCommand(req: AICommandRequest): Promise<AICommandResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: COMMAND_INTERPRETATION_SYSTEM_PROMPT },
          { role: "user", content: req.text }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    return {
      provider: "openai",
      action: parsed.action ?? "unknown",
      query: parsed.query ?? null
    };
  }
};
