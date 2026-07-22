import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EvidenceType } from "@/types";

/**
 * POST /api/upload (multipart/form-data)
 * Champs : file, type ('photo'|'video'|'audio'|...), event_id, observation_id?,
 *          captured_context?, is_before?
 *
 * Stocke le fichier dans le bucket 'evidence' puis crée la ligne evidence
 * correspondante. Photo et vidéo suivent exactement le même chemin de code
 * (cahier des charges — traiter la vidéo "au même titre que les photos").
 *
 * privacy_reviewed est créé à false : l'interface doit obliger le mécanicien
 * à confirmer un cadrage technique (pas d'habitacle habité / tiers
 * identifiables) avant que la preuve ne soit incluse dans un rapport.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const type = form.get("type") as EvidenceType | null;
  const event_id = form.get("event_id") as string | null;
  const observation_id = (form.get("observation_id") as string | null) || null;
  const captured_context = (form.get("captured_context") as string | null) || null;
  const is_before = form.get("is_before") === "true";

  if (!file || !type || !event_id) {
    return NextResponse.json({ error: "file, type et event_id sont requis" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${event_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const duration_seconds =
    type === "video" || type === "audio" ? Number(form.get("duration_seconds") ?? 0) || null : null;

  const { data: evidence, error: insertError } = await supabase
    .from("evidence")
    .insert({
      event_id,
      observation_id,
      type,
      storage_path: path,
      duration_seconds,
      captured_context,
      is_before,
      author_id: auth.user.id,
      ai_analysis_status: type === "video" || type === "photo" ? "en_attente" : "non_demandee"
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    action: "create",
    entity_type: "evidence",
    entity_id: evidence.id,
    details: { type, event_id }
  });

  return NextResponse.json({ evidence });
}
