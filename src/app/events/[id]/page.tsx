import { CompareHistoryButton } from "@/components/CompareHistoryButton";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ObservationForm } from "@/components/ObservationForm";
import { FinalizeReportButton } from "@/components/FinalizeReportButton";
import { createElement as h } from "react";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

const { data: event } = await supabase
  .from("technical_events")
  .select("*, vehicle:vehicles(*)")
  .eq("id", params.id)
  .single();

if (!event) {
  return h("div", null, h(NavBar, null), h("main", { className: "max-w-3xl mx-auto px-4 py-8" }, "Evenement introuvable."));
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

const isFinalized = event.status === "termine";

return h("div", null,
         h(NavBar, null),
         h("main", { className: "max-w-3xl mx-auto px-4 py-8 space-y-6" },
           h("div", { className: "flex items-start justify-between" },
             h("div", null,
               h("h1", { className: "font-display text-2xl font-semibold" }, event.title),
               h("p", { className: "text-muted text-sm" },
                 event.vehicle
                 ? h(Link, { href: `/vehicles/${event.vehicle.id}`, className: "hover:text-accent" }, `${event.vehicle.make} ${event.vehicle.model} — ${event.vehicle.plate}`)
                 : h("span", { className: "text-warn" }, "Diagnostic sans vehicule associe"),
                 " · ", new Date(event.created_at).toLocaleDateString("fr-FR"),
                 event.mileage ? ` · ${event.mileage.toLocaleString("fr-FR")} km` : ""
                 )
               ),
             h("div", { className: "flex gap-2" },
               event.vehicle && h(Link, { href: `/events/${params.id}/diagnostic`, className: "btn btn-secondary" }, "Aide au diagnostic"),
               event.vehicle && h(Link, { href: `/events/${params.id}/report`, className: "btn btn-primary" }, "Generer le rapport")
               )
             ),

           isFinalized
           ? h("div", { className: "card border-safe/40" },
               h("p", { className: "text-sm" },
                 "✓ Rapport valide le ",
                 event.closed_at ? new Date(event.closed_at).toLocaleString("fr-FR") : "",
                 " — aucune nouvelle observation ne peut etre ajoutee sur cet evenement."
                 )
               )
           : h("div", { className: "flex justify-end" }, h(FinalizeReportButton, { eventId: params.id })),

           !event.vehicle && h("div", { className: "card border-warn/40 flex items-center justify-between" },
                               h("p", { className: "text-sm" },
                                 "Ce diagnostic n'est rattache a aucun vehicule. Vous pouvez continuer sans, ou le relier maintenant si le vehicule est identifie."
                                 ),
                               h(Link, { href: `/events/${params.id}/link-vehicle`, className: "btn btn-secondary text-xs px-3 py-2 whitespace-nowrap" }, "Relier un vehicule")
                               ),

           !isFinalized && h(ObservationForm, { eventId: params.id, vehicleId: event.vehicle?.id ?? null, components: components ?? [] }),

           h("section", { className: "space-y-3" },
             h("h2", { className: "font-display text-lg font-medium" }, "Observations de cet evenement"),
             (observations ?? []).map((o: any) =>
               h("div", { key: o.id, className: "card" },
                 h("div", { className: "flex items-start justify-between gap-3" },
                   h("div", null,
                     h("p", { className: "font-medium" }, `${o.component?.label} — ${o.title}`),
                     h("p", { className: "text-sm text-muted mt-1" }, o.description),
                     o.wear_percent !== null && h("p", { className: "text-sm text-muted mt-1" }, `Usure : ${o.wear_percent}% — Restant : ${o.remaining_percent}%`),
                     o.recommendation && h("p", { className: "text-sm mt-1" }, `→ ${o.recommendation}`),
                     o.evidence?.length > 0 && h("p", { className: "text-xs text-muted mt-2" }, `${o.evidence.length} preuve(s) rattachee(s) (${o.evidence.map((e: { type: string }) => e.type).join(", ")})`),
                     h(CompareHistoryButton, { observationId: o.id })
                     ),
                   h(SeverityBadge, { severity: Math.max(o.severity, o.urgency) })
                   )
                 )
                                      ),
             observations?.length === 0 && h("p", { className: "text-muted text-sm" }, "Aucune observation enregistree pour l'instant.")
             )
           )
         );
}
