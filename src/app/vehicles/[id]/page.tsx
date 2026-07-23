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
                    {(event.observations ?? []).slice(0, 3).map((o: any) => (
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
