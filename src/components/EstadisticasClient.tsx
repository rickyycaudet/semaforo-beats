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

function porcentaje(n: number) {
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
    const resueltas = bets.filter((b) => b.status === "won" || b.status === "lost");
    const ganadas = resueltas.filter((b) => b.status === "won");
    const perdidas = resueltas.filter((b) => b.status === "lost");

    const gananciaTotal = resueltas.reduce((acc, b) => acc + Number(b.profit ?? 0), 0);
    const cantidadTotalApostada = resueltas.reduce((acc, b) => acc + Number(b.stake ?? 0), 0);

    const porcentajeAcierto = resueltas.length > 0 ? ganadas.length / resueltas.length : 0;
    const rentabilidad = cantidadTotalApostada > 0 ? gananciaTotal / cantidadTotalApostada : 0;

    return {
      totalApuestas: bets.length,
      pendientes: bets.filter((b) => b.status === "pending").length,
      resueltas: resueltas.length,
      ganadas: ganadas.length,
      perdidas: perdidas.length,
      gananciaTotal,
      cantidadTotalApostada,
      porcentajeAcierto,
      rentabilidad,
    };
  }, [bets]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Card
          title="Ganancia / pérdida total"
          value={loading ? "…" : `${stats.gananciaTotal.toFixed(2)}€`}
          help="Lo que has ganado o perdido en total en apuestas ya resueltas."
        />
        <Card
          title="Apuestas resueltas"
          value={loading ? "…" : `${stats.resueltas}`}
          help="Apuestas que ya han terminado y ya sabes si se ganaron o se perdieron."
        />
        <Card
          title="Porcentaje de acierto"
          value={loading ? "…" : porcentaje(stats.porcentajeAcierto)}
          help="De cada 100 apuestas resueltas, cuántas aciertas."
        />
        <Card
          title="Rentabilidad"
          value={loading ? "…" : porcentaje(stats.rentabilidad)}
          help="Qué porcentaje has ganado o perdido respecto al dinero apostado."
        />
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Resumen sencillo</h2>

        {loading ? (
          <div style={{ marginTop: 10 }}>Cargando…</div>
        ) : (
          <div style={{ marginTop: 10, color: "#333", lineHeight: 1.9 }}>
            <div>
              <b>Total de apuestas:</b> {stats.totalApuestas}
            </div>
            <div>
              <b>Apuestas pendientes:</b> {stats.pendientes}
            </div>
            <div>
              <b>Apuestas resueltas:</b> {stats.resueltas}
            </div>
            <div>
              <b>Apuestas ganadas:</b> {stats.ganadas}
            </div>
            <div>
              <b>Apuestas perdidas:</b> {stats.perdidas}
            </div>
            <div>
              <b>Dinero total apostado:</b> {stats.cantidadTotalApostada.toFixed(2)}€
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  help,
}: {
  title: string;
  value: string;
  help: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{help}</div>
    </div>
  );
}
