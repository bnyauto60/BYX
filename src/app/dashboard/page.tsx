import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { SeverityBadge } from "@/components/SeverityBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: eventsToday }, { data: openObservations }, { count: reportsCount }, { data: recentVehicles }] = await Promise.all([
    supabase.from("technical_events").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase
      .from("observations")
      .select("id, title, severity, urgency, event:technical_events(id, title, vehicle:vehicles(plate, make, model))")
      .in("state", ["ouverte", "surveillee"])
      .order("severity", { ascending: false })
      .limit(8),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    // Véhicules récents : accès direct en un tap, sans repasser par la recherche
    // (utile pour les clients réguliers — amélioration demandée).
    supabase.from("vehicles").select("id, plate, make, model, updated_at").order("updated_at", { ascending: false }).limit(5)
  ]);

  const urgentCount = (openObservations ?? []).filter((o: any) => Math.max(o.severity, o.urgency) >= 5).length;

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-muted text-sm">{process.env.NEXT_PUBLIC_WORKSHOP_NAME} — {process.env.NEXT_PUBLIC_WORKSHOP_CITY}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Véhicules vus aujourd'hui" value={eventsToday ?? 0} />
          <StatCard label="Observations en cours" value={openObservations?.length ?? 0} />
          <StatCard label="Urgences" value={urgentCount} tone={urgentCount > 0 ? "danger" : "safe"} />
          <StatCard label="Rapports générés" value={reportsCount ?? 0} />
        </div>

        <section className="card">
          <h2 className="font-display text-lg font-medium mb-4">Observations non clôturées</h2>
          {!openObservations || openObservations.length === 0 ? (
            <p className="text-muted text-sm">Aucune observation en cours. Créez une inspection pour commencer.</p>
          ) : (
            <ul className="divide-y divide-line">
              {openObservations.map((o: any) => {
                const event = Array.isArray(o.event) ? o.event[0] : o.event;
                const vehicle = event?.vehicle ? (Array.isArray(event.vehicle) ? event.vehicle[0] : event.vehicle) : null;
                return (
                  <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.title}</p>
                      <p className="text-sm text-muted">
                        {vehicle ? `${vehicle.make ?? ""} ${vehicle.model ?? ""} — ${vehicle.plate}` : "Véhicule"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={Math.max(o.severity, o.urgency)} />
                      {event && (
                        <Link href={`/events/${event.id}`} className="btn btn-secondary text-xs px-3 py-2">
                          Ouvrir
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/vehicles/new" className="btn btn-primary justify-center">Nouveau véhicule</Link>
          <Link href="/vehicles" className="btn btn-secondary justify-center">Rechercher un véhicule</Link>
          <Link href="/diagnostic/new" className="btn btn-secondary justify-center">Diagnostic</Link>
        </div>

        {recentVehicles && recentVehicles.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-medium mb-3">Véhicules récents</h2>
            <div className="grid gap-2">
              {recentVehicles.map((v: any) => (
                <Link key={v.id} href={`/vehicles/${v.id}`} className="card flex items-center justify-between hover:border-accent py-3">
                  <p className="font-medium">{v.make} {v.model}</p>
                  <p className="text-sm text-muted">{v.plate}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "safe" }) {
  return (
    <div className="card">
      <p className={`font-display text-3xl font-semibold ${tone === "danger" ? "text-danger" : tone === "safe" ? "text-safe" : "text-text"}`}>
        {value}
      </p>
      <p className="text-muted text-sm mt-1">{label}</p>
    </div>
  );
}
