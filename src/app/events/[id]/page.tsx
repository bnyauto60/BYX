import { CompareHistoryButton } from "@/components/CompareHistoryButton";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ObservationForm } from "@/components/ObservationForm";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: event } = await supabase
    .from("technical_events")
    .select("*, vehicle:vehicles(*)")
    .eq("id", params.id)
    .single();

  if (!event) {
    return (
      <div><NavBar /><main className="max-w-3xl mx-auto px-4 py-8">Événement introuvable.</main></div>
    );
  }

  const [{ data: observations }, { data: components }] = await Promise.all([
    supabase
      .from("observations")
      .select("*, component:components(label), evidence(id, type, storage_path)")
      .eq("event_id", params.id)
      .is("deleted_at", null)
      .order("severity", { ascending: false }),
    supabase.from("components").select("*").eq("status", "valide").order("label")
  ]);

  return (
    <div>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">{event.title}</h1>
            <p className="text-muted text-sm">
              {event.vehicle ? (
                <Link href={`/vehicles/${event.vehicle.id}`} className="hover:text-accent">
                  {event.vehicle.make} {event.vehicle.model} — {event.vehicle.plate}
                </Link>
              ) : (
                <span className="text-warn">Diagnostic sans véhicule associé</span>
              )}
              {" · "}{new Date(event.created_at).toLocaleDateString("fr-FR")}
              {event.mileage ? ` · ${event.mileage.toLocaleString("fr-FR")} km` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {event.vehicle && (
              <Link href={`/events/${params.id}/diagnostic`} className="btn btn-secondary">Aide au diagnostic</Link>
            )}
            {event.vehicle && (
              <Link href={`/events/${params.id}/report`} className="btn btn-primary">Générer le rapport</Link>
            )}
          </div>
        </div>

        {!event.vehicle && (
          <div className="card border-warn/40 flex items-center justify-between">
            <p className="text-sm">
              Ce diagnostic n'est rattaché à aucun véhicule. Vous pouvez continuer sans, ou le relier
              maintenant si le véhicule est identifié.
            </p>
            <Link href={`/events/${params.id}/link-vehicle`} className="btn btn-secondary text-xs px-3 py-2 whitespace-nowrap">
              Relier un véhicule
            </Link>
          </div>
        )}

        <ObservationForm eventId={params.id} vehicleId={event.vehicle?.id ?? null} components={components ?? []} />

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">Observations de cet événement</h2>
          {(observations ?? []).map((o: any) => (
            <div key={o.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{o.component?.label} — {o.title}</p>
                  <p className="text-sm text-muted mt-1">{o.description}</p>
                  {o.wear_percent !== null && (
                    <p className="text-sm text-muted mt-1">Usure : {o.wear_percent}% — Restant : {o.remaining_percent}%</p>
                  )}
                  {o.recommendation && <p className="text-sm mt-1">→ {o.recommendation}</p>}
                  {o.evidence?.length > 0 && (
                    <p className="text-xs text-muted mt-2">{o.evidence.length} preuve(s) rattachée(s) ({o.evidence.map((e: { type: string }) => e.type).join(", ")})</p>
                  )}
                  <CompareHistoryButton observationId={o.id} />
                </div>
                <SeverityBadge severity={Math.max(o.severity, o.urgency)} />
              </div>
            </div>
          ))}
          {observations?.length === 0 && <p className="text-muted text-sm">Aucune observation enregistrée pour l'instant.</p>}
        </section>
      </main>
    </div>
  );
}
