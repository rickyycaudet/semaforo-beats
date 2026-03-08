"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type BetRow = {
  id: string;
  sport: string;
  event_label: string;
  pick_label: string;
  color: "green" | "orange" | "red";
  prob_snapshot: number;
  odds_taken: number;
  stake: number;
  stake_source: string;
  status: "pending" | "won" | "lost" | "void";
  profit: number;
  placed_at: string;
};

function colorEmoji(c: BetRow["color"]) {
  if (c === "green") return "🟢";
  if (c === "orange") return "🟠";
  return "🔴";
}

function estadoBonito(status: BetRow["status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "won") return "Ganada";
  if (status === "lost") return "Perdida";
  return "Anulada";
}

function deporteBonito(sport: string) {
  if (sport === "soccer") return "Fútbol";
  if (sport === "tennis") return "Tenis";
  return sport;
}

export default function MisApuestasClient() {
  const [loading, setLoading] = useState(true);
  const [bets, setBets] = useState<BetRow[]>([]);

  const [sport, setSport] = useState<"soccer" | "tennis">("soccer");
  const [eventLabel, setEventLabel] = useState("");
  const [pickLabel, setPickLabel] = useState("");
  const [color, setColor] = useState<"green" | "orange" | "red">("green");
  const [odds, setOdds] = useState<number>(1.8);
  const [prob, setProb] = useState<number>(0.6);
  const [stake, setStake] = useState<number>(10);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bets")
      .select(
        "id,sport,event_label,pick_label,color,prob_snapshot,odds_taken,stake,stake_source,status,profit,placed_at"
      )
      .order("placed_at", { ascending: false });

    if (error) {
      alert("Error cargando apuestas: " + error.message);
      setLoading(false);
      return;
    }

    setBets((data ?? []) as BetRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBet() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      alert("No hay sesión");
      return;
    }

    if (!eventLabel.trim() || !pickLabel.trim()) {
      alert("Rellena el partido y la apuesta");
      return;
    }

    const stakeNum = Number(stake);
    const oddsNum = Number(odds);
    const probNum = Number(prob);

    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      return alert("La cantidad apostada no es válida");
    }

    if (!Number.isFinite(oddsNum) || oddsNum <= 1) {
      return alert("La cuota no es válida (debe ser mayor que 1)");
    }

    if (!Number.isFinite(probNum) || probNum <= 0 || probNum >= 1) {
      return alert("La probabilidad debe estar entre 0 y 1");
    }

    const { data: bet, error: bErr } = await supabase
      .from("bets")
      .insert({
        user_id: user.id,
        sport,
        event_label: eventLabel.trim(),
        pick_label: pickLabel.trim(),
        color,
        prob_snapshot: probNum,
        odds_taken: oddsNum,
        stake: stakeNum,
        stake_source: "manual",
        status: "pending",
        profit: 0,
      })
      .select("id")
      .single();

    if (bErr) {
      return alert("Error creando la apuesta: " + bErr.message);
    }

    const { error: lErr } = await supabase.from("ledger").insert({
      user_id: user.id,
      bet_id: bet.id,
      type: "stake_lock",
      amount: -stakeNum,
    });

    if (lErr) {
      return alert("La apuesta se creó, pero hubo un error al descontar el saldo: " + lErr.message);
    }

    setEventLabel("");
    setPickLabel("");
    await load();
    alert("Apuesta añadida ✅");
  }

  async function settleBet(bet: BetRow, result: "won" | "lost") {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert("No hay sesión");

    if (bet.status !== "pending") {
      return alert("Esta apuesta ya está resuelta");
    }

    const stakeNum = Number(bet.stake);
    const oddsNum = Number(bet.odds_taken);

    const profit = result === "won" ? stakeNum * (oddsNum - 1) : -stakeNum;

    const { error: uErr } = await supabase
      .from("bets")
      .update({
        status: result,
        profit,
        settled_at: new Date().toISOString(),
      })
      .eq("id", bet.id);

    if (uErr) {
      return alert("Error actualizando la apuesta: " + uErr.message);
    }

    if (result === "won") {
      const payout = stakeNum * oddsNum;
      const { error: pErr } = await supabase.from("ledger").insert({
        user_id: user.id,
        bet_id: bet.id,
        type: "payout",
        amount: payout,
      });

      if (pErr) {
        return alert("La apuesta se marcó como ganada, pero falló el ingreso del premio: " + pErr.message);
      }
    }

    await load();
    alert("Apuesta resuelta ✅");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Añadir apuesta manual</h2>
        <p style={{ marginTop: 6, color: "#666", fontSize: 14 }}>
          Aquí puedes guardar cualquier apuesta que hayas hecho para llevar el control de tu dinero.
        </p>

        <div
          style={{ display: "grid", gap: 10, marginTop: 12, maxWidth: 640 }}
        >
          <label>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Deporte</div>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as any)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 10,
              }}
            >
              <option value="soccer">Fútbol</option>
              <option value="tennis">Tenis</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Partido o evento</div>
            <input
              value={eventLabel}
              onChange={(e) => setEventLabel(e.target.value)}
              placeholder="Barça vs Levante"
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 10,
              }}
            />
          </label>

          <label>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Tu apuesta</div>
            <input
              value={pickLabel}
              onChange={(e) => setPickLabel(e.target.value)}
              placeholder="Barça o Empate"
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 10,
              }}
            />
          </label>

          <label>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Nivel del semáforo</div>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value as any)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 10,
              }}
            >
              <option value="green">🟢 Verde</option>
              <option value="orange">🟠 Naranja</option>
              <option value="red">🔴 Rojo</option>
            </select>
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
            }}
          >
            <label>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Cuota</div>
              <input
                type="number"
                step="0.01"
                value={odds}
                onChange={(e) => setOdds(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                }}
              />
            </label>

            <label>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Probabilidad (0 a 1)</div>
              <input
                type="number"
                step="0.01"
                value={prob}
                onChange={(e) => setProb(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                }}
              />
            </label>

            <label>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Cantidad apostada (€)</div>
              <input
                type="number"
                step="0.01"
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                }}
              />
            </label>
          </div>

          <button
            onClick={addBet}
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#111",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Guardar apuesta
          </button>
        </div>
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Historial de apuestas</h2>

        {loading ? (
          <div style={{ marginTop: 10 }}>Cargando…</div>
        ) : bets.length === 0 ? (
          <div style={{ marginTop: 10, color: "#666" }}>
            Aún no tienes apuestas guardadas.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
            >
              <thead>
                <tr
                  style={{ textAlign: "left", borderBottom: "1px solid #eee" }}
                >
                  <th style={{ padding: 8 }}>Semáforo</th>
                  <th style={{ padding: 8 }}>Deporte</th>
                  <th style={{ padding: 8 }}>Partido</th>
                  <th style={{ padding: 8 }}>Apuesta</th>
                  <th style={{ padding: 8 }}>Cuota</th>
                  <th style={{ padding: 8 }}>Cantidad</th>
                  <th style={{ padding: 8 }}>Estado</th>
                  <th style={{ padding: 8 }}>Ganancia / pérdida</th>
                  <th style={{ padding: 8 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 8 }}>{colorEmoji(b.color)}</td>
                    <td style={{ padding: 8 }}>{deporteBonito(b.sport)}</td>
                    <td style={{ padding: 8 }}>{b.event_label}</td>
                    <td style={{ padding: 8 }}>{b.pick_label}</td>
                    <td style={{ padding: 8 }}>
                      {Number(b.odds_taken).toFixed(2)}
                    </td>
                    <td style={{ padding: 8 }}>
                      {Number(b.stake).toFixed(2)}€
                    </td>
                    <td style={{ padding: 8 }}>{estadoBonito(b.status)}</td>
                    <td style={{ padding: 8 }}>
                      {Number(b.profit).toFixed(2)}€
                    </td>
                    <td style={{ padding: 8 }}>
                      {b.status === "pending" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => settleBet(b, "won")}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            ✅ Ganada
                          </button>
                          <button
                            onClick={() => settleBet(b, "lost")}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            ❌ Perdida
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#666" }}>—</span>
                      )}
                    </td>
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
