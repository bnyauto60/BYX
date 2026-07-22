import { NextRequest, NextResponse } from "next/server";
import { runVideoAnalysis, isRealtimeVideoAvailable } from "@/lib/ai/router";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ai/video
 * Body: { evidence_id: string }
 *
 * Déclenche l'analyse IA d'une vidéo déjà uploadée (diagnostic : bruit
 * moteur, vibration, suspension, fuite, tableau de bord, fumée, essai
 * routier — cahier des charges + amélioration demandée).
 *
 * Fonctionne en mode asynchrone dans ce prototype : le statut passe par
 * en_cours puis terminee/echec sur la ligne `evidence`. L'architecture est
 * prête pour du temps réel (voir isRealtimeVideoAvailable() et
 * docs/ARCHITECTURE.md §Vidéo temps réel) dès qu'un provider qui le
 * supporte est configuré en AI_TASK_ROUTING.video.
 */
export async function POST(req: NextRequest) {
  const { evidence_id } = await req.json();
  const supabase = createClient();

  const { data: evidence } = await supabase.from("evidence").select("*").eq("id", evidence_id).single();
  if (!evidence) return NextResponse.json({ error: "Preuve introuvable" }, { status: 404 });
  if (evidence.type !== "video") {
    return NextResponse.json({ error: "Cette preuve n'est pas une vidéo" }, { status: 400 });
  }
  if (!evidence.privacy_reviewed) {
    return NextResponse.json(
      { error: "Cadrage vie privée non confirmé — confirmez avant analyse (voir /api/evidence/:id/privacy)" },
      { status: 412 }
    );
  }

  await supabase.from("evidence").update({ ai_analysis_status: "en_cours" }).eq("id", evidence_id);

  const { data: signed } = await supabase.storage
    .from("evidence")
    .createSignedUrl(evidence.storage_path, 600);

  try {
    const result = await runVideoAnalysis({
      task: "video",
      videoUrl: signed?.signedUrl ?? "",
      capturedContext: evidence.captured_context ?? undefined,
      realtime: false
    });

    await supabase.from("ai_analyses").insert({
      task: "video",
      provider: result.provider,
      model: result.model,
      input_ref: { evidence_id },
      output: result,
      confidence: result.confidence,
      latency_ms: result.latencyMs,
      evidence_id,
      event_id: evidence.event_id,
      observation_id: evidence.observation_id
    });

    await supabase.from("evidence").update({ ai_analysis_status: "terminee" }).eq("id", evidence_id);

    return NextResponse.json({ result, realtimeAvailable: isRealtimeVideoAvailable() });
  } catch (err) {
    await supabase.from("evidence").update({ ai_analysis_status: "echec" }).eq("id", evidence_id);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
