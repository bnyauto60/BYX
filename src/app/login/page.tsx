"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import React from "react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) {
                setError("Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.");
                return;
        }
        router.push("/dashboard");
  }

  return React.createElement(
        "div",
    { className: "min-h-screen flex items-center justify-center px-4" },
        React.createElement(
                "form",
          { onSubmit: handleSubmit, className: "card w-full max-w-sm space-y-4" },
                React.createElement(
                          "div",
                  { className: "text-center mb-2" },
                          React.createElement("h1", { className: "font-display text-2xl font-semibold" }, "BYX"),
                          React.createElement("p", { className: "text-muted text-sm" }, "Carnet de santé technique — BNY Auto")
                        ),
                React.createElement(
                          "div",
                          null,
                          React.createElement("label", { className: "label", htmlFor: "email" }, "E-mail"),
                          React.createElement("input", {
                                      id: "email",
                                      type: "email",
                                      required: true,
                                      className: "input",
                                      value: email,
                                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
                                      autoComplete: "username"
                          })
                        ),
                React.createElement(
                          "div",
                          null,
                          React.createElement("label", { className: "label", htmlFor: "password" }, "Mot de passe"),
                          React.createElement("input", {
                                      id: "password",
                                      type: "password",
                                      required: true,
                                      className: "input",
                                      value: password,
                                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
                                      autoComplete: "current-password"
                          })
                        ),
                error ? React.createElement("p", { className: "text-danger text-sm" }, error) : null,
                React.createElement(
                          "button",
                  { type: "submit", disabled: loading, className: "btn btn-primary w-full" },
                          loading ? "Connexion…" : "Se connecter"
                        ),
                React.createElement(
                          "a",
                  { href: "/forgot-password", className: "text-sm text-center block underline" },
                          "Mot de passe oublié ?"
                        )
              )
      );
}
