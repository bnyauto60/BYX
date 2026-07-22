"use client";

import { useRef, useState } from "react";

const VIDEO_CONTEXTS = [
  { value: "bruit_moteur", label: "Bruit moteur" },
  { value: "vibration", label: "Vibration" },
  { value: "suspension", label: "Suspension" },
  { value: "fuite", label: "Fuite" },
  { value: "tableau_de_bord", label: "Tableau de bord" },
  { value: "fumee", label: "Fumée" },
  { value: "essai_routier", label: "Essai routier" }
];

/**
 * Capture photo et vidéo au même niveau (amélioration demandée). L'attribut
 * `capture` déclenche l'appareil photo/caméra natif du téléphone directement,
 * sans passer par la galerie — essentiel pour la rapidité en atelier.
 */
export function MediaCapture({
  eventId,
  observationId,
  onUploaded
}: {
  eventId: string;
  observationId?: string;
  onUploaded: (evidence: { id: string; type: string }) => void;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [context, setContext] = useState(VIDEO_CONTEXTS[0]?.value ?? "");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File, type: "photo" | "video") {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("event_id", eventId);
    if (observationId) form.append("observation_id", observationId);
    if (type === "video") form.append("captured_context", context);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (data.evidence) onUploaded(data.evidence);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" disabled={uploading} onClick={() => photoInput.current?.click()}>
          📷 Photo
        </button>
        <button type="button" className="btn btn-secondary flex-1" disabled={uploading} onClick={() => videoInput.current?.click()}>
          🎥 Vidéo
        </button>
      </div>

      <div>
        <label className="label" htmlFor="video-context">Contexte vidéo (si applicable)</label>
        <select id="video-context" className="input" value={context} onChange={(e) => setContext(e.target.value)}>
          {VIDEO_CONTEXTS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {uploading && <p className="text-xs text-muted">Envoi en cours…</p>}

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "photo"); e.target.value = ""; }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "video"); e.target.value = ""; }}
      />
    </div>
  );
}
