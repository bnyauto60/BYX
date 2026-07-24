"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import React from "react";

export default function ResetPasswordPage() {
        const [password, setPassword] = useState("");
        const [confirmPassword, setConfirmPassword] = useState("");
        const [error, setError] = useState("");
        const [loading, setLoading] = useState(false);
        const [checking, setChecking] = useState(true);
        const [ready, setReady] = useState(false);
        const router = useRouter();

useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const supabase = createClient();

          if (!code) {
                  setError("Lien invalide ou expire. Merci de redemander un nouveau lien.");
                  setChecking(false);
                  return;
          }

          supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }: { error: { message: string } | null }) => {
                  if (exchangeError) {
                          setError("Ce lien a expire ou a deja ete utilise. Merci de redemander un nouveau lien.");
                  } else {
                          setReady(true);
                  }
                  setChecking(false);
          });
}, []);

const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < 6) {
                setError("Le mot de passe doit contenir au moins 6 caracteres.");
                return;
        }
        if (password !== confirmPassword) {
                setError("Les mots de passe ne correspondent pas.");
                return;
        }

        setLoading(true);
        const supabase = createClient();
        const { error: updateError } = await supabase.auth.updateUser({ password: password });
        setLoading(false);

        if (updateError) {
                setError(updateError.message);
                return;
        }

        router.push("/dashboard");
};

if (checking) {
        return React.createElement(
                "div",
                { className: "min-h-screen flex items-center justify-center px-4" },
                React.createElement("p", null, "Verification du lien...")
                );
}

if (!ready) {
        return React.createElement(
                "div",
                { className: "min-h-screen flex items-center justify-center px-4" },
                React.createElement(
                        "div",
                        { className: "card w-full max-w-sm space-y-4 text-center" },
                        React.createElement("p", { className: "text-danger text-sm" }, error),
                        React.createElement(
                                "a",
                                { href: "/forgot-password", className: "btn btn-primary w-full" },
                                "Redemander un lien"
                                )
                        )
                );
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
                        React.createElement("h1", { className: "font-display text-2xl font-semibold" }, "Nouveau mot de passe")
                        ),
                React.createElement(
                        "div",
                        null,
                        React.createElement("label", { className: "label", htmlFor: "password" }, "Nouveau mot de passe"),
                        React.createElement("input", {
                                id: "password",
                                type: "password",
                                value: password,
                                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
                                required: true,
                                className: "input",
                                autoComplete: "new-password"
                        })
                        ),
                React.createElement(
                        "div",
                        null,
                        React.createElement("label", { className: "label", htmlFor: "confirmPassword" }, "Confirmer le mot de passe"),
                        React.createElement("input", {
                                id: "confirmPassword",
                                type: "password",
                                value: confirmPassword,
                                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value),
                                required: true,
                                className: "input",
                                autoComplete: "new-password"
                        })
                        ),
                error ? React.createElement("p", { className: "text-danger text-sm" }, error) : null,
                React.createElement(
                        "button",
                        { type: "submit", disabled: loading, className: "btn btn-primary w-full" },
                        loading ? "Enregistrement..." : "Enregistrer le mot de passe"
                        )
                )
        );
}
