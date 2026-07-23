import { NextRequest, NextResponse } from "next/server";
import { runAITask } from "@/lib/ai/router";
import { COMPARISON_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ai/compare
 * Body: { observation_id: string }
 *
 * Compare une observation aux observations précédentes du MÊME composant
 * sur le MÊME véhicule (cahier des charges §9.3) : usure stable,
 * dégradation rapide, problème récurrent, réparation efficace…
 */
export async function POST(req: NextRequest) {
  const { observation_id } = await req.json();
  const supabase = createClient();

  const { data: current } = await supabase
    .from("observations")
    .select("*, component:components(label), event:technical_events(vehicle_id)")
    .eq("id", observation_id)
    .single();
  if (!current) return NextResponse.json({ error: "Observation introuvable" }, { status: 404 });

  const vehicleId = (current.event as any)?.vehicle_id;
  const { data: vehicleEvents } = await supabase.from("technical_events").select("id").eq("vehicle_id", vehicleId);
  const eventIds = (vehicleEvents ?? []).map((e: any) => e.id);

  const { data: history } = await supabase
    .from("observations")
    .select("title, description, severity, urgency, wear_percent, remaining_percent, state, created_at")
    .eq("component_id", current.component_id)
    .in("event_id", eventIds)
    .neq("id", observation_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!history || history.length === 0) {
    return NextResponse.json({ comparison: { evolution: "premiere_observation", explanation: "Aucune observation antérieure sur ce composant pour ce véhicule." } });
  }

  const started = Date.now();
  const result = await runAITask({
    task: "comparaison",
    jsonMode: true,
    messages: [
      { role: "system", content: COMPARISON_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ current, history }, null, 2) }
    ]
  });

  let comparison: unknown;
  try {
    comparison = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ error: "Réponse IA non exploitable", raw: result.text }, { status: 502 });
  }

  await supabase.from("ai_analyses").insert({
    task: "comparaison",
    provider: result.provider,
    model: result.model,
    input_ref: { observation_id },
    output: comparison,
    latency_ms: Date.now() - started,
    observation_id,
    event_id: (current as any).event_id
  });

  return NextResponse.json({ comparison, provider: result.provider });
}
