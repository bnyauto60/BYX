"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createElement as h } from "react";

/**
 * Bouton de validation definitive du rapport (mode "tour du vehicule en
 * continu"). Une confirmation explicite est demandee avant de verrouiller
 * l'evenement, car l'action ne peut pas etre annulee depuis cette page.
 */
export function FinalizeReportButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

async function finalize() {
  const confirmed = window.confirm(
    "Valider definitivement ce rapport ? Vous ne pourrez plus ajouter d'observations sur cet evenement ensuite."
    );
  if (!confirmed) return;
  setLoading(true);
  setError(null);
  const res = await fetch(`/api/events/${eventId}/finalize`, { method: "POST" });
  const data = await res.json();
  setLoading(false);
  if (data.error) { setError(data.error); return; }
  router.refresh();
}

return h("div", null,
         h("button", {
           type: "button",
           className: "btn bg-safe text-white",
           disabled: loading,
           onClick: finalize
         }, loading ? "Validation…" : "✓ Valider le rapport"),
         error && h("p", { className: "text-danger text-sm mt-1" }, error)
         );
}
