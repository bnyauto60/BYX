"use client";

import { useState } from "react";
import { NavBar } from "@/components/NavBar";

const KINDS: { value: "client" | "technique" | "interne"; label: string; desc: string }[] = [
  { value: "client", label: "Rapport client", desc: "Langage simple, envoyable directement au client." },
  { value: "technique", label: "Rapport technique", desc: "Détail atelier : mesures, hypothèses, preuves." },
  { value: "interne", label: "Rapport interne", desc: "Notes privées, incertitudes, préparation devis." }
];

export default function ReportPage({ params }: { params: { id: string } }) {
  const [kind, setKind] = useState<"client" | "technique" | "interne">("client");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setUrl(null);
    const res = await fetch(`/api/reports/${params.id}/pdf?kind=${kind}`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setUrl(data.url);
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-display text-2xl font-semibold">Générer un rapport</h1>

        <div className="grid gap-3">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`card text-left ${kind === k.value ? "border-accent" : ""}`}
            >
              <p className="font-medium">{k.label}</p>
              <p className="text-sm text-muted">{k.desc}</p>
            </button>
          ))}
        </div>

        <button className="btn btn-primary w-full" disabled={loading} onClick={generate}>
          {loading ? "Génération en cours…" : "Générer le PDF"}
        </button>

        {error && <p className="text-danger text-sm">{error}</p>}

        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary w-full block text-center">
            Ouvrir le PDF généré
          </a>
        )}
      </main>
    </div>
  );
}
