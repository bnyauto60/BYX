"use client";

import { useRef, useState, createElement as h, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MediaCapture } from "./MediaCapture";
import { SEVERITY_LEVELS, mustAppearInClientReport } from "@/lib/ref/severity";
import type { StructuredObservation } from "@/lib/ai/types";
import type { Component } from "@/types";

type SegmentStatus = "analyzing" | "ready" | "saving" | "saved" | "error";

interface Segment {
  id: string;
  rawText: string;
  status: SegmentStatus;
  proposal?: StructuredObservation;
  componentId?: string;
  media: { id: string; type: string }[];
  errorMsg?: string;
}

/**
 * Flux : dictee/texte -> IA structure une proposition -> le mecanicien
 * corrige si besoin -> validation -> ecriture en base + rattachement des
 * preuves deja capturees. L'IA ne pose une question de clarification que si
 * needs_confirmation est vrai (cahier des charges §20).
 *
 * Mode "tour du vehicule en continu" (amelioration demandee) : le
 * mecanicien parle en continu en marchant autour du vehicule ; chaque
 * silence de ~2,5s declenche automatiquement la structuration du texte
 * accumule depuis le dernier segment, sans clic. Les photos/videos prises
 * pendant la dictee se rattachent au segment en cours de constitution.
 */
export function ObservationForm({
  eventId,
  vehicleId,
  components
}: {
  eventId: string;
  vehicleId: string | null;
  components: Component[];
}) {
  const router = useRouter();

const [rawText, setRawText] = useState("");
  const [proposal, setProposal] = useState<StructuredObservation | null>(null);
  const [componentId, setComponentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEvidence, setPendingEvidence] = useState<{ id: string; type: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

const [waActive, setWaActive] = useState(false);
  const [waSupported] = useState(
    () => typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    );
  const [waInterim, setWaInterim] = useState("");
  const [waSegments, setWaSegments] = useState<Segment[]>([]);
  const [waPendingMediaCount, setWaPendingMediaCount] = useState(0);
  const [waUploading, setWaUploading] = useState(false);

const recognitionRef = useRef<any>(null);
  const bufferRef = useRef("");
  const silenceTimerRef = useRef<any>(null);
  const pendingMediaRef = useRef<{ id: string; type: string }[]>([]);
  const waActiveRef = useRef(false);
  const waPhotoInput = useRef<HTMLInputElement>(null);
  const waVideoInput = useRef<HTMLInputElement>(null);

function updateSegment(id: string, patch: Partial<Segment>) {
  setWaSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

async function flushSegment() {
  const text = bufferRef.current.trim();
  bufferRef.current = "";
  setWaInterim("");
  if (!text) return;

  const media = pendingMediaRef.current;
  pendingMediaRef.current = [];
  setWaPendingMediaCount(0);

  const id = crypto.randomUUID();
  setWaSegments((prev) => [...prev, { id, rawText: text, status: "analyzing" as SegmentStatus, media }]);

  try {
    const res = await fetch("/api/ai/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, event_id: eventId })
    });
    const data = await res.json();
    if (data.error) { updateSegment(id, { status: "error", errorMsg: data.error }); return; }
    const match = components.find((c) => c.code === data.structured.component_code);
    updateSegment(id, { status: "ready", proposal: data.structured, componentId: match?.id ?? "" });
  } catch (err) {
    updateSegment(id, { status: "error", errorMsg: "Erreur reseau" });
  }
}

function scheduleFlush() {
  if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  silenceTimerRef.current = setTimeout(() => { flushSegment(); }, 2200);
}

function startRecognition() {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event: any) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        bufferRef.current = bufferRef.current ? `${bufferRef.current} ${transcript}` : transcript;
      } else {
        interim += transcript;
      }
    }
    setWaInterim(interim);
    scheduleFlush();
  };
  recognition.onend = () => {
    if (waActiveRef.current) {
      try { recognition.start(); } catch (e) { /* deja demarre */ }
    }
  };
  recognition.onerror = () => { /* on laisse onend gerer le redemarrage eventuel */ };
  recognitionRef.current = recognition;
  recognition.start();
}

function startWalkaround() {
  if (!waSupported) return;
  waActiveRef.current = true;
  setWaActive(true);
  startRecognition();
}

function stopWalkaround() {
  waActiveRef.current = false;
  setWaActive(false);
  recognitionRef.current?.stop();
  if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  flushSegment();
}

async function uploadWaMedia(file: File, type: "photo" | "video") {
  setWaUploading(true);
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  form.append("event_id", eventId);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  setWaUploading(false);
  if (data.evidence) {
    pendingMediaRef.current = [...pendingMediaRef.current, data.evidence];
    setWaPendingMediaCount(pendingMediaRef.current.length);
  }
}

async function saveSegment(segment: Segment) {
  if (!segment.proposal || !segment.componentId) {
    updateSegment(segment.id, { status: "error", errorMsg: "Selectionnez un composant avant d'enregistrer." });
    return;
  }
  updateSegment(segment.id, { status: "saving" });
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const p = segment.proposal;

  const { data: observation, error: insertError } = await supabase
  .from("observations")
  .insert({
    event_id: eventId,
    component_id: segment.componentId,
    title: p.title,
    description: p.description,
    state: p.state,
    severity: p.severity,
    urgency: p.urgency,
    confidence: p.confidence,
    wear_percent: p.wear_percent,
    remaining_percent: p.remaining_percent,
    recommendation: p.recommendation,
    technician_id: auth.user?.id,
    include_in_client_report: true,
    client_uuid: crypto.randomUUID()
  })
  .select()
  .single();

  if (insertError) { updateSegment(segment.id, { status: "error", errorMsg: insertError.message }); return; }

  if (segment.media.length > 0) {
    await supabase.from("evidence").update({ observation_id: observation.id }).in("id", segment.media.map((m) => m.id));
  }

  if (vehicleId) {
    fetch(`/api/vehicles/${vehicleId}/recompute-health`, { method: "POST" }).catch(() => {});
  }

  router.refresh();
  setWaSegments((prev) => prev.filter((s) => s.id !== segment.id));
}

function discardSegment(id: string) {
  setWaSegments((prev) => prev.filter((s) => s.id !== id));

}

async function structure() {
  if (!rawText.trim()) return;
  setLoading(true);
  setError(null);
  const res = await fetch("/api/ai/structure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: rawText, event_id: eventId })
  });
  const data = await res.json();
  setLoading(false);
  if (data.error) { setError(data.error); return; }
  setProposal(data.structured);
  const match = components.find((c) => c.code === data.structured.component_code);
  if (match) setComponentId(match.id);
}

async function save() {
  if (!proposal || !componentId) { setError("Selectionnez un composant avant d'enregistrer."); return; }
  setLoading(true);
  setError(null);
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  const forcedReport = mustAppearInClientReport(proposal.severity, proposal.urgency);

  const { data: observation, error: insertError } = await supabase
  .from("observations")
  .insert({
    event_id: eventId,
    component_id: componentId,
    title: proposal.title,
    description: proposal.description,
    state: proposal.state,
    severity: proposal.severity,
    urgency: proposal.urgency,
    confidence: proposal.confidence,
    wear_percent: proposal.wear_percent,
    remaining_percent: proposal.remaining_percent,
    recommendation: proposal.recommendation,
    technician_id: auth.user?.id,
    include_in_client_report: true,
    client_uuid: crypto.randomUUID()
  })
  .select()
  .single();

  if (insertError) { setLoading(false); setError(insertError.message); return; }

  if (pendingEvidence.length > 0) {
    await supabase.from("evidence").update({ observation_id: observation.id }).in(
      "id", pendingEvidence.map((e) => e.id)
      );
  }
  void forcedReport;

  if (vehicleId) {
    fetch(`/api/vehicles/${vehicleId}/recompute-health`, { method: "POST" }).catch(() => {});
  }

  setLoading(false);
  router.refresh();
  setRawText("");
  setProposal(null);
  setPendingEvidence([]);
}

function renderSegment(segment: Segment) {
  return h("div", { key: segment.id, className: "border border-line rounded-md p-3 space-y-3 bg-panelAlt" },
           h("p", { className: "text-xs text-muted uppercase tracking-wide" }, `Segment dicte : "${segment.rawText}"`),

           segment.status === "analyzing" && h("p", { className: "text-sm text-muted" }, "Analyse IA en cours…"),
           segment.status === "error" && h("p", { className: "text-danger text-sm" }, segment.errorMsg ?? "Erreur"),

           segment.status === "ready" && segment.proposal && h(Fragment, null,
                                                               h("div", null,
                                                                 h("label", { className: "label" }, "Composant"),
                                                                 h("select", {
                                                                   className: "input",
                                                                   value: segment.componentId ?? "",
                                                                   onChange: (e: any) => updateSegment(segment.id, { componentId: e.target.value })
                                                                 },
                                                                   h("option", { value: "" }, "— Selectionner —"),
                                                                   components.map((c) => h("option", { key: c.id, value: c.id }, c.label))
                                                                   )
                                                                 ),
                                                               h("div", null,
                                                                 h("label", { className: "label" }, "Titre"),
                                                                 h("input", {
                                                                   className: "input",
                                                                   value: segment.proposal.title,
                                                                   onChange: (e: any) => updateSegment(segment.id, { proposal: { ...segment.proposal!, title: e.target.value } })
                                                                 })
                                                                 ),
                                                               h("div", null,
                                                                 h("label", { className: "label" }, "Description"),
                                                                 h("textarea", {
                                                                   className: "input",
                                                                   value: segment.proposal.description,
                                                                   onChange: (e: any) => updateSegment(segment.id, { proposal: { ...segment.proposal!, description: e.target.value } })
                                                                 })
                                                                 ),
                                                               h("div", { className: "grid grid-cols-2 gap-3" },
                                                                 h("div", null,
                                                                   h("label", { className: "label" }, "Gravite"),
                                                                   h("select", {
                                                                     className: "input",
                                                                     value: segment.proposal.severity,
                                                                     onChange: (e: any) => updateSegment(segment.id, { proposal: { ...segment.proposal!, severity: Number(e.target.value) } })
                                                                   }, SEVERITY_LEVELS.map((s) => h("option", { key: s.value, value: s.value }, `${s.value} — ${s.label}`)))
                                                                   ),
                                                                 h("div", null,
                                                                   h("label", { className: "label" }, "Urgence"),
                                                                   h("select", {
                                                                     className: "input",
                                                                     value: segment.proposal.urgency,
                                                                     onChange: (e: any) => updateSegment(segment.id, { proposal: { ...segment.proposal!, urgency: Number(e.target.value) } })
                                                                   }, SEVERITY_LEVELS.map((s) => h("option", { key: s.value, value: s.value }, `${s.value} — ${s.label}`)))
                                                                   )
                                                                 ),
                                                               segment.media.length > 0 && h("p", { className: "text-xs text-safe" }, `${segment.media.length} preuve(s) rattachee(s) a ce segment.`),
                                                               h("div", { className: "flex gap-2" },
                                                                 h("button", {
                                                                   type: "button",
                                                                   className: "btn btn-primary flex-1",
                                                                   disabled: segment.status === "saving",
                                                                   onClick: () => saveSegment(segment)
                                                                 }, segment.status === "saving" ? "Enregistrement…" : "Enregistrer cette observation"),
                                                                 h("button", {
                                                                   type: "button",
                                                                   className: "btn btn-secondary",
                                                                   onClick: () => discardSegment(segment.id)
                                                                 }, "Ignorer")
                                                                 )
                                                               )
           );
}

return h("div", { className: "space-y-4" },

         h("div", { className: "card space-y-4" },
           h("h3", { className: "font-display text-lg font-medium" }, "Tour du vehicule (enregistrement continu)"),
           !waSupported && h("p", { className: "text-xs text-muted" }, "Dictee continue non disponible sur ce navigateur — utilisez la saisie manuelle ci-dessous."),

           waSupported && h(Fragment, null,
                            h("button", {
                              type: "button",
                              className: `btn w-full ${waActive ? "bg-danger text-white" : "btn-primary"}`,
                              onClick: waActive ? stopWalkaround : startWalkaround
                            }, waActive ? "● Enregistrement en cours… (appuyer pour arreter)" : "🎙️ Demarrer le tour du vehicule"),

                            waActive && h("div", { className: "space-y-2" },
                                          h("p", { className: "text-sm text-muted italic" }, waInterim || "…parlez, chaque pause cree une nouvelle observation."),
                                          h("div", { className: "flex gap-2" },
                                            h("button", { type: "button", className: "btn btn-secondary flex-1", disabled: waUploading, onClick: () => waPhotoInput.current?.click() }, "📷 Photo"),
                                            h("button", { type: "button", className: "btn btn-secondary flex-1", disabled: waUploading, onClick: () => waVideoInput.current?.click() }, "🎥 Video")
                                            ),
                                          waPendingMediaCount > 0 && h("p", { className: "text-xs text-safe" }, `${waPendingMediaCount} preuve(s) prete(s) a etre rattachee(s) au prochain segment.`),
                                          h("input", {
                                            ref: waPhotoInput, type: "file", accept: "image/*", capture: "environment", className: "hidden",
                                            onChange: (e: any) => { const f = e.target.files?.[0]; if (f) uploadWaMedia(f, "photo"); e.target.value = ""; }
                                          }),
                                          h("input", {
                                            ref: waVideoInput, type: "file", accept: "video/*", capture: "environment", className: "hidden",
                                            onChange: (e: any) => { const f = e.target.files?.[0]; if (f) uploadWaMedia(f, "video"); e.target.value = ""; }
                                          })
                                          )
                            ),

           waSegments.length > 0 && h("div", { className: "space-y-3" }, waSegments.map(renderSegment))
           ),

         h("div", { className: "card space-y-4" },
           h("h3", { className: "font-display text-lg font-medium" }, "Ajout manuel"),

           h("textarea", {
             className: "input min-h-24",
             placeholder: "Saisissez librement : ex. « Pneu arriere gauche craquele, crevaison proche du flanc, reparation deconseillee »",
             value: rawText,
             onChange: (e: any) => setRawText(e.target.value)
           }),

           h(MediaCapture, { eventId, onUploaded: (ev: { id: string; type: string }) => setPendingEvidence((prev) => [...prev, ev]) }),
           pendingEvidence.length > 0 && h("p", { className: "text-xs text-safe" }, `${pendingEvidence.length} preuve(s) prete(s) a etre rattachee(s) a cette observation.`),

           h("button", { type: "button", className: "btn btn-primary w-full", disabled: loading || !rawText.trim(), onClick: structure },
             loading ? "Analyse en cours…" : "Structurer avec l'IA"
             ),

           error && h("p", { className: "text-danger text-sm" }, error),

           proposal && h("div", { className: "border border-line rounded-md p-3 space-y-3 bg-panelAlt" },
                         h("p", { className: "text-xs text-muted uppercase tracking-wide" }, "Proposition IA — a valider ou corriger"),

                         h("div", null,
                           h("label", { className: "label", htmlFor: "component" }, "Composant"),
                           h("select", { id: "component", className: "input", value: componentId, onChange: (e: any) => setComponentId(e.target.value) },
                             h("option", { value: "" }, "— Selectionner —"),
                             components.map((c) => h("option", { key: c.id, value: c.id }, c.label))
                             ),
                           !componentId && proposal.component_label_if_unknown && h("p", { className: "text-xs text-warn mt-1" },
                                                                                    `Composant non reconnu ("${proposal.component_label_if_unknown}") — proposez-le a l'atelier responsable si besoin.`
                                                                                    )
                           ),

                         h("div", null,
                           h("label", { className: "label", htmlFor: "title" }, "Titre"),
                           h("input", { id: "title", className: "input", value: proposal.title, onChange: (e: any) => setProposal({ ...proposal, title: e.target.value }) })
                           ),

                         h("div", null,
                           h("label", { className: "label", htmlFor: "description" }, "Description"),
                           h("textarea", { id: "description", className: "input", value: proposal.description, onChange: (e: any) => setProposal({ ...proposal, description: e.target.value }) })
                           ),

                         h("div", { className: "grid grid-cols-2 gap-3" },
                           h("div", null,
                             h("label", { className: "label", htmlFor: "severity" }, "Gravite"),
                             h("select", { id: "severity", className: "input", value: proposal.severity, onChange: (e: any) => setProposal({ ...proposal, severity: Number(e.target.value) }) },
                               SEVERITY_LEVELS.map((s) => h("option", { key: s.value, value: s.value }, `${s.value} — ${s.label}`))
                               )
                             ),
                           h("div", null,
                             h("label", { className: "label", htmlFor: "urgency" }, "Urgence"),
                             h("select", { id: "urgency", className: "input", value: proposal.urgency, onChange: (e: any) => setProposal({ ...proposal, urgency: Number(e.target.value) }) },
                               SEVERITY_LEVELS.map((s) => h("option", { key: s.value, value: s.value }, `${s.value} — ${s.label}`))
                               )
                             )
                           ),

                         proposal.wear_percent !== null && h("div", { className: "grid grid-cols-2 gap-3" },
                                                             h("div", null,
                                                               h("label", { className: "label", htmlFor: "wear" }, "Usure (%)"),
                                                               h("input", {
                                                                 id: "wear", type: "number", className: "input", value: proposal.wear_percent ?? "",
                                                                 onChange: (e: any) => {
                                                                   const wear = Number(e.target.value);
                                                                   setProposal({ ...proposal, wear_percent: wear, remaining_percent: 100 - wear });
                                                                 }
                                                               })
                                                               ),
                                                             h("div", null,
                                                               h("label", { className: "label", htmlFor: "remaining" }, "Restant (%)"),
                                                               h("input", { id: "remaining", type: "number", className: "input", value: proposal.remaining_percent ?? "", onChange: (e: any) => setProposal({ ...proposal, remaining_percent: Number(e.target.value) }) })
                                                               )
                                                             ),

                         h("div", null,
                           h("label", { className: "label", htmlFor: "recommendation" }, "Recommandation"),
                           h("input", { id: "recommendation", className: "input", value: proposal.recommendation ?? "", onChange: (e: any) => setProposal({ ...proposal, recommendation: e.target.value }) })
                           ),

                         mustAppearInClientReport(proposal.severity, proposal.urgency) && h("p", { className: "text-xs text-danger" }, "⚠ Gravite/urgence elevee — cette observation apparaitra obligatoirement dans le rapport client."),

                         h("button", { type: "button", className: "btn btn-primary w-full", disabled: loading, onClick: save }, "Valider et enregistrer")
                         )
           )
         );
}
