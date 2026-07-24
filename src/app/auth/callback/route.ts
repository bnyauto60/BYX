import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Point d'entree des liens email Supabase (recuperation de mot de passe,
 * confirmation d'inscription, magic link). Echange le code PKCE contre une
 * session (cookies) puis redirige vers la page adaptee.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

if (code) {
  const supabase = createClient();
  await supabase.auth.exchangeCodeForSession(code);
}

const redirectPath = type === "recovery" ? "/reset-password" : "/dashboard";
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
