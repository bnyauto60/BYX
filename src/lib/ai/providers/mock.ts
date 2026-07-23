import { createServiceClient } from "@/lib/supabase/server";

/**
 * État calculé, jamais saisi manuellement (cahier des charges §6-§7).
 * Recalculé après chaque observation enregistrée : voir
 * /api/vehicles/[id]/recompute-health, appelé par ObservationForm après
 * chaque validation.
 *
 * Le score de santé général reste explicable : vehicle_health_snapshots.explanation
 * liste toujours les observations qui le justifient — jamais un chiffre seul.
 *
 * Typé en `any` de façon assumée sur les résultats Supabase : ce module
 * traite des lignes dynamiques issues de plusieurs requêtes agrégées, et le
 * typage strict n'apporte rien ici (voir docs/DECISIONS.md).
 */
export async function recomputeVehicleHealth(vehicleId: string) {
  const supabase = createServiceClient();

  const { data: eventIdsData } = await supabase
    .from("technical_events")
    .select("id")
    .eq("vehicle_id", vehicleId);
  const eventIds: string[] = (eventIdsData ?? []).map((e: any) => e.id);

  const { data: observationsData } = await supabase
    .from("observations")
    .select("id, component_id, severity, urgency, state, recommendation, next_check_date, next_check_mileage, created_at, component:components(label)")
    .in("event_id", eventIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const observations: any[] = observationsData ?? [];

  const byComponent = new Map<string, any[]>();
  for (const obs of observations) {
    const list = byComponent.get(obs.component_id) ?? [];
    list.push(obs);
    byComponent.set(obs.component_id, list);
  }

  for (const [componentId, obsList] of byComponent) {
    const last = obsList[obsList.length - 1];
    if (!last) continue;

    const currentState =
      last.severity >= 5 ? "intervention_urgente"
      : last.severity >= 3 ? "a_surveiller"
      : last.severity >= 1 ? "usure_normale"
      : "bon_etat";

    await supabase.from("component_states").upsert({
      vehicle_id: vehicleId,
      component_id: componentId,
      current_state: currentState,
      severity: last.severity,
      recommendation: last.recommendation,
      next_check_date: last.next_check_date,
      next_check_mileage: last.next_check_mileage,
      last_observation_id: last.id,
      computed_at: new Date().toISOString()
    }, { onConflict: "vehicle_id,component_id" });
  }

  const allLatestPerComponent: any[] = Array.from(byComponent.values())
    .map((list: any[]) => list[list.length - 1])
    .filter(Boolean);

  const urgentCount = allLatestPerComponent.filter((o: any) => Math.max(o.severity, o.urgency) >= 5).length;
  const watchCount = allLatestPerComponent.filter((o: any) => Math.max(o.severity, o.urgency) === 3 || Math.max(o.severity, o.urgency) === 4).length;
  const recommendedCount = allLatestPerComponent.filter((o: any) => !!o.recommendation).length;

  const overallState =
    urgentCount > 0 ? "danger"
    : watchCount > 0 ? "a_surveiller"
    : "bon";

  await supabase.from("vehicle_health_snapshots").insert({
    vehicle_id: vehicleId,
    overall_state: overallState,
    urgent_count: urgentCount,
    watch_count: watchCount,
    recommended_count: recommendedCount,
    explanation: {
      observations: allLatestPerComponent.map((o: any) => ({
        component: o.component?.label,
        severity: o.severity,
        urgency: o.urgency,
        recommendation: o.recommendation
      }))
    }
  });
}
