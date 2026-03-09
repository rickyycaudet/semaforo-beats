"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type BetRow = {
  id: string;
  stake: number;
  profit: number;
  status: "pending" | "won" | "lost" | "void";
  color: "green" | "orange" | "red";
  market_key: string | null;
};

function porcentaje(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function marketLabel(marketKey: string | null) {
  if (!marketKey) return "Sin mercado";
  if (marketKey === "h2h") return "Ganador del partido";
  if (marketKey === "totals") return "Más / menos goles";
  if (marketKey === "btts") return "Ambos marcan";
  return marketKey;
}

export default function EstadisticasClient() {
  const [loading, setLoading] = useState(true);
  const [bets, setBets] = useState<BetRow[]>([]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("bets")
      .select("id, stake, profit, status, color, market_key");

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

    const porMercadoMap: Record<
      string,
      {
        mercado: string;
        total: number;
        resueltas: number;
        ganadas: number;
        perdidas: number;
        dineroApostado: number;
        ganancia: number;
        acierto: number;
        rentabilidad: number;
      }
    > = {};

    const porColorMap: Record<
      string,
      {
        color: string;
        total: number;
        resueltas: number;
        ganadas: number;
        perdidas: number;
        dineroApostado: number;
        ganancia: number;
        acierto: number;
        rentabilidad: number;
      }
    > = {};

    for (const bet of bets) {
      const mercado = marketLabel(bet.market_key);
      if (!porMercadoMap[mercado]) {
        porMercadoMap[mercado] = {
          mercado,
          total: 0,
          resueltas: 0,
          ganadas: 0,
          perdidas: 0,
          dineroApostado: 0,
          ganancia: 0,
          acierto: 0,
          rentabilidad: 0,
        };
      }

      porMercadoMap[mercado].total += 1;

      if (bet.status === "won" || bet.status === "lost") {
        porMercadoMap[mercado].resueltas += 1;
        porMercadoMap[mercado].dineroApostado += Number(bet.stake ?? 0);
        porMercadoMap[mercado].ganancia += Number(bet.profit ?? 0);

        if (bet.status === "won") porMercadoMap[mercado].ganadas += 1;
        if (bet.status === "lost") porMercadoMap[mercado].perdidas += 1;
      }

      const color = bet.color;
      if (!porColorMap[color]) {
        porColorMap[color] = {
          color,
          total: 0,
          resueltas: 0,
          ganadas: 0,
          perdidas: 0,
          dineroApostado: 0,
          ganancia: 0,
          acierto: 0,
          rentabilidad: 0,
        };
      }

      porColorMap[color].total += 1;

      if (bet.status === "won" || bet.status === "lost") {
        porColorMap[color].resueltas += 1;
        porColorMap[color].dineroApostado += Number(bet.stake ?? 0);
        porColorMap[color].ganancia += Number(bet.profit ?? 0);

        if (bet.status === "won") porColorMap[color].ganadas += 1;
        if (bet.status === "lost") porColorMap[color].perdidas += 1;
      }
    }

    const porMercado = Object.values(porMercadoMap)
      .map((m) => ({
        ...m,
        acierto: m.resueltas > 0 ? m.ganadas / m.resueltas : 0,
        rentabilidad: m.dineroApostado > 0 ? m.ganancia / m.dineroApostado : 0,
      }))
      .sort((a, b) => b.ganancia - a.ganancia);

    const porColor = Object.values(porColorMap)
      .map((c) => ({
        ...c,
        acierto: c.resueltas > 0 ? c.ganadas / c.resueltas : 0,
        rentabilidad: c.dineroApostado > 0 ? c.ganancia / c.dineroApostado : 0,
      }))
      .sort((a, b) => b.ganancia - a.ganancia);

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
      porMercado,
      porColor,
    };
  }, [bets]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Card
          title="Ganancia / pérdida total"
          value={loading ? "…" : `${stats.gananciaTotal.toFixed(2)}€`}
          help="Lo que has ganado o perdido en apuestas ya resueltas."
        />
        <Card
          title="Apuestas resueltas"
          value={loading ? "…" : `${stats.resueltas}`}
          help="Apuestas que ya terminaron."
        />
        <Card
          title="Porcentaje de acierto"
          value={loading ? "…" : porcentaje(stats.porcentajeAcierto)}
          help="Cuántas apuestas aciertas de cada 100."
        />
        <Card
          title="Rentabilidad"
          value={loading ? "…" : porcentaje(stats.rentabilidad)}
          help="Qué porcentaje ganas o pierdes respecto a lo apostado."
        />
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Resumen general</h2>

        {loading ? (
          <div style={{ marginTop: 10 }}>Cargando…</div>
        ) : (
          <div style={{ marginTop: 12, color: "#333", lineHeight: 1.9 }}>
            <div><b>Total de apuestas:</b> {stats.totalApuestas}</div>
            <div><b>Apuestas pendientes:</b> {stats.pendientes}</div>
            <div><b>Apuestas resueltas:</b> {stats.resueltas}</div>
            <div><b>Apuestas ganadas:</b> {stats.ganadas}</div>
            <div><b>Apuestas perdidas:</b> {stats.perdidas}</div>
            <div><b>Dinero total apostado:</b> {stats.cantidadTotalApostada.toFixed(2)}€</div>
          </div>
        )}
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Histórico por mercado</h2>
        <p style={{ marginTop: 8, color: "#666" }}>
          Aquí ves qué tipo de apuesta te está funcionando mejor.
        </p>

        {loading ? (
          <div style={{ marginTop: 12 }}>Cargando…</div>
        ) : stats.porMercado.length === 0 ? (
          <div style={{ marginTop: 12, color: "#666" }}>
            Aún no hay suficientes datos por mercado.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                  <th style={{ padding: 10 }}>Mercado</th>
                  <th style={{ padding: 10 }}>Resueltas</th>
                  <th style={{ padding: 10 }}>Ganadas</th>
                  <th style={{ padding: 10 }}>Perdidas</th>
                  <th style={{ padding: 10 }}>Dinero apostado</th>
                  <th style={{ padding: 10 }}>Ganancia / pérdida</th>
                  <th style={{ padding: 10 }}>Acierto</th>
                  <th style={{ padding: 10 }}>Rentabilidad</th>
                </tr>
              </thead>
              <tbody>
                {stats.porMercado.map((row) => (
                  <tr key={row.mercado} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>{row.mercado}</td>
                    <td style={{ padding: 10 }}>{row.resueltas}</td>
                    <td style={{ padding: 10 }}>{row.ganadas}</td>
                    <td style={{ padding: 10 }}>{row.perdidas}</td>
                    <td style={{ padding: 10 }}>{row.dineroApostado.toFixed(2)}€</td>
                    <td style={{ padding: 10 }}>{row.ganancia.toFixed(2)}€</td>
                    <td style={{ padding: 10 }}>{porcentaje(row.acierto)}</td>
                    <td style={{ padding: 10 }}>{porcentaje(row.rentabilidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Histórico por color</h2>
        <p style={{ marginTop: 8, color: "#666" }}>
          Así ves si tus verdes, naranjas o rojas están funcionando de verdad.
        </p>

        {loading ? (
          <div style={{ marginTop: 12 }}>Cargando…</div>
        ) : stats.porColor.length === 0 ? (
          <div style={{ marginTop: 12, color: "#666" }}>
            Aún no hay suficientes datos por color.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                  <th style={{ padding: 10 }}>Color</th>
                  <th style={{ padding: 10 }}>Resueltas</th>
                  <th style={{ padding: 10 }}>Ganadas</th>
                  <th style={{ padding: 10 }}>Perdidas</th>
                  <th style={{ padding: 10 }}>Dinero apostado</th>
                  <th style={{ padding: 10 }}>Ganancia / pérdida</th>
                  <th style={{ padding: 10 }}>Acierto</th>
                  <th style={{ padding: 10 }}>Rentabilidad</th>
                </tr>
              </thead>
              <tbody>
                {stats.porColor.map((row) => (
                  <tr key={row.color} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>
                      {row.color === "green" ? "🟢 Verde" : row.color === "orange" ? "🟠 Naranja" : "🔴 Rojo"}
                    </td>
                    <td style={{ padding: 10 }}>{row.resueltas}</td>
                    <td style={{ padding: 10 }}>{row.ganadas}</td>
                    <td style={{ padding: 10 }}>{row.perdidas}</td>
                    <td style={{ padding: 10 }}>{row.dineroApostado.toFixed(2)}€</td>
                    <td style={{ padding: 10 }}>{row.ganancia.toFixed(2)}€</td>
                    <td style={{ padding: 10 }}>{porcentaje(row.acierto)}</td>
                    <td style={{ padding: 10 }}>{porcentaje(row.rentabilidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{help}</div>
    </div>
  );
}
