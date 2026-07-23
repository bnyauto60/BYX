import { createBrowserClient } from "@supabase/ssr";

/**
 * NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY sont souvent collées manuellement dans
 * les variables d'environnement (Vercel) et embarquent parfois un espace ou
 * un retour à la ligne invisible. Un espace de fin dans l'URL suffit à
 * provoquer l'erreur Supabase "Invalid path specified in request URL" sur
 * toute requête (create/update). On nettoie systématiquement les deux
 * valeurs avant de construire le client, en amont de tout le reste du code.
 */
function cleanEnv(value: string | undefined, name: string): string {
      const cleaned = (value ?? "").trim().replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "");
  if (!cleaned) {
    throw new Error(`Variable d'environnement manquante ou vide : ${name}`);
  }
  return cleaned;
}

export function createClient() {
  return createBrowserClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
