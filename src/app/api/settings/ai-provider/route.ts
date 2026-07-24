import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = ["auto", "openai", "anthropic"];

/**
 * POST /api/settings/ai-provider
 * Body (form-urlencoded, via <form>) : ai_provider = 'auto' | 'openai' | 'anthropic'
 *
 * Enregistre le fournisseur IA par défaut choisi pour l'atelier de
 * l'utilisateur connecté (Paramètres > Intelligence artificielle). Voir
 * lib/ai/workshopProvider.ts pour la lecture de ce réglage, et
 * supabase/migrations/0005_ai_provider_setting.sql pour la colonne.
 */
export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const form = await req.formData();
    const aiProvider = form.get("ai_provider");

    if (typeof aiProvider !== "string" || !ALLOWED.includes(aiProvider)) {
          return NextResponse.json({ error: "Valeur ai_provider invalide" }, { status: 400 });
        }

    const { data: profile } = await supabase
      .from("users_profile")
      .select("workshop_id")
      .eq("id", auth.user.id)
      .single();
    if (!profile?.workshop_id) return NextResponse.json({ error: "Atelier introuvable" }, { status: 404 });

    const { error } = await supabase
      .from("workshops")
      .update({ ai_provider: aiProvider })
      .eq("id", profile.workshop_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.redirect(new URL("/settings", req.url));
  }
