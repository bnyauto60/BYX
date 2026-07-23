import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { PlateSearchCapture } from "@/components/PlateSearchCapture";

export const dynamic = "force-dynamic";

/**
 * Recherche multi-critères (amélioration demandée) : immatriculation, VIN,
 * marque, modèle, nom client, téléphone client. La recherche par photo
 * (PlateSearchCapture) lit la plaque et relance cette même page avec le
 * résultat en paramètre "q", donc elle bénéficie automatiquement de la
 * même logique de recherche.
 */
export default async function VehiclesPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const supabase = createClient();

  let vehicles: any[] = [];

  if (q) {
    const [{ data: byVehicleFields }, { data: matchingCustomers }] = await Promise.all([
      supabase
        .from("vehicles")
        .select("*")
        .or(`plate.ilike.%${q}%,vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("customers")
        .select("id")
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    ]);

    let byCustomer: any[] = [];
    const customerIds = (matchingCustomers ?? []).map((c) => c.id);
    if (customerIds.length > 0) {
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })
        .limit(50);
      byCustomer = data ?? [];
    }

    const merged = new Map<string, any>();
    for (const v of [...(byVehicleFields ?? []), ...byCustomer]) merged.set(v.id, v);
    vehicles = Array.from(merged.values());
  } else {
    const { data } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false }).limit(50);
    vehicles = data ?? [];
  }

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
            placeholder="Immatriculation, VIN, marque, modèle, nom ou téléphone du client…"
            className="input"
          />
          <button type="submit" className="btn btn-secondary whitespace-nowrap">Rechercher</button>
        </form>

        <PlateSearchCapture />

        <div className="grid gap-3">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className="card flex items-center justify-between hover:border-accent">
              <div>
                <p className="font-medium">{v.make} {v.model} <span className="text-muted">{v.year ?? ""}</span></p>
                <p className="text-sm text-muted">{v.plate} — VIN {v.vin}</p>
              </div>
              <p className="text-sm text-muted">{v.mileage ? `${v.mileage.toLocaleString("fr-FR")} km` : ""}</p>
            </Link>
          ))}
          {vehicles.length === 0 && (
            <p className="text-muted text-sm">Aucun véhicule trouvé{q ? ` pour "${q}"` : ""}.</p>
          )}
        </div>
      </main>
    </div>
  );
}
