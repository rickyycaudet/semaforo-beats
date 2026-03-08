"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type EventRow = {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
};

type OfferRow = {
  id: string;
  event_id: string;
  color: "green" | "orange" | "red" | "extra";
  market_key: string;
  label: string;
  odds: number;
  probability: number;
  bookmaker: string | null;
};

type EventWithOffers = EventRow & {
  offers: OfferRow[];
};

function colorBadge(color: OfferRow["color"]) {
  if (color === "green") return "🟢";
  if (color === "orange") return "🟠";
  if (color === "red") return "🔴";
  return "⚪";
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

export default function HoyClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventWithOffers[]>([]);

  async function load() {
    setLoading(true);

    const { data: events, error: eErr } = await supabase
      .from("daily_events")
      .select("id, sport, league, home_team, away_team, start_time")
      .order("start_time", { ascending: true });

    if (eErr) {
      alert("Error cargando partidos: " + eErr.message);
      setLoading(false);
      return;
    }

    const { data: offers, error: oErr } = await supabase
      .from("daily_offers")
      .select("id, event_id, color, market_key, label, odds, probability, bookmaker")
      .order("probability", { ascending: false });

    if (oErr) {
      alert("Error cargando opciones: " + oErr.message);
      setLoading(false);
      return;
    }

    const merged: EventWithOffers[] = (events ?? []).map((event: any) => ({
      ...event,
      offers: (offers ?? []).filter((o: any) => o.event_id === event.id),
    }));

    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div>Cargando partidos del día…</div>;
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
        }}
      >
        Aún no hay partidos guardados para mostrar.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {rows.map((event) => (
        <div
          key={event.id}
          style={{
            background: "white",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#666" }}>
              {event.league} · {formatDate(event.start_time)}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {event.home_team} vs {event.away_team}
            </h2>
          </div>

          {event.offers.length === 0 ? (
            <div style={{ color: "#666" }}>
              Este partido aún no tiene opciones cargadas.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {event.offers.map((offer) => (
                <div
                  key={offer.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {colorBadge(offer.color)} {offer.label}
                    </div>
                    <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      Cuota: {Number(offer.odds).toFixed(2)} · Probabilidad estimada:{" "}
                      {(Number(offer.probability) * 100).toFixed(1)}%
                      {offer.bookmaker ? ` · Casa: ${offer.bookmaker}` : ""}
                    </div>
                  </div>

                  <button
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() =>
                      alert("En el siguiente paso conectaremos este botón para guardar la apuesta.")
                    }
                  >
                    Apostar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
