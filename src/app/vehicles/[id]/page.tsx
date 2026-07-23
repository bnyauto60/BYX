import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { SeverityBadge } from "@/components/SeverityBadge";

export const dynamic = "force-dynamic";

export default async function VehiclePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: vehicle } = await supabase.from("vehicles").select("*, customer:customers(*)").eq("id", params.id).single();
  if (!vehicle) {
    return (
      <div>
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 py-8">Véhicule introuvable.</main>
      </div>
    );
  }

  const { data: events } = await supabase
    .from("technical_events")
    .select("*, observations(id, title, severity, urgency, state, component:components(label))")
    .eq("vehicle_id", params.id)
    .order("created_at", { ascending: false });

  const { data: latestSnapshot } = await supabase
    .from("vehicle_health_snapshots")
    .select("*")
    .eq("vehicle_id", params.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: componentStates } = await supabase
    .from("component_states")
    .select("*, component:components(label)")
    .eq("vehicle_id", params.id)
    .order("severity", { ascending: false });

  const STATE_LABEL: Record<string, string> = { danger: "Danger — intervention urgente", a_surveiller: "À surveiller", bon: "Bon état général" };
  const STATE_COLOR: Record<string, string> = { danger: "text-danger", a_surveiller: "text-warn", bon: "text-safe" };

  const openWatch = (events ?? [])
    .flatMap((e) => e.observations ?? [])
    .filter((o) => ["ouverte", "surveillee"].includes(o.state));
  const urgent = openWatch.filter((o) => Math.max(o.severity, o.urgency) >= 5);

  return (
    <div>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">{vehicle.make} {vehicle.model} <span className="text-muted text-lg">{vehicle.year}</span></h1>
            <p className="text-muted text-sm">{vehicle.plate} — VIN {vehicle.vin}</p>
            {vehicle.customer && <p className="text-muted text-sm">Client : {vehicle.customer.full_name}</p>}
            <p className="text-muted text-sm">{vehicle.mileage ? `${vehicle.mileage.toLocaleString("fr-FR")} km` : "Kilométrage inconnu"}</p>
          </div>
          <Link href={`/vehicles/${params.id}/events/new`} className="btn btn-primary">Nouvel événement</Link>
        </div>

        <Link href={`/vehicles/${params.id}/history`} className="text-sm text-accent hover:underline">
          Voir l'historique complet et la traçabilité →
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className={`font-display text-2xl font-semibold ${urgent.length ? "text-danger" : "text-safe"}`}>{urgent.length}</p>
            <p className="text-muted text-sm">Éléments urgents</p>
          </div>
          <div className="card">
            <p className="font-display text-2xl font-semibold">{openWatch.length - urgent.length}</p>
            <p className="text-muted text-sm">Composants à surveiller</p>
          </div>
        </div>

        {latestSnapshot && (
          <section className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg font-medium">État de santé général</h2>
              <span className={`font-medium ${STATE_COLOR[latestSnapshot.overall_state] ?? ""}`}>
                {STATE_LABEL[latestSnapshot.overall_state] ?? latestSnapshot.overall_state}
              </span>
            </div>
            <p className="text-sm text-muted mb-2">
              {latestSnapshot.urgent_count} élément(s) urgent(s) · {latestSnapshot.watch_count} composant(s) à surveiller · {latestSnapshot.recommended_count} recommandation(s)
            </p>
            {/* Le score n'est jamais affiché seul : le détail qui le justifie est toujours accessible. */}
            <details className="text-sm text-muted">
              <summary className="cursor-pointer text-accent">Pourquoi ce résultat ?</summary>
              <ul className="mt-2 space-y-1">
                {(latestSnapshot.explanation?.observations ?? []).map((o: { component: string; severity: number; urgency: number; recommendation: string | null }, i: number) => (
                  <li key={i}>• {o.component} — gravité {o.severity}/urgence {o.urgency}{o.recommendation ? ` — ${o.recommendation}` : ""}</li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {componentStates && componentStates.length > 0 && (
          <section className="card">
            <h2 className="font-display text-lg font-medium mb-2">État des composants</h2>
            <ul className="divide-y divide-line">
              {componentStates.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <span>{c.component?.label}</span>
                  <span className="text-muted">{c.current_state.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="font-display text-lg font-medium mb-3">Chronologie</h2>
          <div className="space-y-3">
            {(events ?? []).map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="card block hover:border-accent">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted">
                      {new Date(event.created_at).toLocaleDateString("fr-FR")} — {event.mileage ? `${event.mileage.toLocaleString("fr-FR")} km` : ""} — {event.status}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(event.observations ?? []).slice(0, 3).map((o) => (
                      <SeverityBadge key={o.id} severity={Math.max(o.severity, o.urgency)} />
                    ))}
                  </div>
                </div>
              </Link>
            ))}
            {events?.length === 0 && <p className="text-muted text-sm">Aucun événement pour ce véhicule pour le moment.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
