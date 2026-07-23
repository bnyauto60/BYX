import { createServiceClient } from "@/lib/supabase/server";

/**
 * État calculé, jamais saisi manuellement (cahier des charges §6-§7).
 * Recalculé après chaque observation enregistrée : voir
 * /api/vehicles/[id]/recompute-health, appelé par ObservationForm après
 * chaque validation.
 *
 * Le score de santé général reste explicable : vehicle_health_snapshots.explanation
 * liste toujours les observations qui le justifient — jamais un chiffre seul.
 */
export async function recomputeVehicleHealth(vehicleId: string) {
  const supabase = createServiceClient();

  const { data: observations } = await supabase
    .from("observations")
    .select("id, component_id, severity, urgency, state, recommendation, next_check_date, next_check_mileage, created_at, component:components(label)")
    .in("event_id",
      (await supabase.from("technical_events").select("id").eq("vehicle_id", vehicleId)).data?.map((e: { id: string }) => e.id) ?? []
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const byComponent = new Map<string, typeof observations>();
  for (const obs of observations ?? []) {
    const list = byComponent.get(obs.component_id) ?? [];
    list.push(obs);
    byComponent.set(obs.component_id, list as any);
  }

  for (const [componentId, obsListRaw] of byComponent) {
    const obsList = (obsListRaw ?? []) as NonNullable<typeof observations>;
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

  const allLatestPerComponent = Array.from(byComponent.values()).map((list) => (list ?? [])[(list ?? []).length - 1]).filter(Boolean) as NonNullable<typeof observations>;
  const urgentCount = allLatestPerComponent.filter((o) => Math.max(o.severity, o.urgency) >= 5).length;
  const watchCount = allLatestPerComponent.filter((o) => Math.max(o.severity, o.urgency) === 3 || Math.max(o.severity, o.urgency) === 4).length;
  const recommendedCount = allLatestPerComponent.filter((o) => !!o.recommendation).length;

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
      observations: allLatestPerComponent.map((o) => ({
        component: (o as any).component?.label,
        severity: o.severity,
        urgency: o.urgency,
        recommendation: o.recommendation
      }))
    }
  });
}
