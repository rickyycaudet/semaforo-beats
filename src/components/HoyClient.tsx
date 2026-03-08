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

function badge(color: OfferRow["color"]) {
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
  const [events, setEvents] = useState<EventWithOffers[]>([]);

  async function load() {
    setLoading(true);

    const { data: eventsData } = await supabase
      .from("daily_events")
      .select("*")
      .order("start_time", { ascending: true });

    const { data: offersData } = await supabase
      .from("daily_offers")
      .select("*");

    const now = new Date();

    const merged: EventWithOffers[] = (eventsData ?? [])
      .filter((e: any) => new Date(e.start_time) > now) // ocultar partidos empezados
      .map((event: any) => ({
        ...event,
        offers: (offersData ?? []).filter((o: any) => o.event_id === event.id),
      }));

    setEvents(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div>Cargando partidos…</div>;
  }

  if (events.length === 0) {
    return <div>No hay partidos disponibles.</div>;
  }

  const allOffers = events.flatMap((e) =>
    e.offers.map((o) => ({
      ...o,
      event: e,
    }))
  );

  const recommended = allOffers
    .filter((o) => o.color === "green")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* RECOMENDADAS */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>
          ⭐ Apuestas recomendadas de hoy
        </h2>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {recommended.map((offer) => (
            <div
              key={offer.id}
              style={{
                background: "white",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {badge(offer.color)} {offer.event.home_team} vs{" "}
                  {offer.event.away_team}
                </div>

                <div style={{ fontSize: 13, color: "#666" }}>
                  {offer.label} · cuota {offer.odds.toFixed(2)} · probabilidad{" "}
                  {(offer.probability * 100).toFixed(1)}%
                </div>
              </div>

              <button
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
                onClick={() =>
                  alert(
                    "En el siguiente paso conectaremos este botón para guardar la apuesta."
                  )
                }
              >
                Apostar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* RESTO DE PARTIDOS */}
      {events.map((event) => (
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

            <h3 style={{ fontSize: 20, fontWeight: 800 }}>
              {event.home_team} vs {event.away_team}
            </h3>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {event.offers.map((offer) => (
              <div
                key={offer.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <b>
                    {badge(offer.color)} {offer.label}
                  </b>

                  <div style={{ fontSize: 13, color: "#666" }}>
                    cuota {offer.odds.toFixed(2)} · probabilidad{" "}
                    {(offer.probability * 100).toFixed(1)}%
                  </div>
                </div>

                <button
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    alert(
                      "En el siguiente paso conectaremos este botón para guardar la apuesta."
                    )
                  }
                >
                  Apostar
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
