import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAITask } from "@/lib/ai/router";
import { REPORT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { generateReportPdf } from "@/lib/pdf/generateReport";
import { mustAppearInClientReport } from "@/lib/ref/severity";

/**
 * POST /api/reports/:eventId/pdf?kind=client|technique|interne
 *
 * 1. Charge les observations de l'événement.
 * 2. Applique le garde-fou sécurité : toute observation urgente est forcée
 *    dans le rapport client, quel que soit include_in_client_report.
 * 3. Demande à l'IA une synthèse rédigée dans le registre demandé.
 * 4. Génère le PDF, le stocke, crée reports + report_versions.
 */
export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  const kind = (new URL(req.url).searchParams.get("kind") ?? "client") as "client" | "technique" | "interne";
  const supabase = createClient();

  const { data: event } = await supabase
    .from("technical_events")
    .select("*, vehicle:vehicles(*), technician:users_profile(full_name)")
    .eq("id", params.eventId)
    .single();
  if (!event) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

  const { data: observationsRaw } = await supabase
    .from("observations")
    .select("*, component:components(label)")
    .eq("event_id", params.eventId)
    .is("deleted_at", null);

  const observations = (observationsRaw ?? []).filter((o) => {
    if (kind !== "client") return true;
    // Garde-fou non contournable : sécurité prioritaire sur la préférence d'affichage.
    return o.include_in_client_report || mustAppearInClientReport(o.severity, o.urgency);
  });

  const aiResult = await runAITask({
    task: "rapport",
    jsonMode: true,
    messages: [
      { role: "system", content: REPORT_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ kind, vehicle: event.vehicle, observations }, null, 2)
      }
    ]
  });

  let summary = "Synthèse indisponible.";
  try {
    summary = JSON.parse(aiResult.text).summary ?? summary;
  } catch {
    summary = aiResult.text;
  }

  const pdfBytes = await generateReportPdf({
    workshopName: process.env.NEXT_PUBLIC_WORKSHOP_NAME ?? "BNY Auto",
    vehicle: event.vehicle,
    eventTitle: event.title,
    eventDate: new Date(event.created_at).toLocaleDateString("fr-FR"),
    technicianName: event.technician?.full_name ?? null,
    kind,
    summary,
    observations: observations.map((o) => ({
      title: o.title,
      description: o.description,
      severity: o.severity,
      componentLabel: o.component?.label ?? "Composant",
      recommendation: o.recommendation,
      wearPercent: o.wear_percent,
      remainingPercent: o.remaining_percent
    }))
  });

  const pdfPath = `${params.eventId}/${kind}-${Date.now()}.pdf`;
  await supabase.storage.from("reports").upload(pdfPath, pdfBytes, { contentType: "application/pdf" });

  const content = { summary, observations, kind };
  const { data: existing } = await supabase
    .from("reports")
    .select("id, version")
    .eq("event_id", params.eventId)
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;
  const { data: report } = await supabase
    .from("reports")
    .insert({ event_id: params.eventId, kind, version: nextVersion, content, pdf_storage_path: pdfPath })
    .select()
    .single();

  if (report) {
    await supabase.from("report_versions").insert({
      report_id: report.id,
      version: nextVersion,
      content,
      pdf_storage_path: pdfPath
    });
  }

  const { data: signed } = await supabase.storage.from("reports").createSignedUrl(pdfPath, 3600);

  return NextResponse.json({ report, url: signed?.signedUrl });
}
