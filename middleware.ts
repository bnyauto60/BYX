import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Même logique de nettoyage que src/lib/supabase/client.ts et server.ts :
 * on retire un éventuel suffixe /rest/v1 (ou un espace/slash final) laissé par
 * erreur dans NEXT_PUBLIC_SUPABASE_URL, sinon les appels d'authentification
 * du middleware (auth.getUser()) échouent silencieusement.
 */
function cleanEnv(value: string | undefined, name: string): string {
        const cleaned = (value ?? "").trim().replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "");
        if (!cleaned) {
                  throw new Error(`Variable d'environnement manquante ou vide : ${name}`);
        }
        return cleaned;
}

const PUBLIC_PREFIXES = ["/login", "/api", "/auth", "/reset-password", "/forgot-password"];

export async function middleware(request: NextRequest) {
        let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
            cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
            cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        {
                    cookies: {
                                  get(name: string) {
                                                  return request.cookies.get(name)?.value;
                                  },
                                  set(name: string, value: string, options) {
                                                  response.cookies.set({ name, value, ...options });
                                  },
                                  remove(name: string, options) {
                                                  response.cookies.set({ name, value: "", ...options });
                                  }
                    }
        }
          );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
        const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && !isPublic) {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
        matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
