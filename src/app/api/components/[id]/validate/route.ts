import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/components/:id/validate
 * Réservé aux rôles admin / atelier_responsable (appliqué par la policy RLS
 * components_validate). Fait passer un composant proposé par un mécanicien
 * de 'proposition' à 'valide', évitant la fragmentation du référentiel.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { error } = await supabase
    .from("components")
    .update({ status: "valide", validated_by: auth.user.id })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL("/settings", req.url));
}
