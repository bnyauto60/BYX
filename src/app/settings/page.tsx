import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

export const dynamic = "force-dynamic";

/**
 * Paramètres minimaux du MVP : informations atelier et gouvernance du
 * référentiel de composants (validation des propositions des mécaniciens —
 * cahier des charges §4.6 + amélioration demandée).
 */
export default async function SettingsPage() {
  const supabase = createClient();
  const { data: proposals } = await supabase
    .from("components")
    .select("*, family:component_families(label)")
    .eq("status", "proposition");

  return (
    <div>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-display text-2xl font-semibold">Paramètres</h1>

        <section className="card">
          <h2 className="font-display text-lg font-medium mb-2">Atelier</h2>
          <p className="text-sm text-muted">{process.env.NEXT_PUBLIC_WORKSHOP_NAME} — {process.env.NEXT_PUBLIC_WORKSHOP_CITY}</p>
        </section>

        <section className="card">
          <h2 className="font-display text-lg font-medium mb-2">Composants proposés en attente de validation</h2>
          {(proposals ?? []).length === 0 ? (
            <p className="text-sm text-muted">Aucune proposition en attente.</p>
          ) : (
            <ul className="divide-y divide-line">
              {proposals!.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between">
                  <span>{p.label} <span className="text-muted text-sm">({p.family?.label})</span></span>
                  <ValidateButton id={p.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function ValidateButton({ id }: { id: string }) {
  return (
    <form action={`/api/components/${id}/validate`} method="post">
      <button className="btn btn-secondary text-xs px-3 py-2" type="submit">Valider</button>
    </form>
  );
}
