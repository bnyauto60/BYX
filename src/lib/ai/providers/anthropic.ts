import type {
  AIProvider,
  AITextRequest,
  AITextResponse,
  AIVideoAnalysisRequest,
  AIVideoAnalysisResponse
} from "../types";

const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Provider Anthropic (Claude). Même contrat que les autres providers :
 * aucun autre fichier de l'application ne connaît le détail de cette API.
 */
export const anthropicProvider: AIProvider = {
  id: "anthropic",
  supports: ["structuration", "diagnostic", "comparaison", "rapport"],
  supportsRealtime: false,

  async runText(req: AITextRequest): Promise<AITextResponse> {
    const start = Date.now();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant — configurez .env ou utilisez AI_DEFAULT_PROVIDER=mock");

    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    const userMessages = req.messages.filter((m) => m.role === "user");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 1024,
        system,
        messages: userMessages.map((m) => ({ role: "user", content: m.content }))
      })
    });

    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.map((b: { text?: string }) => b.text ?? "").join("") ?? "";

    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      text,
      latencyMs: Date.now() - start,
      raw: data
    };
  },

  // Anthropic ne traite pas la vidéo nativement dans ce prototype :
  // runVideoAnalysis est volontairement omis, le router bascule sur un
  // provider qui la supporte (ex: openai) — voir router.ts.
  async runVideoAnalysis(_req: AIVideoAnalysisRequest): Promise<AIVideoAnalysisResponse> {
    throw new Error("Le provider anthropic ne supporte pas l'analyse vidéo dans ce prototype — voir AI_TASK_ROUTING.video");
  }
};
