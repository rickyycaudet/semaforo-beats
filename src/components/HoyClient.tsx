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
  provider_event_id?: string | null;
  provider_sport_key?: string | null;
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

type RecommendedOffer = OfferRow & {
  event: EventWithOffers;
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

function sportLabel(sport: string) {
  if (sport === "soccer") return "Fútbol";
  if (sport === "tennis") return "Tenis";
  return sport;
}

export default function HoyClient() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithOffers[]>([]);

  async function load() {
    setLoading(true);

    const { data: eventsData, error: eventsError } = await supabase
      .from("daily_events")
      .select("*")
      .order("start_time", { ascending: true });

    if (eventsError) {
      alert("Error cargando partidos: " + eventsError.message);
      setLoading(false);
      return;
    }

    const { data: offersData, error: offersError } = await supabase
      .from("daily_offers")
      .select("*");

    if (offersError) {
      alert("Error cargando opciones: " + offersError.message);
      setLoading(false);
      return;
    }

    const now = new Date();

    const merged: EventWithOffers[] = (eventsData ?? [])
      .filter((e: any) => new Date(e.start_time) > now)
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

  async function apostar(event: EventWithOffers, offer: OfferRow) {
    const amountText = prompt(
      `¿Cuánto quieres apostar en:\n\n${event.home_team} vs ${event.away_team}\n${offer.label}\nCuota ${offer.odds.toFixed(2)}`
    );

    if (amountText === null) return;

    const amount = Number(amountText.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("La cantidad apostada no es válida.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      alert("No hay sesión iniciada.");
      return;
    }

    const colorToSave =
      offer.color === "extra" ? "orange" : offer.color;

    // 1) Crear apuesta
    const { data: bet, error: betError } = await supabase
      .from("bets")
      .insert({
        user_id: user.id,
        sport: event.sport,
        event_label: `${event.home_team} vs ${event.away_team}`,
        pick_label: offer.label,
        color: colorToSave,
        prob_snapshot: Number(offer.probability),
        odds_taken: Number(offer.odds),
        stake: amount,
        stake_source: "manual",
        status: "pending",
        profit: 0,

        provider_event_id: event.provider_event_id ?? null,
        provider_sport_key: event.provider_sport_key ?? null,
        market_key: offer.market_key,
        selection_name: offer.label,
      })
      .select("id")
      .single();

    if (betError) {
      alert("Error guardando la apuesta: " + betError.message);
      return;
    }

    // 2) Descontar saldo disponible
    const { error: ledgerError } = await supabase.from("ledger").insert({
      user_id: user.id,
      bet_id: bet.id,
      type: "stake_lock",
      amount: -amount,
    });

    if (ledgerError) {
      alert(
        "La apuesta se guardó, pero hubo un error al descontar el saldo: " +
          ledgerError.message
      );
      return;
    }

    alert("Apuesta guardada ✅");
    window.location.reload();
  }

  if (loading) {
    return <div>Cargando partidos…</div>;
  }

  if (events.length === 0) {
    return <div>No hay partidos disponibles.</div>;
  }

  const allOffers: RecommendedOffer[] = events.flatMap((e) =>
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
        <p style={{ marginTop: 6, color: "#666", fontSize: 14 }}>
          Aquí tienes las opciones más interesantes del día según el sistema.
        </p>

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
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {badge(offer.color)} {offer.event.home_team} vs{" "}
                  {offer.event.away_team}
                </div>

                <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                  {offer.label} · cuota {offer.odds.toFixed(2)} · probabilidad{" "}
                  {(offer.probability * 100).toFixed(1)}%
                </div>

                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  {sportLabel(offer.event.sport)} · {offer.event.league} ·{" "}
                  {formatDate(offer.event.start_time)}
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
                onClick={() => apostar(offer.event, offer)}
              >
                Apostar
              </button>
            </div>
          ))}
        </div>
      </div>

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
                    padding: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <b>
                      {badge(offer.color)} {offer.label}
                    </b>

                    <div
                      style={{ fontSize: 13, color: "#666", marginTop: 4 }}
                    >
                      Cuota {offer.odds.toFixed(2)} · Probabilidad estimada{" "}
                      {(offer.probability * 100).toFixed(1)}%
                      {offer.bookmaker ? ` · Casa ${offer.bookmaker}` : ""}
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
                    onClick={() => apostar(event, offer)}
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
