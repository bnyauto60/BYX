"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { VoiceDictation } from "./VoiceDictation";
import { MediaCapture } from "./MediaCapture";
import { SEVERITY_LEVELS, mustAppearInClientReport } from "@/lib/ref/severity";
import type { StructuredObservation } from "@/lib/ai/types";
import type { Component } from "@/types";

/**
 * Flux : dictée/texte -> IA structure une proposition -> le mécanicien
 * corrige si besoin -> validation -> écriture en base + rattachement des
 * preuves déjà capturées. L'IA ne pose une question de clarification que si
 * needs_confirmation est vrai (cahier des charges §20).
 */
export function ObservationForm({
  eventId,
  vehicleId,
  components
}: {
  eventId: string;
  vehicleId: string | null;
  components: Component[];
}) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [proposal, setProposal] = useState<StructuredObservation | null>(null);
  const [componentId, setComponentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEvidence, setPendingEvidence] = useState<{ id: string; type: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function structure() {
    if (!rawText.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText, event_id: eventId })
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setProposal(data.structured);
    const match = components.find((c) => c.code === data.structured.component_code);
    if (match) setComponentId(match.id);
  }

  async function save() {
    if (!proposal || !componentId) { setError("Sélectionnez un composant avant d'enregistrer."); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();

    const forcedReport = mustAppearInClientReport(proposal.severity, proposal.urgency);

    const { data: observation, error: insertError } = await supabase
      .from("observations")
      .insert({
        event_id: eventId,
        component_id: componentId,
        title: proposal.title,
        description: proposal.description,
        state: proposal.state,
        severity: proposal.severity,
        urgency: proposal.urgency,
        confidence: proposal.confidence,
        wear_percent: proposal.wear_percent,
        remaining_percent: proposal.remaining_percent,
        recommendation: proposal.recommendation,
        technician_id: auth.user?.id,
        include_in_client_report: true,
        client_uuid: crypto.randomUUID()
      })
      .select()
      .single();

    if (insertError) { setLoading(false); setError(insertError.message); return; }

    // Rattache les preuves déjà capturées avant la structuration de l'observation
    if (pendingEvidence.length > 0) {
      await supabase.from("evidence").update({ observation_id: observation.id }).in(
        "id", pendingEvidence.map((e) => e.id)
      );
    }
    void forcedReport;

    // Recalcule l'état des composants et la santé générale — jamais saisi
    // manuellement, toujours dérivé des observations (cahier des charges §6-§7).
    if (vehicleId) {
      fetch(`/api/vehicles/${vehicleId}/recompute-health`, { method: "POST" }).catch(() => {});
    }

    setLoading(false);
    router.refresh();
    setRawText("");
    setProposal(null);
    setPendingEvidence([]);
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-display text-lg font-medium">Nouvelle observation</h3>

      <VoiceDictation onResult={(text) => setRawText((prev) => (prev ? prev + " " + text : text))} />

      <textarea
        className="input min-h-24"
        placeholder="Ou saisissez librement : ex. « Pneu arrière gauche craquelé, crevaison proche du flanc, réparation déconseillée »"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
      />

      <MediaCapture eventId={eventId} onUploaded={(ev) => setPendingEvidence((prev) => [...prev, ev])} />
      {pendingEvidence.length > 0 && (
        <p className="text-xs text-safe">{pendingEvidence.length} preuve(s) prête(s) à être rattachée(s) à cette observation.</p>
      )}

      <button type="button" className="btn btn-primary w-full" disabled={loading || !rawText.trim()} onClick={structure}>
        {loading ? "Analyse en cours…" : "Structurer avec l'IA"}
      </button>

      {error && <p className="text-danger text-sm">{error}</p>}

      {proposal && (
        <div className="border border-line rounded-md p-3 space-y-3 bg-panelAlt">
          <p className="text-xs text-muted uppercase tracking-wide">Proposition IA — à valider ou corriger</p>

          <div>
            <label className="label" htmlFor="component">Composant</label>
            <select id="component" className="input" value={componentId} onChange={(e) => setComponentId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {!componentId && proposal.component_label_if_unknown && (
              <p className="text-xs text-warn mt-1">
                Composant non reconnu ("{proposal.component_label_if_unknown}") — proposez-le à l'atelier responsable si besoin.
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="title">Titre</label>
            <input id="title" className="input" value={proposal.title} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} />
          </div>

          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" className="input" value={proposal.description} onChange={(e) => setProposal({ ...proposal, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="severity">Gravité</label>
              <select id="severity" className="input" value={proposal.severity} onChange={(e) => setProposal({ ...proposal, severity: Number(e.target.value) })}>
                {SEVERITY_LEVELS.map((s) => <option key={s.value} value={s.value}>{s.value} — {s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="urgency">Urgence</label>
              <select id="urgency" className="input" value={proposal.urgency} onChange={(e) => setProposal({ ...proposal, urgency: Number(e.target.value) })}>
                {SEVERITY_LEVELS.map((s) => <option key={s.value} value={s.value}>{s.value} — {s.label}</option>)}
              </select>
            </div>
          </div>

          {proposal.wear_percent !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="wear">Usure (%)</label>
                <input id="wear" type="number" className="input" value={proposal.wear_percent ?? ""} onChange={(e) => {
                  const wear = Number(e.target.value);
                  setProposal({ ...proposal, wear_percent: wear, remaining_percent: 100 - wear });
                }} />
              </div>
              <div>
                <label className="label" htmlFor="remaining">Restant (%)</label>
                <input id="remaining" type="number" className="input" value={proposal.remaining_percent ?? ""} readOnly />
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="recommendation">Recommandation</label>
            <input id="recommendation" className="input" value={proposal.recommendation ?? ""} onChange={(e) => setProposal({ ...proposal, recommendation: e.target.value })} />
          </div>

          {mustAppearInClientReport(proposal.severity, proposal.urgency) && (
            <p className="text-xs text-danger">⚠ Gravité/urgence élevée — cette observation apparaîtra obligatoirement dans le rapport client.</p>
          )}

          <button type="button" className="btn btn-primary w-full" disabled={loading} onClick={save}>
            Valider et enregistrer
          </button>
        </div>
      )}
    </div>
  );
}
