import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { SeverityBadge } from "@/components/SeverityBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: eventsToday }, { data: openObservations }, { count: reportsCount }] = await Promise.all([
    supabase.from("technical_events").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase
      .from("observations")
      .select("id, title, severity, urgency, event:technical_events(id, title, vehicle:vehicles(plate, make, model))")
      .in("state", ["ouverte", "surveillee"])
      .order("severity", { ascending: false })
      .limit(8),
    supabase.from("reports").select("id", { count: "exact", head: true })
  ]);

  const urgentCount = (openObservations ?? []).filter((o) => Math.max(o.severity, o.urgency) >= 5).length;

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
              {openObservations.map((o) => {
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

        <div className="flex gap-3">
          <Link href="/vehicles/new" className="btn btn-primary">Nouveau véhicule</Link>
          <Link href="/vehicles" className="btn btn-secondary">Rechercher un véhicule</Link>
        </div>
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
