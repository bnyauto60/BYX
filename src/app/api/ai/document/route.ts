import { NextRequest, NextResponse } from "next/server";
import { runDocumentExtraction } from "@/lib/ai/router";

/**
 * POST /api/ai/document (multipart/form-data OU JSON)
 * Champs : file? (photo carte grise/fiche client/plaque), text? (dictée), kind
 *
 * Remplace la saisie manuelle par une photo ou une dictée pour créer un
 * véhicule/client (amélioration demandée — "je prends en photo la carte
 * grise, ça remplit tout seul"). Renvoie une proposition que le mécanicien
 * valide ou corrige avant enregistrement, jamais une écriture directe.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let imageBase64: string | undefined;
  let imageMediaType: string | undefined;
  let text: string | undefined;
  let kind: "registration" | "customer_card" | "plate_photo" | "voice" = "voice";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    text = (form.get("text") as string | null) ?? undefined;
    kind = (form.get("kind") as typeof kind | null) ?? "voice";
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      imageBase64 = buffer.toString("base64");
      imageMediaType = file.type || "image/jpeg";
    }
  } else {
    const body = await req.json();
    text = body.text;
    kind = body.kind ?? "voice";
  }

  if (!imageBase64 && !text) {
    return NextResponse.json({ error: "Fournissez une photo ou un texte à extraire" }, { status: 400 });
  }

  try {
    const result = await runDocumentExtraction({
      task: "document",
      imageBase64,
      imageMediaType,
      text,
      kind
    });
    return NextResponse.json({ extraction: result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
