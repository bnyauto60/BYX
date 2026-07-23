"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Je prends en photo la voiture avec la plaque, ça me le retrouve tout de
 * suite." Lit la plaque via l'IA puis relance la recherche avec ce texte.
 */
export function PlateSearchCapture() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(file: File) {
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "plate_photo");
    try {
      const res = await fetch("/api/ai/document", { method: "POST", body: form });
      const data = await res.json();
      setLoading(false);
      if (data.error || !data.extraction?.plate) {
        setError("Plaque non lisible sur cette photo — réessayez ou saisissez-la manuellement.");
        return;
      }
      router.push(`/vehicles?q=${encodeURIComponent(data.extraction.plate)}`);
    } catch {
      setLoading(false);
      setError("Échec de la lecture de la photo.");
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => inputRef.current?.click()}>
        {loading ? "Lecture de la plaque…" : "📷 Rechercher par photo du véhicule"}
      </button>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(f); e.target.value = ""; }}
      />
    </div>
  );
}
