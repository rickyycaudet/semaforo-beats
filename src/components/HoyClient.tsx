"use client";

import { useEffect, useMemo, useState } from "react";
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

function colorName(color: OfferRow["color"]) {
  if (color === "green") return "Verde";
  if (color === "orange") return "Naranja";
  if (color === "red") return "Rojo";
  return "Extra";
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

function getRecommendedPercent(color: OfferRow["color"]) {
  if (color === "green") return 0.04;   // 4%
  if (color === "orange") return 0.025; // 2.5%
  if (color === "red") return 0.015;    // 1.5%
  return 0.02;
}

export default function HoyClient() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithOffers[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [bankrollInitial, setBankrollInitial] = useState<number>(0);
  const [ledgerSum, setLedgerSum] = useState<number>(0);

  const [selectedEvent, setSelectedEvent] = useState<EventWithOffers | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<OfferRow | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");

  const availableBalance = useMemo(() => {
    return bankrollInitial + ledgerSum;
  }, [bankrollInitial, ledgerSum]);

  async function loadBalance() {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("bankroll_initial")
      .single();

    const { data: ledgerRows } = await supabase
      .from("ledger")
      .select("amount");

    const initial = Number(settings?.bankroll_initial ?? 0);
    const sum = (ledgerRows ?? []).reduce(
      (acc, row: any) => acc + Number(row.amount ?? 0),
      0
    );

    setBankrollInitial(initial);
    setLedgerSum(sum);
  }

  async function loadEvents() {
    const { data: eventsData, error: eventsError } = await supabase
      .from("daily_events")
      .select("*")
      .order("start_time", { ascending: true });

    if (eventsError) {
      alert("Error cargando partidos: " + eventsError.message);
      return;
    }

    const { data: offersData, error: offersError } = await supabase
      .from("daily_offers")
      .select("*");

    if (offersError) {
      alert("Error cargando opciones: " + offersError.message);
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

    if (merged.length > 0 && !expandedEventId) {
      setExpandedEventId(merged[0].id);
    }
  }

  async function settlePendingInBackground() {
    try {
      await fetch("/api/settle-bets", {
        method: "GET",
        cache: "no-store",
      });
    } catch (error) {
      console.warn("No se pudieron cerrar apuestas en segundo plano");
    }
  }

  async function loadAll() {
    setLoading(true);
    await settlePendingInBackground();
    await Promise.all([loadBalance(), loadEvents()]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openBetModal(event: EventWithOffers, offer: OfferRow) {
    setSelectedEvent(event);
    setSelectedOffer(offer);

    const pct = Math.min(getRecommendedPercent(offer.color), 0.1);
    const recommended = availableBalance * pct;
    setBetAmount(recommended > 0 ? recommended.toFixed(2) : "");
  }

  function closeBetModal() {
    setSelectedEvent(null);
    setSelectedOffer(null);
    setBetAmount("");
  }

  async function confirmBet() {
    if (!selectedEvent || !selectedOffer) return;

    const amount = Number(String(betAmount).replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("La cantidad apostada no es válida.");
      return;
    }

    const maxAllowed = availableBalance * 0.1;

    if (amount > maxAllowed) {
      alert(
        `No puedes apostar más del 10% de tu saldo.\nMáximo permitido ahora: ${maxAllowed.toFixed(2)}€`
      );
      return;
    }

    if (amount > availableBalance) {
      alert("No tienes suficiente saldo disponible.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      alert("No hay sesión iniciada.");
      return;
    }

    const colorToSave =
      selectedOffer.color === "extra" ? "orange" : selectedOffer.color;

    const { data: bet, error: betError } = await supabase
      .from("bets")
      .insert({
        user_id: user.id,
        sport: selectedEvent.sport,
        event_label: `${selectedEvent.home_team} vs ${selectedEvent.away_team}`,
        pick_label: selectedOffer.label,
        color: colorToSave,
        prob_snapshot: Number(selectedOffer.probability),
        odds_taken: Number(selectedOffer.odds),
        stake: amount,
        stake_source: "manual",
        status: "pending",
        profit: 0,
        provider_event_id: selectedEvent.provider_event_id ?? null,
        provider_sport_key: selectedEvent.provider_sport_key ?? null,
        market_key: selectedOffer.market_key,
        selection_name: selectedOffer.label,
      })
      .select("id")
      .single();

    if (betError) {
      alert("Error guardando la apuesta: " + betError.message);
      return;
    }

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
    closeBetModal();
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
    <>
      <div style={{ display: "grid", gap: 20 }}>
        <div
          style={{
            background: "linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%)",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 20,
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            ⭐ Apuestas recomendadas de hoy
          </h2>
          <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            Estas son las opciones que el sistema considera más interesantes ahora mismo.
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {recommended.map((offer) => (
              <div
                key={offer.id}
                style={{
                  background: "white",
                  border: "1px solid #eee",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {badge(offer.color)} {offer.event.home_team} vs {offer.event.away_team}
                  </div>

                  <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>
                    {offer.label}
                  </div>

                  <div style={{ fontSize: 13, color: "#777", marginTop: 6 }}>
                    Cuota {offer.odds.toFixed(2)} · Probabilidad estimada{" "}
                    {(offer.probability * 100).toFixed(1)}%
                  </div>

                  <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                    {sportLabel(offer.event.sport)} · {offer.event.league} ·{" "}
                    {formatDate(offer.event.start_time)}
                  </div>
                </div>

                <button
                  style={buttonStylePrimary}
                  onClick={() => openBetModal(offer.event, offer)}
                >
                  Apostar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {events.map((event) => {
            const isOpen = expandedEventId === event.id;

            return (
              <div
                key={event.id}
                style={{
                  background: "white",
                  border: "1px solid #eee",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.03)",
                }}
              >
                <button
                  onClick={() =>
                    setExpandedEventId(isOpen ? null : event.id)
                  }
                  style={{
                    width: "100%",
                    background: "white",
                    border: "none",
                    padding: 16,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {event.league} · {formatDate(event.start_time)}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>
                      {event.home_team} vs {event.away_team}
                    </div>
                  </div>

                  <div style={{ fontSize: 22 }}>{isOpen ? "−" : "+"}</div>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px 16px", display: "grid", gap: 10 }}>
                    {event.offers.length === 0 ? (
                      <div style={{ color: "#666" }}>
                        Este partido aún no tiene opciones cargadas.
                      </div>
                    ) : (
                      event.offers.map((offer) => (
                        <div
                          key={offer.id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 12,
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            background:
                              offer.color === "green"
                                ? "#f0fdf4"
                                : offer.color === "orange"
                                ? "#fff7ed"
                                : offer.color === "red"
                                ? "#fef2f2"
                                : "#fafafa",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800 }}>
                              {badge(offer.color)} {offer.label}
                            </div>

                            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                              Nivel: {colorName(offer.color)} · Cuota {offer.odds.toFixed(2)} ·
                              Probabilidad {(offer.probability * 100).toFixed(1)}%
                            </div>

                            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                              {offer.bookmaker ? `Casa ${offer.bookmaker}` : "Casa no disponible"}
                            </div>
                          </div>

                          <button
                            style={buttonStyleSecondary}
                            onClick={() => openBetModal(event, offer)}
                          >
                            Apostar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && selectedOffer && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {selectedEvent.league} · {formatDate(selectedEvent.start_time)}
                </div>
                <h3 style={{ margin: "6px 0 0 0", fontSize: 22, fontWeight: 900 }}>
                  {selectedEvent.home_team} vs {selectedEvent.away_team}
                </h3>
              </div>

              <button onClick={closeBetModal} style={closeButtonStyle}>
                ✕
              </button>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {badge(selectedOffer.color)} {selectedOffer.label}
              </div>

              <div style={{ fontSize: 14, color: "#555", marginTop: 8 }}>
                Cuota: <b>{selectedOffer.odds.toFixed(2)}</b>
              </div>

              <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>
                Probabilidad estimada:{" "}
                <b>{(selectedOffer.probability * 100).toFixed(1)}%</b>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Recomendación del sistema
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  background: "#fff",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div>
                  Saldo disponible: <b>{availableBalance.toFixed(2)}€</b>
                </div>
                <div>
                  Porcentaje recomendado:{" "}
                  <b>{(Math.min(getRecommendedPercent(selectedOffer.color), 0.1) * 100).toFixed(1)}%</b>
                </div>
                <div>
                  Cantidad recomendada:{" "}
                  <b>
                    {(availableBalance * Math.min(getRecommendedPercent(selectedOffer.color), 0.1)).toFixed(2)}€
                  </b>
                </div>
                <div>
                  Máximo permitido ahora (10%):{" "}
                  <b>{(availableBalance * 0.1).toFixed(2)}€</b>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
                Cantidad que quieres apostar (€)
              </label>

              <input
                type="number"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 12,
                background: "#fafafa",
                border: "1px solid #eee",
                fontSize: 14,
                color: "#555",
              }}
            >
              Posible ganancia neta si aciertas:{" "}
              <b>
                {(() => {
                  const amount = Number(String(betAmount).replace(",", "."));
                  if (!Number.isFinite(amount) || amount <= 0) return "0.00€";
                  return `${(amount * (selectedOffer.odds - 1)).toFixed(2)}€`;
                })()}
              </b>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button style={buttonStyleSecondary} onClick={closeBetModal}>
                Cancelar
              </button>
              <button style={buttonStylePrimary} onClick={confirmBet}>
                Confirmar apuesta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const buttonStylePrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#111827",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const buttonStyleSecondary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "white",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
};

const closeButtonStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  background: "white",
  borderRadius: 10,
  width: 36,
  height: 36,
  cursor: "pointer",
  fontSize: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #ddd",
  fontSize: 16,
};
