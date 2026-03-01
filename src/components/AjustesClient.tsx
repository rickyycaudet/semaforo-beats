"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Settings = {
  user_id: string;
  bankroll_initial: number;
  staking_mode: "manual" | "kelly";
  kelly_fraction: number;
  stake_min: number;
  stake_max: number;
  max_stake_pct: number;
};

export default function AjustesClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<Settings | null>(null);

  async function loadSettings() {
    setLoading(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    console.log("USER", user);
    alert("USER ID: " + (user?.id ?? "null"));
    if (userErr || !user) {
      setLoading(false);
      alert("INSERT ERROR: " + JSON.stringify(createErr, null, 2));
      return;
    }

    // Intentar leer settings (RLS ya limita a auth.uid)
    const { data, error } = await supabase
      .from("user_settings")
      .select("user_id, bankroll_initial, staking_mode, kelly_fraction, stake_min, stake_max, max_stake_pct")
      .single();

    // Si no existe fila, la creamos con defaults
    if (error) {
      const { data: created, error: createErr } = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          bankroll_initial: 0,
          staking_mode: "manual",
          kelly_fraction: 0.25,
          stake_min: 1,
          stake_max: 100,
          max_stake_pct: 0.02,
        })
        .select("user_id, bankroll_initial, staking_mode, kelly_fraction, stake_min, stake_max, max_stake_pct")
        .single();

      if (createErr) {
        setLoading(false);
        alert("Error creando settings: " + createErr.message);
        return;
      }

      setS(created as Settings);
      setLoading(false);
      return;
    }

    setS(data as Settings);
    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function save() {
    if (!s) return;

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setSaving(false);
      alert("No hay sesión.");
      return;
    }

    const payload = {
      user_id: user.id,
      bankroll_initial: Number(s.bankroll_initial) || 0,
      staking_mode: s.staking_mode,
      kelly_fraction: Number(s.kelly_fraction) || 0,
      stake_min: Number(s.stake_min) || 0,
      stake_max: Number(s.stake_max) || 0,
      max_stake_pct: Number(s.max_stake_pct) || 0,
    };

    const { error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id" });

    setSaving(false);

    if (error) {
      alert("Error guardando: " + error.message);
      return;
    }

    alert("Ajustes guardados ✅");
  }

  if (loading) return <div>Cargando ajustes…</div>;
  if (!s) return <div>No se pudieron cargar los ajustes.</div>;

  return (
    <div style={{ maxWidth: 520, background: "white", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Bankroll y staking</h2>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Bankroll inicial (€)</div>
          <input
            type="number"
            value={s.bankroll_initial}
            onChange={(e) => setS({ ...s, bankroll_initial: Number(e.target.value) })}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          />
        </label>

        <label>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Modo de staking</div>
          <select
            value={s.staking_mode}
            onChange={(e) => setS({ ...s, staking_mode: e.target.value as "manual" | "kelly" })}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          >
            <option value="manual">Manual</option>
            <option value="kelly">Kelly fraccional</option>
          </select>
        </label>

        <label>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Fracción Kelly (ej: 0.25)</div>
          <input
            type="number"
            step="0.01"
            value={s.kelly_fraction}
            onChange={(e) => setS({ ...s, kelly_fraction: Number(e.target.value) })}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Stake mínimo (€)</div>
            <input
              type="number"
              value={s.stake_min}
              onChange={(e) => setS({ ...s, stake_min: Number(e.target.value) })}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
            />
          </label>

          <label>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Stake máximo (€)</div>
            <input
              type="number"
              value={s.stake_max}
              onChange={(e) => setS({ ...s, stake_max: Number(e.target.value) })}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
            />
          </label>
        </div>

        <label>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Máx % bankroll por apuesta (ej: 0.02 = 2%)</div>
          <input
            type="number"
            step="0.001"
            value={s.max_stake_pct}
            onChange={(e) => setS({ ...s, max_stake_pct: Number(e.target.value) })}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          />
        </label>

        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: 10,
            borderRadius: 10,
            background: "#111",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar ajustes"}
        </button>
      </div>
    </div>
  );
}
