import React from "react";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

export const dynamic = "force-dynamic";

const AI_PROVIDER_LABELS: Record<string, string> = {
    auto: "Automatique (recommande selon la tache)",
    anthropic: "Claude (Anthropic)",
    openai: "ChatGPT (OpenAI)"
};

/**
 * Parametres minimaux du MVP : informations atelier, choix du fournisseur IA
 * par defaut, et gouvernance du referentiel de composants (validation des
 * propositions des mecaniciens - cahier des charges paragraphe 4.6 + amelioration demandee).
 */
export default async function SettingsPage() {
    const supabase = createClient();
    const { data: proposals } = await supabase
      .from("components")
      .select("*, family:component_families(label)")
      .eq("status", "proposition");

  let currentAiProvider = "auto";
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
          const { data: profile } = await supabase
            .from("users_profile")
            .select("workshop_id")
            .eq("id", auth.user.id)
            .single();
          if (profile?.workshop_id) {
                  const { data: workshop } = await supabase
                    .from("workshops")
                    .select("ai_provider")
                    .eq("id", profile.workshop_id)
                    .single();
                  if (workshop?.ai_provider) currentAiProvider = workshop.ai_provider;
          }
    }

  return React.createElement(
        "div",
        null,
        React.createElement(NavBar, null),
        React.createElement(
                "main",
          { className: "max-w-2xl mx-auto px-4 py-8 space-y-6" },
                React.createElement("h1", { className: "font-display text-2xl font-semibold" }, "Parametres"),
                React.createElement(
                          "section",
                  { className: "card" },
                          React.createElement("h2", { className: "font-display text-lg font-medium mb-2" }, "Atelier"),
                          React.createElement(
                                      "p",
                            { className: "text-sm text-muted" },
                                      `${process.env.NEXT_PUBLIC_WORKSHOP_NAME} - ${process.env.NEXT_PUBLIC_WORKSHOP_CITY}`
                                    )
                        ),
                React.createElement(
                          "section",
                  { className: "card" },
                          React.createElement("h2", { className: "font-display text-lg font-medium mb-2" }, "Intelligence artificielle"),
                          React.createElement(
                                      "p",
                            { className: "text-sm text-muted mb-3" },
                                      "Choisissez le fournisseur IA utilise par defaut pour la structuration des observations, l'aide au diagnostic, l'analyse video et le remplissage de fiche par photo. Un routage fin deja configure cote serveur pour une tache precise reste toujours prioritaire."
                                    ),
                          React.createElement(
                                      "form",
                            { action: "/api/settings/ai-provider", method: "post", className: "flex items-center gap-3" },
                                      React.createElement(
                                                    "select",
                                        { name: "ai_provider", defaultValue: currentAiProvider, className: "input" },
                                                    Object.entries(AI_PROVIDER_LABELS).map(([value, label]) =>
                                                                    React.createElement("option", { key: value, value }, label)
                                                                                                       )
                                                  ),
                                      React.createElement(
                                                    "button",
                                        { className: "btn btn-primary text-sm px-4 py-2", type: "submit" },
                                                    "Enregistrer"
                                                  )
                                    )
                        ),
                React.createElement(
                          "section",
                  { className: "card" },
                          React.createElement(
                                      "h2",
                            { className: "font-display text-lg font-medium mb-2" },
                                      "Composants proposes en attente de validation"
                                    ),
                          (proposals ?? []).length === 0
                            ? React.createElement("p", { className: "text-sm text-muted" }, "Aucune proposition en attente.")
                            : React.createElement(
                                            "ul",
                              { className: "divide-y divide-line" },
                                            proposals!.map((p: any) =>
                                                              React.createElement(
                                                                                  "li",
                                                                { key: p.id, className: "py-2 flex items-center justify-between" },
                                                                                  React.createElement(
                                                                                                        "span",
                                                                                                        null,
                                                                                                        `${p.label} `,
                                                                                                        React.createElement("span", { className: "text-muted text-sm" }, `(${p.family?.label})`)
                                                                                                      ),
                                                                                  React.createElement(ValidateButton, { id: p.id })
                                                                                )
                                                                         )
                                          )
                        )
              )
      );
}

function ValidateButton({ id }: { id: string }) {
    return React.createElement(
          "form",
      { action: `/api/components/${id}/validate`, method: "post" },
          React.createElement(
                  "button",
            { className: "btn btn-secondary text-xs px-3 py-2", type: "submit" },
                  "Valider"
                )
        );
}
