"use client";

import { useRef, useState } from "react";
import { VoiceDictation } from "./VoiceDictation";

export interface ExtractedFields {
  vin: string | null;
  plate: string | null;
  make: string | null;
  model_name: string | null;
  year: number | null;
  mileage: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  confidence: number;
}

/**
 * Remplace la saisie manuelle par une photo (carte grise, fiche client) ou
 * une dictée libre. Utilisé sur l'écran "Nouveau véhicule" — la saisie
 * manuelle reste toujours possible en dessous, ce composant ne fait que
 * pré-remplir.
 */
export function DocumentCapture({ onExtracted }: { onExtracted: (fields: ExtractedFields) => void }) {
  const registrationInput = useRef<HTMLInputElement>(null);
  const customerInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitPhoto(file: File, kind: "registration" | "customer_card") {
    setLoading(kind);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    try {
      const res = await fetch("/api/ai/document", { method: "POST", body: form });
      const data = await res.json();
      setLoading(null);
      if (data.error) { setError(data.error); return; }
      onExtracted(data.extraction);
    } catch {
      setLoading(null);
      setError("Échec de la lecture de la photo.");
    }
  }

  async function submitVoice(text: string) {
    setLoading("voice");
    setError(null);
    try {
      const res = await fetch("/api/ai/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind: "voice" })
      });
      const data = await res.json();
      setLoading(null);
      if (data.error) { setError(data.error); return; }
      onExtracted(data.extraction);
    } catch {
      setLoading(null);
      setError("Échec de l'interprétation de la dictée.");
    }
  }

  return (
    <div className="card space-y-3 border-accent/40">
      <p className="text-xs text-muted uppercase tracking-wide">Remplissage automatique — plus rapide que la saisie</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" disabled={!!loading} onClick={() => registrationInput.current?.click()}>
          {loading === "registration" ? "Lecture…" : "📄 Photo carte grise"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!!loading} onClick={() => customerInput.current?.click()}>
          {loading === "customer_card" ? "Lecture…" : "🪪 Photo fiche client"}
        </button>
      </div>
      <VoiceDictation onResult={submitVoice} />
      {loading === "voice" && <p className="text-xs text-muted">Interprétation en cours…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      <input
        ref={registrationInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) submitPhoto(f, "registration"); e.target.value = ""; }}
      />
      <input
        ref={customerInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) submitPhoto(f, "customer_card"); e.target.value = ""; }}
      />
    </div>
  );
}
