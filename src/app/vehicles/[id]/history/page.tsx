import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

export const dynamic = "force-dynamic";

/**
 * Historique et traçabilité (cahier des charges §11). Montre, pour chaque
 * observation du véhicule, la chronologie complète de ses changements
 * d'état — jamais de suppression silencieuse, chaque évolution est une
 * ligne dans observation_history.
 */
export default async function VehicleHistoryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: vehicle } = await supabase.from("vehicles").select("id, make, model, plate").eq("id", params.id).single();

  const { data: observations } = await supabase
    .from("observations")
    .select("id, title, state, created_at, component:components(label), event:technical_events!inner(vehicle_id), observation_history(*, changed_by:users_profile(full_name))")
    .eq("event.vehicle_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Historique complet</h1>
          {vehicle && (
            <p className="text-muted text-sm">
              <Link href={`/vehicles/${vehicle.id}`} className="hover:text-accent">
                {vehicle.make} {vehicle.model} — {vehicle.plate}
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-4">
          {(observations ?? []).map((o) => (
            <div key={o.id} className="card">
              <p className="font-medium">{o.component?.label} — {o.title}</p>
              <p className="text-xs text-muted mb-2">Créée le {new Date(o.created_at).toLocaleDateString("fr-FR")} — état actuel : {o.state}</p>
              {o.observation_history?.length > 0 ? (
                <ul className="border-l border-line pl-3 space-y-1 mt-2">
                  {o.observation_history
                    .sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at))
                    .map((h: { id: string; created_at: string; previous_state: string | null; new_state: string; reason: string | null; changed_by?: { full_name: string } }) => (
                      <li key={h.id} className="text-sm text-muted">
                        {new Date(h.created_at).toLocaleDateString("fr-FR")} — {h.previous_state ? `${h.previous_state} → ` : ""}{h.new_state}
                        {h.changed_by?.full_name ? ` (${h.changed_by.full_name})` : ""}
                        {h.reason ? ` — ${h.reason}` : ""}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Aucune évolution enregistrée depuis la création.</p>
              )}
            </div>
          ))}
          {observations?.length === 0 && <p className="text-muted text-sm">Aucune observation pour ce véhicule.</p>}
        </div>
      </main>
    </div>
  );
}
