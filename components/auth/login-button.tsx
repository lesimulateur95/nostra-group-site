"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError("La connexion Discord n'a pas pu démarrer. Vérifie la configuration Supabase.");
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={login} disabled={loading}>
        {loading ? "Connexion…" : "Se connecter avec Discord"}
      </button>
      {error ? <p className="error-note">{error}</p> : null}
    </>
  );
}
