"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type BetRow = {
  id: string;
  stake: number;
  profit: number;
  status: "pending" | "won" | "lost" | "void";
  color: "green" | "orange" | "red";
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function EstadisticasClient() {
  const [loading, setLoading] = useState(true);
  const [bets, setBets] = useState<BetRow[]>([]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bets")
      .select("id, stake, profit, status, color");

    if (error) {
      alert("Error cargando estadísticas: " + error.message);
      setLoading(false);
      return;
    }

    setBets((data ?? []) as BetRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
    const wins = settled.filter((b) => b.status === "won");
    const losses = settled.filter((b) => b.status === "lost");

    const profitTotal = settled.reduce((acc, b) => acc + Number(b.profit ?? 0), 0);
    const stakeTotal = settled.reduce((acc, b) => acc + Number(b.stake ?? 0), 0);

    const winrate = settled.length > 0 ? wins.length / settled.length : 0;
    const roi = stakeTotal > 0 ? profitTotal / stakeTotal : 0;

    return {
      totalBets: bets.length,
      pending: bets.filter((b) => b.status === "pending").length,
      settled: settled.length,
      wins: wins.length,
      losses: losses.length,
      profitTotal,
      stakeTotal,
      winrate,
      roi,
    };
  }, [bets]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Card title="Profit total" value={loading ? "…" : `${stats.profitTotal.toFixed(2)}€`} />
        <Card title="Apuestas (liq.)" value={loading ? "…" : `${stats.settled}`} />
        <Card title="Winrate" value={loading ? "…" : pct(stats.winrate)} />
        <Card title="ROI" value={loading ? "…" : pct(stats.roi)} />
      </div>

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Resumen</h2>
        {loading ? (
          <div style={{ marginTop: 10 }}>Cargando…</div>
        ) : (
          <ul style={{ marginTop: 10, color: "#333", lineHeight: 1.8 }}>
            <li>Total apuestas: <b>{stats.totalBets}</b></li>
            <li>Pendientes: <b>{stats.pending}</b></li>
            <li>Liquidadas: <b>{stats.settled}</b></li>
            <li>Ganadas: <b>{stats.wins}</b></li>
            <li>Perdidas: <b>{stats.losses}</b></li>
            <li>Stake total (liq.): <b>{stats.stakeTotal.toFixed(2)}€</b></li>
          </ul>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 12, minWidth: 180 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  );
}
