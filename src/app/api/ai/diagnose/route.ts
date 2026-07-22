import { NextRequest, NextResponse } from "next/server";
import { runAITask } from "@/lib/ai/router";
import { DIAGNOSTIC_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ai/diagnose
 * Body: { event_id: string }
 *
 * Récupère les observations/mesures de l'événement + historique du véhicule,
 * demande à l'IA des hypothèses de diagnostic (jamais un diagnostic certain —
 * cahier des charges §9.2).
 */
export async function POST(req: NextRequest) {
  const { event_id } = await req.json();
  const supabase = createClient();

  const { data: event } = await supabase
    .from("technical_events")
    .select("*, vehicle:vehicles(*)")
    .eq("id", event_id)
    .single();
  if (!event) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

  const { data: observations } = await supabase
    .from("observations")
    .select("*, component:components(label), measurements(*)")
    .eq("event_id", event_id);

  const { data: history } = await supabase
    .from("observations")
    .select("title, description, created_at, component:components(label)")
    .eq("event_id", event.vehicle_id) // placeholder simplifié pour le prototype
    .neq("event_id", event_id)
    .limit(20);

  const started = Date.now();
  const result = await runAITask({
    task: "diagnostic",
    jsonMode: true,
    messages: [
      { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ observations, history }, null, 2)
      }
    ]
  });

  let hypotheses: unknown;
  try {
    hypotheses = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ error: "Réponse IA non exploitable", raw: result.text }, { status: 502 });
  }

  await supabase.from("ai_analyses").insert({
    task: "diagnostic",
    provider: result.provider,
    model: result.model,
    input_ref: { event_id },
    output: hypotheses,
    latency_ms: Date.now() - started,
    event_id
  });

  return NextResponse.json({ hypotheses, provider: result.provider, model: result.model });
}
