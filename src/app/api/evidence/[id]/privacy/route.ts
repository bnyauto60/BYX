import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/evidence/:id/privacy
 *
 * Le mécanicien confirme explicitement que la photo/vidéo est cadrée sur
 * l'élément technique (pas d'habitacle habité, pas de tiers identifiable,
 * pas de document personnel visible dans la boîte à gants, etc.).
 * Étape obligatoire avant analyse IA et avant inclusion dans un rapport.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { error } = await supabase.from("evidence").update({ privacy_reviewed: true }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    action: "update",
    entity_type: "evidence",
    entity_id: params.id,
    details: { field: "privacy_reviewed", value: true }
  });

  return NextResponse.json({ ok: true });
}
