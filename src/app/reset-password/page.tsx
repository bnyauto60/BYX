"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import React from "react";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

  const handleSubmit = async (e) => {
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

  return React.createElement(
        "div",
    { style: { maxWidth: 400, margin: "80px auto", padding: 24 } },
        React.createElement("h1", null, "Nouveau mot de passe"),
        React.createElement(
                "form",
          { onSubmit: handleSubmit },
                React.createElement(
                          "div",
                  { style: { marginBottom: 16 } },
                          React.createElement("label", null, "Nouveau mot de passe"),
                          React.createElement("input", {
                                      type: "password",
                                      value: password,
                                      onChange: (e) => setPassword(e.target.value),
                                      required: true,
                                      style: { display: "block", width: "100%", padding: 8, marginTop: 4 }
                          })
                        ),
                React.createElement(
                          "div",
                  { style: { marginBottom: 16 } },
                          React.createElement("label", null, "Confirmer le mot de passe"),
                          React.createElement("input", {
                                      type: "password",
                                      value: confirmPassword,
                                      onChange: (e) => setConfirmPassword(e.target.value),
                                      required: true,
                                      style: { display: "block", width: "100%", padding: 8, marginTop: 4 }
                          })
                        ),
                error ? React.createElement("p", { style: { color: "red" } }, error) : null,
                React.createElement(
                          "button",
                  { type: "submit", disabled: loading, style: { padding: "8px 16px" } },
                          loading ? "Enregistrement..." : "Enregistrer le mot de passe"
                        )
              )
      );
}
