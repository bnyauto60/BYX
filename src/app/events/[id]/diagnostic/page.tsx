"use client";

import { useState } from "react";
import { NavBar } from "@/components/NavBar";

interface Hypothesis {
  explanation: string;
  favorable: string[];
  unfavorable: string[];
  required_checks: string[];
  confidence: number;
  sources?: string[];
}

/**
 * Aide au diagnostic (cahier des charges §9.2). Affiche toujours les
 * éléments favorables/défavorables et le niveau de confiance : l'IA ne doit
 * jamais présenter une hypothèse comme un diagnostic certain.
 */
export default function DiagnosticPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(false);
  const [hypotheses, setHypotheses] = useState<Hypothesis[] | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Aide au diagnostic</h1>
          <p className="text-muted text-sm">Hypothèses générées à partir des observations et mesures de cet événement — jamais un diagnostic certain.</p>
        </div>

        <button className="btn btn-primary" disabled={loading} onClick={run}>
          {loading ? "Analyse en cours…" : "Générer des hypothèses"}
        </button>

        {error && <p className="text-danger text-sm">{error}</p>}
        {provider && <p className="text-xs text-muted">Moteur utilisé : {provider}</p>}

        <div className="space-y-4">
          {(hypotheses ?? []).map((h, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Hypothèse {i + 1}</p>
                <span className="text-xs text-muted">Confiance : {Math.round((h.confidence ?? 0) * 100)}%</span>
              </div>
              <p className="text-sm mb-3">{h.explanation}</p>
              {h.favorable?.length > 0 && (
                <p className="text-sm text-safe">✓ {h.favorable.join(" · ")}</p>
              )}
              {h.unfavorable?.length > 0 && (
                <p className="text-sm text-warn">✕ {h.unfavorable.join(" · ")}</p>
              )}
              {h.required_checks?.length > 0 && (
                <p className="text-sm text-muted mt-2">Contrôles nécessaires : {h.required_checks.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
