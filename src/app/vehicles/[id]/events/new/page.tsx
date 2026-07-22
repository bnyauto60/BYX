"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavBar } from "@/components/NavBar";
import type { EventType } from "@/types";

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "inspection", label: "Inspection" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "entretien", label: "Entretien" },
  { value: "reparation", label: "Réparation" },
  { value: "controle", label: "Contrôle" },
  { value: "essai_routier", label: "Essai routier" },
  { value: "contre_visite", label: "Contre-visite" },
  { value: "expertise", label: "Expertise" },
  { value: "devis_technique", label: "Devis technique" },
  { value: "reception_vehicule", label: "Réception du véhicule" },
  { value: "suivi_post_intervention", label: "Suivi après intervention" }
];

export default function NewEventPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [eventType, setEventType] = useState<EventType>("inspection");
  const [title, setTitle] = useState("Inspection générale");
  const [mileage, setMileage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    const { data: record } = await supabase
      .from("technical_records")
      .select("id")
      .eq("vehicle_id", params.id)
      .single();

    const { data: auth } = await supabase.auth.getUser();

    const { data: event, error: insertError } = await supabase
      .from("technical_events")
      .insert({
        technical_record_id: record?.id,
        vehicle_id: params.id,
        event_type: eventType,
        title,
        mileage: mileage ? Number(mileage) : null,
        technician_id: auth.user?.id,
        status: "en_cours",
        client_uuid: crypto.randomUUID()
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (mileage) {
      await supabase.from("vehicles").update({ mileage: Number(mileage) }).eq("id", params.id);
    }

    router.push(`/events/${event.id}`);
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-semibold mb-6">Nouvel événement</h1>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="type">Type</label>
            <select id="type" className="input" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="title">Titre</label>
            <input id="title" required className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="mileage">Kilométrage actuel</label>
            <input id="mileage" type="number" className="input" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">Démarrer l'inspection</button>
        </form>
      </main>
    </div>
  );
}
