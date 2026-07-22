import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { severityLabel } from "@/lib/ref/severity";

export interface ReportContent {
  workshopName: string;
  vehicle: { plate: string; vin: string; make: string | null; model: string | null; mileage: number | null };
  eventTitle: string;
  eventDate: string;
  technicianName: string | null;
  kind: "client" | "technique" | "interne";
  summary: string;
  observations: Array<{
    title: string;
    description: string;
    severity: number;
    componentLabel: string;
    recommendation: string | null;
    wearPercent: number | null;
    remainingPercent: number | null;
  }>;
}

/**
 * Génère un PDF simple mais propre à partir du contenu structuré du rapport.
 * Le PDF est une VUE : la source de vérité reste le CST en base (cahier des
 * charges §10). Une nouvelle génération après correction crée une nouvelle
 * version dans report_versions plutôt que d'écraser la précédente.
 */
export async function generateReportPdf(content: ReportContent): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595, 842]); // A4
  let y = 800;
  const left = 50;

  const line = (text: string, opts: { size?: number; f?: typeof font; color?: [number, number, number]; gap?: number } = {}) => {
    const { size = 11, f = font, color = [0.07, 0.08, 0.09], gap = 16 } = opts;
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text, { x: left, y, size, font: f, color: rgb(...color) });
    y -= gap;
  };

  line(content.workshopName, { size: 18, f: bold, gap: 24 });
  line(
    `${content.kind === "client" ? "Rapport client" : content.kind === "technique" ? "Rapport technique" : "Rapport interne"} — ${content.eventTitle}`,
    { size: 13, f: bold, gap: 20 }
  );
  line(`Véhicule : ${content.vehicle.make ?? ""} ${content.vehicle.model ?? ""} — ${content.vehicle.plate}`, { gap: 14 });
  line(`VIN : ${content.vehicle.vin}`, { gap: 14 });
  line(`Kilométrage : ${content.vehicle.mileage ?? "—"} km`, { gap: 14 });
  line(`Date : ${content.eventDate}`, { gap: 14 });
  if (content.technicianName) line(`Technicien : ${content.technicianName}`, { gap: 14 });
  y -= 8;

  line("Synthèse", { size: 13, f: bold, gap: 18 });
  for (const chunk of wrap(content.summary, 95)) line(chunk, { gap: 14 });
  y -= 10;

  line("Observations", { size: 13, f: bold, gap: 18 });
  for (const obs of content.observations) {
    line(`• ${obs.componentLabel} — ${obs.title} [${severityLabel(obs.severity)}]`, { f: bold, gap: 14 });
    for (const chunk of wrap(obs.description, 95)) line(chunk, { size: 10, gap: 12 });
    if (obs.wearPercent !== null && obs.remainingPercent !== null) {
      line(`Usure : ${obs.wearPercent}% — Restant : ${obs.remainingPercent}%`, { size: 10, gap: 12 });
    }
    if (obs.recommendation) line(`Recommandation : ${obs.recommendation}`, { size: 10, gap: 12 });
    y -= 6;
  }

  return doc.save();
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars) {
      lines.push(current.trim());
      current = w;
    } else {
      current += " " + w;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
