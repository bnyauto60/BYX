import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const supabase = createClient();

  let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false }).limit(50);
  if (q) {
    // Recherche par immatriculation, VIN, marque ou modèle (cahier des charges §12).
    query = query.or(`plate.ilike.%${q}%,vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`);
  }
  const { data: vehicles } = await query;

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">Véhicules</h1>
          <Link href="/vehicles/new" className="btn btn-primary">Nouveau véhicule</Link>
        </div>

        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Immatriculation, VIN, marque, modèle…"
            className="input"
          />
          <button type="submit" className="btn btn-secondary">Rechercher</button>
        </form>

        <div className="grid gap-3">
          {(vehicles ?? []).map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className="card flex items-center justify-between hover:border-accent">
              <div>
                <p className="font-medium">{v.make} {v.model} <span className="text-muted">{v.year ?? ""}</span></p>
                <p className="text-sm text-muted">{v.plate} — VIN {v.vin}</p>
              </div>
              <p className="text-sm text-muted">{v.mileage ? `${v.mileage.toLocaleString("fr-FR")} km` : ""}</p>
            </Link>
          ))}
          {vehicles?.length === 0 && (
            <p className="text-muted text-sm">Aucun véhicule trouvé{q ? ` pour "${q}"` : ""}.</p>
          )}
        </div>
      </main>
    </div>
  );
}
