import Link from "next/link";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { VehicleArchive } from "@/components/VehicleArchive";

export const dynamic = "force-dynamic";

export default async function VehiclePage({ params }: { params: { id: string } }) {
    const supabase = createClient();

  const { data: vehicle } = await supabase.from("vehicles").select("*, customer:customers(*)").eq("id", params.id).single();
    if (!vehicle) {
          return React.createElement(
                  "div",
                  null,
                  React.createElement(NavBar, null),
                  React.createElement("main", { className: "max-w-3xl mx-auto px-4 py-8" }, "Vehicule introuvable.")
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

  const { data: archiveItemsRaw } = await supabase
      .from("vehicle_archive_items")
      .select("*")
      .eq("vehicle_id", params.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

  const archiveItems = await Promise.all(
        (archiveItemsRaw ?? []).map(async (a: any) => {
                let url: string | null = null;
                if (a.storage_path) {
                          const { data: signed } = await supabase.storage.from("vehicle-archive").createSignedUrl(a.storage_path, 3600);
                          url = signed?.signedUrl ?? null;
                }
                return {
                          id: a.id,
                          type: a.type,
                          label: a.label,
                          note_text: a.note_text,
                          file_name: a.file_name,
                          file_size: a.file_size,
                          url,
                          created_at: a.created_at
                };
        })
      );

  const STATE_LABEL: Record<string, string> = { danger: "Danger - intervention urgente", a_surveiller: "A surveiller", bon: "Bon etat general" };
    const STATE_COLOR: Record<string, string> = { danger: "text-danger", a_surveiller: "text-warn", bon: "text-safe" };

  const openWatch = (events ?? [])
      .flatMap((e: any) => e.observations ?? [])
      .filter((o: any) => ["ouverte", "surveillee"].includes(o.state));
    const urgent = openWatch.filter((o: any) => Math.max(o.severity, o.urgency) >= 5);

  return React.createElement(
        "div",
        null,
        React.createElement(NavBar, null),
        React.createElement(
                "main",
          { className: "max-w-3xl mx-auto px-4 py-8 space-y-6" },
                React.createElement(
                          "div",
                  { className: "flex items-start justify-between" },
                          React.createElement(
                                      "div",
                                      null,
                                      React.createElement(
                                                    "h1",
                                        { className: "font-display text-2xl font-semibold" },
                                                    `${vehicle.make} ${vehicle.model} `,
                                                    React.createElement("span", { className: "text-muted text-lg" }, vehicle.year)
                                                  ),
                                      React.createElement("p", { className: "text-muted text-sm" }, `${vehicle.plate} - VIN ${vehicle.vin}`),
                                      vehicle.customer
                                        ? React.createElement("p", { className: "text-muted text-sm" }, `Client : ${vehicle.customer.full_name}`)
                                        : null,
                                      React.createElement(
                                                    "p",
                                        { className: "text-muted text-sm" },
                                                    vehicle.mileage ? `${vehicle.mileage.toLocaleString("fr-FR")} km` : "Kilometrage inconnu"
                                                  )
                                    ),
                          React.createElement(Link, { href: `/vehicles/${params.id}/events/new`, className: "btn btn-primary" }, "Nouvel evenement")
                        ),
                React.createElement(
                          Link,
                  { href: `/vehicles/${params.id}/history`, className: "text-sm text-accent hover:underline" },
                          "Voir l'historique complet et la tracabilite ->"
                        ),
                React.createElement(
                          "div",
                  { className: "grid grid-cols-2 gap-3" },
                          React.createElement(
                                      "div",
                            { className: "card" },
                                      React.createElement(
                                                    "p",
                                        { className: `font-display text-2xl font-semibold ${urgent.length ? "text-danger" : "text-safe"}` },
                                                    urgent.length
                                                  ),
                                      React.createElement("p", { className: "text-muted text-sm" }, "Elements urgents")
                                    ),
                          React.createElement(
                                      "div",
                            { className: "card" },
                                      React.createElement("p", { className: "font-display text-2xl font-semibold" }, openWatch.length - urgent.length),
                                      React.createElement("p", { className: "text-muted text-sm" }, "Composants a surveiller")
                                    )
                        ),
                latestSnapshot
                  ? React.createElement(
                                "section",
                    { className: "card" },
                                React.createElement(
                                                "div",
                                  { className: "flex items-center justify-between mb-2" },
                                                React.createElement("h2", { className: "font-display text-lg font-medium" }, "Etat de sante general"),
                                                React.createElement(
                                                                  "span",
                                                  { className: `font-medium ${STATE_COLOR[latestSnapshot.overall_state] ?? ""}` },
                                                                  STATE_LABEL[latestSnapshot.overall_state] ?? latestSnapshot.overall_state
                                                                )
                                              ),
                                React.createElement(
                                                "p",
                                  { className: "text-sm text-muted mb-2" },
                                                `${latestSnapshot.urgent_count} element(s) urgent(s) - ${latestSnapshot.watch_count} composant(s) a surveiller - ${latestSnapshot.recommended_count} recommandation(s)`
                                              ),
                                React.createElement(
                                                "details",
                                  { className: "text-sm text-muted" },
                                                React.createElement("summary", { className: "cursor-pointer text-accent" }, "Pourquoi ce resultat ?"),
                                                React.createElement(
                                                                  "ul",
                                                  { className: "mt-2 space-y-1" },
                                                                  (latestSnapshot.explanation?.observations ?? []).map(
                                                                                      (o: { component: string; severity: number; urgency: number; recommendation: string | null }, i: number) =>
                                                                                                            React.createElement(
                                                                                                                                    "li",
                                                                                                              { key: i },
                                                                                                                                    `- ${o.component} - gravite ${o.severity}/urgence ${o.urgency}${o.recommendation ? ` - ${o.recommendation}` : ""}`
                                                                                                                                  )
                                                                                    )
                                                                )
                                              )
                              )
                  : null,
                componentStates && componentStates.length > 0
                  ? React.createElement(
                                "section",
                    { className: "card" },
                                React.createElement("h2", { className: "font-display text-lg font-medium mb-2" }, "Etat des composants"),
                                React.createElement(
                                                "ul",
                                  { className: "divide-y divide-line" },
                                                componentStates.map((c: any) =>
                                                                  React.createElement(
                                                                                      "li",
                                                                    { key: c.id, className: "py-2 flex items-center justify-between text-sm" },
                                                                                      React.createElement("span", null, c.component?.label),
                                                                                      React.createElement("span", { className: "text-muted" }, c.current_state.replace(/_/g, " "))
                                                                                    )
                                                                                  )
                                              )
                              )
                  : null,
                React.createElement(VehicleArchive, { vehicleId: params.id, initialItems: archiveItems }),
                React.createElement(
                          "section",
                          null,
                          React.createElement("h2", { className: "font-display text-lg font-medium mb-3" }, "Chronologie"),
                          React.createElement(
                                      "div",
                            { className: "space-y-3" },
                                      (events ?? []).map((event: any) =>
                                                    React.createElement(
                                                                    Link,
                                                      { key: event.id, href: `/events/${event.id}`, className: "card block hover:border-accent" },
                                                                    React.createElement(
                                                                                      "div",
                                                                      { className: "flex items-center justify-between" },
                                                                                      React.createElement(
                                                                                                          "div",
                                                                                                          null,
                                                                                                          React.createElement("p", { className: "font-medium" }, event.title),
                                                                                                          React.createElement(
                                                                                                                                "p",
                                                                                                            { className: "text-sm text-muted" },
                                                                                                                                `${new Date(event.created_at).toLocaleDateString("fr-FR")} - ${event.mileage ? `${event.mileage.toLocaleString("fr-FR")} km` : ""} - ${event.status}`
                                                                                                                              )
                                                                                                        ),
                                                                                      React.createElement(
                                                                                                          "div",
                                                                                        { className: "flex gap-1" },
                                                                                                          (event.observations ?? []).slice(0, 3).map((o: any) =>
                                                                                                                                React.createElement(SeverityBadge, { key: o.id, severity: Math.max(o.severity, o.urgency) })
                                                                                                                                                                       )
                                                                                                        )
                                                                                    )
                                                                  )
                                                                   ),
                                      events?.length === 0
                                        ? React.createElement("p", { className: "text-muted text-sm" }, "Aucun evenement pour ce vehicule pour le moment.")
                                        : null
                                    )
                        )
              )
      );
}
