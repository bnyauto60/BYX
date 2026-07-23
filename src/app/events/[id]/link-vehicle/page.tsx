"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavBar } from "@/components/NavBar";

interface VehicleResult {
  id: string;
  plate: string;
  vin: string;
  make: string | null;
  model: string | null;
}

export default function LinkVehiclePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VehicleResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("vehicles")
      .select("id, plate, vin, make, model")
      .or(`plate.ilike.%${q}%,vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`)
      .limit(10);
    setLoading(false);
    setResults(data ?? []);
  }

  async function link(vehicleId: string) {
    const supabase = createClient();
    // Récupère (ou crée) le carnet de santé technique du véhicule pour rattacher l'événement.
    const { data: record } = await supabase
      .from("technical_records")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    await supabase
      .from("technical_events")
      .update({ vehicle_id: vehicleId, technical_record_id: record?.id ?? null })
      .eq("id", params.id);

    router.push(`/events/${params.id}`);
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-display text-2xl font-semibold">Relier un véhicule</h1>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Immatriculation, VIN, marque, modèle…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button className="btn btn-secondary" onClick={search} disabled={loading}>
            {loading ? "…" : "Chercher"}
          </button>
        </div>
        <div className="space-y-2">
          {results.map((v) => (
            <button
              key={v.id}
              onClick={() => link(v.id)}
              className="card w-full text-left flex items-center justify-between hover:border-accent"
            >
              <div>
                <p className="font-medium">{v.make} {v.model}</p>
                <p className="text-sm text-muted">{v.plate} — VIN {v.vin}</p>
              </div>
              <span className="text-accent text-sm">Relier →</span>
            </button>
          ))}
          {results.length === 0 && !loading && q && (
            <p className="text-muted text-sm">Aucun véhicule trouvé pour "{q}".</p>
          )}
        </div>
      </main>
    </div>
  );
}
