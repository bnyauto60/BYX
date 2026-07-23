"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavBar } from "@/components/NavBar";
import { DocumentCapture, type ExtractedFields } from "@/components/DocumentCapture";

/**
 * Le VIN est la clé pivot forte (voir docs/DECISIONS.md). Avant de créer une
 * fiche, on vérifie qu'aucun véhicule avec ce VIN n'existe déjà dans
 * l'atelier, pour éviter les doublons (cahier des charges §4.1).
 *
 * Amélioration demandée : la photo (carte grise / fiche client) ou la
 * dictée remplissent le formulaire automatiquement via DocumentCapture ;
 * la saisie manuelle reste toujours possible et prioritaire si le
 * mécanicien corrige un champ après extraction.
 */
export default function NewVehiclePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    vin: "", plate: "", make: "", model: "", year: "", mileage: "", customerName: "", customerPhone: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [existing, setExisting] = useState<{ id: string; plate: string } | null>(null);
  const [lastExtractionConfidence, setLastExtractionConfidence] = useState<number | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyExtraction(fields: ExtractedFields) {
    setLastExtractionConfidence(fields.confidence);
    setForm((f) => ({
      vin: fields.vin ?? f.vin,
      plate: fields.plate ?? f.plate,
      make: fields.make ?? f.make,
      model: fields.model_name ?? f.model,
      year: fields.year ? String(fields.year) : f.year,
      mileage: fields.mileage ? String(fields.mileage) : f.mileage,
      customerName: fields.customer_name ?? f.customerName,
      customerPhone: fields.customer_phone ?? f.customerPhone
    }));
    if (fields.vin) checkVin(fields.vin);
  }

  async function checkVin(vin: string) {
    update("vin", vin);
    setExisting(null);
    if (vin.length < 6) return;
    setChecking(true);
    const supabase = createClient();
    const { data } = await supabase.from("vehicles").select("id, plate").eq("vin", vin).maybeSingle();
    setChecking(false);
    if (data) setExisting(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (existing) {
      router.push(`/vehicles/${existing.id}`);
      return;
    }
    const supabase = createClient();
    const { data: profile } = await supabase.auth.getUser();
    const { data: userProfile } = await supabase
      .from("users_profile")
      .select("workshop_id")
      .eq("id", profile.user?.id)
      .single();

    let customerId: string | null = null;
    if (form.customerName) {
      const { data: customer } = await supabase
        .from("customers")
        .insert({ workshop_id: userProfile?.workshop_id, full_name: form.customerName, phone: form.customerPhone })
        .select()
        .single();
      customerId = customer?.id ?? null;
    }

    const { data: vehicle, error: insertError } = await supabase
      .from("vehicles")
      .insert({
        workshop_id: userProfile?.workshop_id,
        vin: form.vin.toUpperCase(),
        plate: form.plate.toUpperCase(),
        make: form.make || null,
        model: form.model || null,
        year: form.year ? Number(form.year) : null,
        mileage: form.mileage ? Number(form.mileage) : null,
        customer_id: customerId
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await supabase.from("technical_records").insert({ vehicle_id: vehicle.id });
    router.push(`/vehicles/${vehicle.id}`);
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <h1 className="font-display text-2xl font-semibold">Nouveau véhicule</h1>

        <DocumentCapture onExtracted={applyExtraction} />

        {lastExtractionConfidence !== null && lastExtractionConfidence < 0.5 && (
          <p className="text-xs text-warn">
            Extraction peu fiable — vérifiez et corrigez les champs ci-dessous avant de créer le véhicule.
          </p>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="vin">VIN (numéro de châssis)</label>
            <input
              id="vin"
              required
              className="input font-mono"
              value={form.vin}
              onChange={(e) => checkVin(e.target.value)}
              placeholder="ex: VF1AB000000000001"
            />
            {checking && <p className="text-xs text-muted mt-1">Vérification…</p>}
            {existing && (
              <p className="text-xs text-warn mt-1">
                Ce VIN existe déjà (plaque {existing.plate}). La création ouvrira la fiche existante.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="plate">Immatriculation</label>
            <input id="plate" required className="input" value={form.plate} onChange={(e) => update("plate", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="make">Marque</label>
              <input id="make" className="input" value={form.make} onChange={(e) => update("make", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="model">Modèle</label>
              <input id="model" className="input" value={form.model} onChange={(e) => update("model", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="year">Année</label>
              <input id="year" type="number" className="input" value={form.year} onChange={(e) => update("year", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="mileage">Kilométrage</label>
              <input id="mileage" type="number" className="input" value={form.mileage} onChange={(e) => update("mileage", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="customerName">Client (nom)</label>
              <input id="customerName" className="input" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="customerPhone">Téléphone</label>
              <input id="customerPhone" className="input" value={form.customerPhone} onChange={(e) => update("customerPhone", e.target.value)} />
            </div>
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">
            {existing ? "Ouvrir la fiche existante" : "Créer le véhicule"}
          </button>
        </form>
      </main>
    </div>
  );
}
