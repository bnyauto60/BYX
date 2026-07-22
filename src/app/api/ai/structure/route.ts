import { NextRequest, NextResponse } from "next/server";
import { runAITask } from "@/lib/ai/router";
import { STRUCTURATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import type { StructuredObservation } from "@/lib/ai/types";

/**
 * POST /api/ai/structure
 * Body: { text: string, event_id: string }
 *
 * Transforme une dictée/texte libre en observation structurée (cahier des
 * charges §8.2-8.3 et §9.1). N'écrit rien en base : renvoie une proposition
 * que le mécanicien valide ou corrige côté client avant enregistrement.
 */
export async function POST(req: NextRequest) {
  const { text, event_id } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Champ 'text' requis" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const started = Date.now();
  const result = await runAITask({
    task: "structuration",
    jsonMode: true,
    messages: [
      { role: "system", content: STRUCTURATION_SYSTEM_PROMPT },
      { role: "user", content: text }
    ]
  });

  let structured: StructuredObservation;
  try {
    structured = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ error: "Réponse IA non exploitable", raw: result.text }, { status: 502 });
  }

  // Garde-fou : si l'ambiguïté usure/restant n'a pas été résolue par le modèle,
  // on la calcule côté serveur plutôt que de laisser un champ vide et trompeur.
  if (structured.wear_percent !== null && structured.remaining_percent === null) {
    structured.remaining_percent = 100 - structured.wear_percent;
  }

  await supabase.from("ai_analyses").insert({
    task: "structuration",
    provider: result.provider,
    model: result.model,
    input_ref: { event_id, text },
    output: structured,
    confidence: structured.confidence,
    latency_ms: Date.now() - started,
    event_id
  });

  return NextResponse.json({ structured, provider: result.provider, model: result.model });
}
