"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ComboBet = {
  id: string;
  total_odds: number;
  stake: number;
  status: "pending" | "won" | "lost" | "void";
  profit: number;
  placed_at: string;
};

type ComboBetItem = {
  id: string;
  combo_bet_id: string;
  event_label: string;
  pick_label: string;
  odds: number;
  color: "green" | "orange" | "red" | "extra";
};

type ComboWithItems = ComboBet & {
  items: ComboBetItem[];
};

function colorBadge(color: ComboBetItem["color"]) {
  if (color === "green") return "🟢";
  if (color === "orange") return "🟠";
  if (color === "red") return "🔴";
  return "⚪";
}

function estadoBonito(status: ComboBet["status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "won") return "Ganada";
  if (status === "lost") return "Perdida";
  return "Anulada";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CombinadasClient() {
  const [loading, setLoading] = useState(true);
  const [comboBets, setComboBets] = useState<ComboWithItems[]>([]);

  async function load() {
    setLoading(true);

    const { data: combos, error: combosError } = await supabase
      .from("combo_bets")
      .select("id,total_odds,stake,status,profit,placed_at")
      .order("placed_at", { ascending: false });

    if (combosError) {
      alert("Error cargando combinadas: " + combosError.message);
      setLoading(false);
      return;
    }

    const { data: items, error: itemsError } = await supabase
      .from("combo_bet_items")
      .select("id,combo_bet_id,event_label,pick_label,odds,color");

    if (itemsError) {
      alert("Error cargando selecciones de combinadas: " + itemsError.message);
      setLoading(false);
      return;
    }

    const merged: ComboWithItems[] = (combos ?? []).map((combo: any) => ({
      ...combo,
      items: (items ?? []).filter((item: any) => item.combo_bet_id === combo.id),
    }));

    setComboBets(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const total = comboBets.length;
    const pending = comboBets.filter((c) => c.status === "pending").length;
    const settled = comboBets.filter((c) => c.status !== "pending").length;
    const profit = comboBets.reduce((acc, c) => acc + Number(c.profit ?? 0), 0);

    return { total, pending, settled, profit };
  }, [comboBets]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard
          title="Combinadas totales"
          value={String(summary.total)}
          help="Número total de combinadas guardadas."
        />
        <StatCard
          title="Pendientes"
          value={String(summary.pending)}
          help="Combinadas que aún no se han resuelto."
        />
        <StatCard
          title="Resueltas"
          value={String(summary.settled)}
          help="Combinadas ya terminadas."
        />
        <StatCard
          title="Ganancia / pérdida"
          value={`${summary.profit.toFixed(2)}€`}
          help="Resultado total de tus combinadas."
        />
      </div>

      {loading ? (
        <div
          style={{
            background: "white",
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 16,
          }}
        >
          Cargando combinadas...
        </div>
      ) : comboBets.length === 0 ? (
        <div
          style={{
            background: "white",
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 16,
          }}
        >
          Aún no tienes combinadas guardadas.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {comboBets.map((combo) => (
            <div
              key={combo.id}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 6px 18px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Guardada el {formatDate(combo.placed_at)}
                  </div>
                  <h3 style={{ margin: "6px 0 0 0", fontSize: 20, fontWeight: 900 }}>
                    Combinada
                  </h3>
                </div>

                <div
                  style={{
                    background:
                      combo.status === "won"
                        ? "#ecfdf5"
                        : combo.status === "lost"
                        ? "#fef2f2"
                        : "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontWeight: 800,
                  }}
                >
                  {estadoBonito(combo.status)}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <MiniCard title="Cuota total" value={Number(combo.total_odds).toFixed(2)} />
                <MiniCard title="Cantidad apostada" value={`${Number(combo.stake).toFixed(2)}€`} />
                <MiniCard title="Ganancia / pérdida" value={`${Number(combo.profit).toFixed(2)}€`} />
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  Selecciones incluidas
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {combo.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {colorBadge(item.color)} {item.pick_label}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                        {item.event_label}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                        Cuota: <b>{Number(item.odds).toFixed(2)}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
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
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 18px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{help}</div>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}
