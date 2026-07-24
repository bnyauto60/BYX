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
    { style: { maxWidth: 400, margin: "80px auto", padding: 24 } },
        React.createElement("h1", null, "Mot de passe oublié"),
        sent
          ? React.createElement(
                      "p",
                      null,
                      "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé."
                    )
          : React.createElement(
                      "form",
            { onSubmit: handleSubmit },
                      React.createElement(
                                    "div",
                        { style: { marginBottom: 16 } },
                                    React.createElement("label", null, "Adresse e-mail"),
                                    React.createElement("input", {
                                                    type: "email",
                                                    value: email,
                                                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
                                                    required: true,
                                                    style: { display: "block", width: "100%", padding: 8, marginTop: 4 }
                                    })
                                  ),
                      error ? React.createElement("p", { style: { color: "red" } }, error) : null,
                      React.createElement(
                                    "button",
                        { type: "submit", disabled: loading, style: { padding: "8px 16px" } },
                                    loading ? "Envoi..." : "Envoyer le lien de réinitialisation"
                                  )
                    )
      );
}
