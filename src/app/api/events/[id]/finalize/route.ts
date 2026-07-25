import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/events/:id/finalize
 *
 * Validation definitive du rapport (mode "tour du vehicule en continu").
 * Une fois valide, l'evenement passe en statut "termine" : plus aucune
 * observation ne peut etre ajoutee depuis la page evenement, mais les
 * rapports PDF restent generables a tout moment (ils ne sont jamais la
 * source de verite, cf schema).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

const { data: event } = await supabase.from("technical_events").select("id, status").eq("id", params.id).single();
  if (!event) return NextResponse.json({ error: "Evenement introuvable" }, { status: 404 });
  if (event.status === "termine") return NextResponse.json({ ok: true, already: true });

const { error } = await supabase
  .from("technical_events")
  .update({ status: "termine", closed_at: new Date().toISOString() })
  .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

await supabase.from("audit_logs").insert({
  actor_id: auth.user.id,
  action: "update",
  entity_type: "technical_event",
  entity_id: params.id,
  details: { field: "status", value: "termine" }
});

return NextResponse.json({ ok: true });
}
