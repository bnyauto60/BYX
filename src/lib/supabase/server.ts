import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Voir lib/supabase/client.ts::cleanEnv — même nettoyage défensif côté serveur. */
function cleanEnv(value: string | undefined, name: string): string {
  const cleaned = (value ?? "").trim().replace(/\/+$/, "");
  if (!cleaned) {
    throw new Error(`Variable d'environnement manquante ou vide : ${name}`);
  }
  return cleaned;
}

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: "", ...options });
        }
      }
    }
  );
}

/** Client privilégié (service role) — usage strict côté serveur pour tâches
 * système (génération de rapport, analyse IA asynchrone). Ne jamais exposer
 * au client. */
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY")
  );
}
