"use client";

import { useRef, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { createElement as h } from "react";

interface Hypothesis {
  explanation: string;
  favorable: string[];
  unfavorable: string[];
  required_checks: string[];
  confidence: number;
  sources?: string[];
}

interface VideoAnalysisResult {
  summary: string;
  observedSigns: string[];
  suggestedComponent?: string;
  confidence?: number;
}

const VIDEO_CONTEXTS = [
  { value: "bruit_moteur", label: "Bruit moteur" },
  { value: "vibration", label: "Vibration" },
  { value: "suspension", label: "Suspension" },
  { value: "fuite", label: "Fuite" },
  { value: "tableau_de_bord", label: "Tableau de bord" },
  { value: "fumee", label: "Fumee" },
  { value: "essai_routier", label: "Essai routier" }
  ];

/**
 * Aide au diagnostic (cahier des charges §9.2), etendue avec une capture
 * video libre analysee par l'IA au meme titre que le texte dicte
 * (bruit moteur, jeu de direction, etc.) — amelioration demandee.
 */
export default function DiagnosticPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(false);
  const [hypotheses, setHypotheses] = useState<Hypothesis[] | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

const videoInput = useRef<HTMLInputElement>(null);
  const [context, setContext] = useState(VIDEO_CONTEXTS[0]?.value ?? "");
  const [uploading, setUploading] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoAnalysisResult | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

async function run() {
  setLoading(true);
  setError(null);
  const res = await fetch("/api/ai/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: params.id })
  });
  const data = await res.json();
  setLoading(false);
  if (data.error) { setError(data.error); return; }
  setProvider(data.provider);
  const list = Array.isArray(data.hypotheses) ? data.hypotheses : data.hypotheses?.hypotheses ?? [];
  setHypotheses(list);
}

async function uploadVideo(file: File) {
  setUploading(true);
  setVideoError(null);
  setVideoResult(null);
  setPrivacyConfirmed(false);
  setEvidenceId(null);
  const form = new FormData();
  form.append("file", file);
  form.append("type", "video");
  form.append("event_id", params.id);
  form.append("captured_context", context);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  setUploading(false);
  if (data.evidence) setEvidenceId(data.evidence.id);
  else setVideoError(data.error ?? "Echec de l'envoi de la video");
}

async function confirmPrivacy(checked: boolean) {
  setPrivacyConfirmed(checked);
  if (checked && evidenceId) {
    await fetch(`/api/evidence/${evidenceId}/privacy`, { method: "POST" });
  }
}

async function analyzeVideo() {
  if (!evidenceId || !privacyConfirmed) return;
  setAnalyzing(true);
  setVideoError(null);
  const res = await fetch("/api/ai/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidence_id: evidenceId })
  });
  const data = await res.json();
  setAnalyzing(false);
  if (data.error) { setVideoError(data.error); return; }
  setVideoResult(data.result);
}

return h("div", null,
         h(NavBar, null),
         h("main", { className: "max-w-2xl mx-auto px-4 py-8 space-y-6" },
           h("div", null,
             h("h1", { className: "font-display text-2xl font-semibold" }, "Aide au diagnostic"),
             h("p", { className: "text-muted text-sm" }, "Hypotheses generees a partir des observations et mesures de cet evenement — jamais un diagnostic certain.")
             ),

           h("button", { className: "btn btn-primary", disabled: loading, onClick: run }, loading ? "Analyse en cours…" : "Generer des hypotheses"),

           error && h("p", { className: "text-danger text-sm" }, error),
           provider && h("p", { className: "text-xs text-muted" }, `Moteur utilise : ${provider}`),

           h("div", { className: "space-y-4" },
             (hypotheses ?? []).map((hy, i) =>
               h("div", { key: i, className: "card" },
                 h("div", { className: "flex items-center justify-between mb-2" },
                   h("p", { className: "font-medium" }, `Hypothese ${i + 1}`),
                   h("span", { className: "text-xs text-muted" }, `Confiance : ${Math.round((hy.confidence ?? 0) * 100)}%`)
                   ),
                 h("p", { className: "text-sm mb-3" }, hy.explanation),
                 hy.favorable?.length > 0 && h("p", { className: "text-sm text-safe" }, `✓ ${hy.favorable.join(" · ")}`),
                 hy.unfavorable?.length > 0 && h("p", { className: "text-sm text-warn" }, `✕ ${hy.unfavorable.join(" · ")}`),
                 hy.required_checks?.length > 0 && h("p", { className: "text-sm text-muted mt-2" }, `Controles necessaires : ${hy.required_checks.join(", ")}`)
                 )
                                    )
             ),

           h("div", { className: "card space-y-3" },
             h("h2", { className: "font-display text-lg font-medium" }, "Analyse video libre"),
             h("p", { className: "text-muted text-sm" }, "Filmez un bruit moteur, un jeu de direction, une fuite, etc. — la video est analysee par l'IA au meme titre que le texte dicte."),

             h("div", null,
               h("label", { className: "label", htmlFor: "video-context" }, "Contexte"),
               h("select", { id: "video-context", className: "input", value: context, onChange: (e: any) => setContext(e.target.value) },
                 VIDEO_CONTEXTS.map((c) => h("option", { key: c.value, value: c.value }, c.label))
                 )
               ),

             h("button", { type: "button", className: "btn btn-secondary w-full", disabled: uploading, onClick: () => videoInput.current?.click() },
               uploading ? "Envoi en cours…" : "🎥 Filmer / choisir une video"
               ),
             h("input", {
               ref: videoInput,
               type: "file",
               accept: "video/*",
               capture: "environment",
               className: "hidden",
               onChange: (e: any) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ""; }
             }),

             evidenceId && h("div", { className: "space-y-2" },
                             h("label", { className: "flex items-center gap-2 text-sm" },
                               h("input", { type: "checkbox", checked: privacyConfirmed, onChange: (e: any) => confirmPrivacy(e.target.checked) }),
                               "Je confirme que cette video ne montre aucun element personnel ni tiers identifiable (uniquement l'element technique)."
                               ),
                             h("button", { type: "button", className: "btn btn-primary w-full", disabled: !privacyConfirmed || analyzing, onClick: analyzeVideo },
                               analyzing ? "Analyse en cours…" : "Analyser cette video"
                               )
                             ),

             videoError && h("p", { className: "text-danger text-sm" }, videoError),

             videoResult && h("div", { className: "border border-line rounded-md p-3 space-y-2 bg-panelAlt" },
                              h("p", { className: "text-sm" }, videoResult.summary),
                              videoResult.observedSigns?.length > 0 && h("p", { className: "text-sm text-muted" }, `Signes observes : ${videoResult.observedSigns.join(", ")}`),
                              videoResult.suggestedComponent && h("p", { className: "text-sm" }, `Composant suggere : ${videoResult.suggestedComponent}`),
                              typeof videoResult.confidence === "number" && h("p", { className: "text-xs text-muted" }, `Confiance : ${Math.round(videoResult.confidence * 100)}%`)
                              )
             )
           )
         );
}
