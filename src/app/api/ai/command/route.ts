import { NextRequest, NextResponse } from "next/server";
import { interpretVoiceCommand } from "@/lib/ai/router";

/**
 * POST /api/ai/command
 * Body: { text: string }
 *
 * Utilisé par le bouton micro flottant global (présent sur tout l'écran,
 * mains sales ou gantées) pour orienter le mécanicien : recherche véhicule,
 * nouvelle fiche, ou nouveau diagnostic sans véhicule.
 */
export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "Champ 'text' requis" }, { status: 400 });

  const result = await interpretVoiceCommand({ task: "command", text });
  return NextResponse.json(result);
}
