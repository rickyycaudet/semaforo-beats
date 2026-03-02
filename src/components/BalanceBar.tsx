"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function BalanceBar() {
  const [loading, setLoading] = useState(true);
  const [bankrollInitial, setBankrollInitial] = useState<number>(0);
  const [ledgerSum, setLedgerSum] = useState<number>(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      // 1) leer settings
      const { data: settings, error: sErr } = await supabase
        .from("user_settings")
        .select("bankroll_initial")
        .single();

      if (!ignore) {
        if (sErr) {
          console.warn("settings error", sErr.message);
          setBankrollInitial(0);
        } else {
          setBankrollInitial(Number(settings?.bankroll_initial ?? 0));
        }
      }

      // 2) sumar ledger
      const { data: rows, error: lErr } = await supabase
        .from("ledger")
        .select("amount");

      if (!ignore) {
        if (lErr) {
          console.warn("ledger error", lErr.message);
          setLedgerSum(0);
        } else {
          const sum = (rows ?? []).reduce((acc, r: any) => acc + Number(r.amount ?? 0), 0);
          setLedgerSum(sum);
        }
        setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  const disponible = bankrollInitial + ledgerSum;
  const enJuego = 0; // lo calcularemos cuando tengamos bets
  const total = disponible + enJuego;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 12, minWidth: 160 }}>
        <div style={{ fontSize: 12, color: "#666" }}>Disponible</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>
          {loading ? "…" : `${disponible.toFixed(2)}€`}
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 12, minWidth: 160 }}>
        <div style={{ fontSize: 12, color: "#666" }}>En juego</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>
          {loading ? "…" : `${enJuego.toFixed(2)}€`}
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 12, minWidth: 160 }}>
        <div style={{ fontSize: 12, color: "#666" }}>Total</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>
          {loading ? "…" : `${total.toFixed(2)}€`}
        </div>
      </div>
    </div>
  );
}
