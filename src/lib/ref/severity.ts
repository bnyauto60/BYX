/**
 * Échelle de gravité/urgence (cahier des charges §5). Les deux échelles sont
 * indépendantes : une pièce peut être urgente sans être défectueuse (ex :
 * courroie de distribution proche de l'échéance), ou inversement une
 * dégradation ancienne peut être présente sans être urgente.
 */
export const SEVERITY_LEVELS = [
  { value: 0, code: "information", label: "Information", color: "muted" },
  { value: 1, code: "bon_etat", label: "Bon état", color: "safe" },
  { value: 2, code: "usure_normale", label: "Usure normale", color: "safe" },
  { value: 3, code: "a_surveiller", label: "À surveiller", color: "warn" },
  { value: 4, code: "intervention_conseillee", label: "Intervention conseillée", color: "warn" },
  { value: 5, code: "intervention_urgente", label: "Intervention urgente", color: "danger" },
  { value: 6, code: "danger", label: "Véhicule dangereux / immobilisation conseillée", color: "danger" }
] as const;

export function severityLabel(value: number): string {
  return SEVERITY_LEVELS.find((s) => s.value === value)?.label ?? `Niveau ${value}`;
}

export function severityColor(value: number): "muted" | "safe" | "warn" | "danger" {
  return (SEVERITY_LEVELS.find((s) => s.value === value)?.color as "muted" | "safe" | "warn" | "danger") ?? "muted";
}

/** Garde-fou sécurité : au-delà de ce seuil, une observation est TOUJOURS incluse
 * dans le rapport client, quelle que soit la préférence utilisateur. Reflète
 * la contrainte SQL chk_urgent_always_reported — dupliquée ici côté
 * application pour empêcher toute désactivation silencieuse dans l'UI. */
export const MANDATORY_CLIENT_REPORT_THRESHOLD = 5;

export function mustAppearInClientReport(severity: number, urgency: number): boolean {
  return Math.max(severity, urgency) >= MANDATORY_CLIENT_REPORT_THRESHOLD;
}
