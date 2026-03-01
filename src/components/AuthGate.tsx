"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");

  useEffect(() => {
    let ignore = false;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!ignore) {
        setEmail(data.session?.user?.email ?? null);
        setLoading(false);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      ignore = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: formEmail,
      password: formPassword,
    });
    if (error) alert(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) return <div>Cargando…</div>;

  if (!email) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", background: "white", padding: 18, border: "1px solid #eee", borderRadius: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Entrar</h1>
        <p style={{ marginTop: 6, color: "#555" }}>Login con Supabase (email + password).</p>

        <form onSubmit={signIn} style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <div>
            <label style={{ fontSize: 13 }}>Email</label>
            <input
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10, marginTop: 4 }}
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 13 }}>Contraseña</label>
            <input
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10, marginTop: 4 }}
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
            />
          </div>

          <button style={{ padding: 10, borderRadius: 10, background: "#111", color: "white", fontWeight: 700 }}>
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#555" }}>
          Sesión: <span style={{ fontWeight: 700 }}>{email}</span>
        </div>
        <button onClick={signOut} style={{ fontSize: 13, textDecoration: "underline", background: "transparent", border: "none", cursor: "pointer" }}>
          Salir
        </button>
      </div>

      {children}
    </div>
  );
}
