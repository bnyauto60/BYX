"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavBar } from "@/components/NavBar";

/**
 * Diagnostic rapide sans fiche véhicule préalable (amélioration demandée —
 * "un véhicule arrive entre deux rendez-vous, juste pour un passage valise,
 * je le mets tout de suite là-dedans"). Crée l'événement immédiatement et
 * redirige vers l'inspection ; le véhicule pourra être relié après coup
 * depuis l'écran de l'événement.
 */
export default function NewDiagnosticPage() {
  const router = useRouter();

  useEffect(() => {
    async function create() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from("users_profile")
        .select("workshop_id")
        .eq("id", auth.user?.id)
        .single();

      const { data: event } = await supabase
        .from("technical_events")
        .insert({
          workshop_id: userProfile?.workshop_id,
          event_type: "diagnostic",
          title: "Diagnostic rapide",
          technician_id: auth.user?.id,
          status: "en_cours",
          client_uuid: crypto.randomUUID()
        })
        .select()
        .single();

      if (event) router.replace(`/events/${event.id}`);
    }
    create();
  }, [router]);

  return (
    <div>
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <p className="text-muted">Ouverture du diagnostic…</p>
      </main>
    </div>
  );
}
