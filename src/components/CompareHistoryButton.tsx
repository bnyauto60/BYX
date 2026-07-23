"use client";

import { useState } from "react";

interface Comparison {
  evolution?: string;
  explanation?: string;
}

/**
 * Déclenche la comparaison de l'observation avec l'historique du même
 * composant sur ce véhicule (cahier des charges §9.3). Affiché en ligne
 * pour ne pas interrompre le flux d'inspection — le mécanicien clique
 * seulement s'il veut ce contexte.
 */
export function CompareHistoryButton({ observationId }: { observationId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observation_id: observationId })
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setResult(data.comparison);
  }

  if (result) {
    return (
      <p className="text-xs text-accent mt-2">
        Historique : {result.evolution?.replace(/_/g, " ") ?? "—"}{result.explanation ? ` — ${result.explanation}` : ""}
      </p>
    );
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={run} disabled={loading} className="text-xs text-accent hover:underline">
        {loading ? "Comparaison en cours…" : "Comparer à l'historique de ce composant"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
