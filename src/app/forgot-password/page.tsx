"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import React from "react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (resetError) {
        setError(resetError.message);
        return;
    }
    setSent(true);
};

return React.createElement(
    "div",
    { className: "min-h-screen flex items-center justify-center px-4" },
    React.createElement(
        "div",
        { className: "card w-full max-w-sm space-y-4" },
        React.createElement(
            "div",
            { className: "text-center mb-2" },
            React.createElement("h1", { className: "font-display text-2xl font-semibold" }, "Mot de passe oublie")
            ),
        sent
        ? React.createElement(
            "p",
            { className: "text-sm text-center" },
            "Si un compte existe avec cet e-mail, un lien de reinitialisation vient d'etre envoye."
            )
        : React.createElement(
            "form",
            { onSubmit: handleSubmit, className: "space-y-4" },
            React.createElement(
                "div",
                null,
                React.createElement("label", { className: "label", htmlFor: "email" }, "Adresse e-mail"),
                React.createElement("input", {
                    id: "email",
                    type: "email",
                    value: email,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
                    required: true,
                    className: "input",
                    autoComplete: "email"
                })
                ),
            error ? React.createElement("p", { className: "text-danger text-sm" }, error) : null,
            React.createElement(
                "button",
                { type: "submit", disabled: loading, className: "btn btn-primary w-full" },
                loading ? "Envoi..." : "Envoyer le lien de reinitialisation"
                )
            )
        )
    );
}
