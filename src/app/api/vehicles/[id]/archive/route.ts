import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];

/**
 * POST /api/vehicles/[id]/archive (multipart/form-data)
 * Champs : type ('photo'|'document'|'note'), label?, note_text?, file?
 *
 * Dossier historique : documents/photos/notes anterieurs a BYX, rattaches
 * directement au vehicule (pas a un evenement technique BYX). Stocke le
 * fichier dans le bucket 'vehicle-archive' si present, cree la ligne
 * vehicle_archive_items correspondante. N'est jamais inclus automatiquement
 * dans les rapports PDF generes : reference interne uniquement.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", params.id).single();
      if (!vehicle) return NextResponse.json({ error: "Vehicule introuvable" }, { status: 404 });

  const form = await req.formData();
      const type = form.get("type") as string | null;
      const label = (form.get("label") as string | null) || null;
      const note_text = (form.get("note_text") as string | null) || null;
      const file = form.get("file") as File | null;

  if (!type || !["photo", "document", "note"].includes(type)) {
          return NextResponse.json({ error: "type invalide (photo, document ou note)" }, { status: 400 });
  }
      if (!file && !note_text) {
              return NextResponse.json({ error: "Un fichier ou une note texte est requis" }, { status: 400 });
      }

  let storage_path: string | null = null;
      let file_name: string | null = null;
      let mime_type: string | null = null;
      let file_size: number | null = null;

  if (file) {
          if (file.size > MAX_FILE_SIZE) {
                    return NextResponse.json({ error: "Fichier trop volumineux (20 Mo max)" }, { status: 400 });
          }
          if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                    return NextResponse.json(
                        { error: "Type de fichier non autorise (photo, PDF, Word ou texte uniquement)" },
                        { status: 400 }
                              );
          }
          const ext = file.name.split(".").pop() ?? "bin";
          const path = `${params.id}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("vehicle-archive")
            .upload(path, await file.arrayBuffer(), { contentType: file.type });
          if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
          storage_path = path;
          file_name = file.name;
          mime_type = file.type;
          file_size = file.size;
  }

  const { data: item, error: insertError } = await supabase
        .from("vehicle_archive_items")
        .insert({
                  vehicle_id: params.id,
                  type,
                  label,
                  note_text,
                  storage_path,
                  file_name,
                  mime_type,
                  file_size,
                  author_id: auth.user.id
        })
        .select()
        .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
          actor_id: auth.user.id,
          action: "create",
          entity_type: "vehicle_archive_item",
          entity_id: item.id,
          details: { vehicle_id: params.id, type }
  });

  let url: string | null = null;
      if (item.storage_path) {
              const { data: signed } = await supabase.storage
                .from("vehicle-archive")
                .createSignedUrl(item.storage_path, 3600);
              url = signed?.signedUrl ?? null;
      }

  return NextResponse.json({ item: { ...item, url } });
}
