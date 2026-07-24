import type { createClient } from "@/lib/supabase/server";

/**
 * Lit le fournisseur IA par défaut choisi par l'atelier de l'utilisateur
  * connecté, depuis l'écran Paramètres > Intelligence artificielle
   * (colonne workshops.ai_provider, voir supabase/migrations/0005_ai_provider_setting.sql).
    *
     * Renvoie undefined si l'utilisateur n'est pas authentifié, si son profil ou
      * son atelier est introuvable, ou si le réglage est sur "auto" : dans tous
       * ces cas, lib/ai/router.ts retombe sur AI_DEFAULT_PROVIDER / AI_TASK_ROUTING
        * (comportement historique, inchangé).
         *
          * Réutilise le client Supabase déjà créé par la route appelante plutôt que
           * d'en instancier un nouveau.
            */
            export async function getWorkshopAIProvider(
              supabase: ReturnType<typeof createClient>
              ): Promise<string | undefined> {
                const { data: auth } = await supabase.auth.getUser();
                  if (!auth?.user) return undefined;

                    const { data: profile } = await supabase
                        .from("users_profile")
                            .select("workshop_id")
                                .eq("id", auth.user.id)
                                    .single();
                                      if (!profile?.workshop_id) return undefined;

                                        const { data: workshop } = await supabase
                                            .from("workshops")
                                                .select("ai_provider")
                                                    .eq("id", profile.workshop_id)
                                                        .single();

                                                          if (!workshop?.ai_provider || workshop.ai_provider === "auto") return undefined;
                                                            return workshop.ai_provider;
                                                            }
                                                            
