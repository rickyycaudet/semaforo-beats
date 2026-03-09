"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ComboBuilder, { ComboPick } from "./ComboBuilder";

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
  market_probability?: number | null;
  model_probability?: number | null;
  edge?: number | null;
  risk_score?: number | null;
  confidence_score?: number | null;
  final_score?: number | null;
  reason_text?: string | null;
};

type EventWithOffers = EventRow & {
  offers: OfferRow[];
};

type RecommendedOffer = OfferRow & {
  event: EventWithOffers;
};

type StrategyKey = "auto" | "safe" | "balanced" | "aggressive";

function badge(color: OfferRow["color"]) {
  if (color === "green") return "🟢";
  if (color === "orange") return "🟠";
  if (color === "red") return "🔴";
  return "⚪";
}

function colorName(color: OfferRow["color"]) {
  if (color === "green") return "Muy recomendable";
  if (color === "orange") return "Interesante";
  if (color === "red") return "Agresiva";
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

function getAutoPercent(color: OfferRow["color"]) {
  if (color === "green") return 0.04;
  if (color === "orange") return 0.025;
  if (color === "red") return 0.015;
  return 0.02;
}

function getStrategyPercent(strategy: StrategyKey, color: OfferRow["color"]) {
  if (strategy === "safe") return 0.02;
  if (strategy === "balanced") return 0.04;
  if (strategy === "aggressive") return 0.07;
  return getAutoPercent(color);
}

function strategyLabel(strategy: StrategyKey) {
  if (strategy === "safe") return "Conservadora";
  if (strategy === "balanced") return "Equilibrada";
  if (strategy === "aggressive") return "Agresiva";
  return "Automática";
}

function strategyDescription(strategy: StrategyKey) {
  if (strategy === "safe") return "Pensada para arriesgar poco y proteger el saldo.";
  if (strategy === "balanced") return "Una opción intermedia entre prudencia y rentabilidad.";
  if (strategy === "aggressive") return "Más riesgo buscando más beneficio potencial.";
  return "El sistema decide la cantidad según la calidad de la apuesta.";
}

export default function HoyClient() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventWithOffers[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [bankrollInitial, setBankrollInitial] = useState<number>(0);
  const [ledgerSum, setLedgerSum] = useState<number>(0);

  const [selectedEvent, setSelectedEvent] = useState<EventWithOffers | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<OfferRow | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>("auto");

  const [comboPicks, setComboPicks] = useState<ComboPick[]>([]);

  const availableBalance = useMemo(() => bankrollInitial + ledgerSum, [bankrollInitial, ledgerSum]);

  async function loadBalance() {
    const { data: settings } = await supabase.from("user_settings").select("bankroll_initial").single();
    const { data: ledgerRows } = await supabase.from("ledger").select("amount");

    const initial = Number(settings?.bankroll_initial ?? 0);
    const sum = (ledgerRows ?? []).reduce((acc, row: any) => acc + Number(row.amount ?? 0), 0);

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
      await fetch("/api/settle-bets", { method: "GET", cache: "no-store" });
    } catch {}
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

  async function refreshMatches() {
    setRefreshing(true);

    try {
      const importRes = await fetch("/api/import-events", { method: "GET", cache: "no-store" });
      const importData = await importRes.json();

      if (!importRes.ok) {
        alert("Error actualizando partidos: " + (importData?.details || importData?.error || "Error desconocido"));
        setRefreshing(false);
        return;
      }

      const offersRes = await fetch("/api/generate-offers", { method: "GET", cache: "no-store" });
      const offersData = await offersRes.json();

      if (!offersRes.ok) {
        alert("Los partidos se actualizaron, pero falló la generación de apuestas: " + (offersData?.details || offersData?.error || "Error desconocido"));
        setRefreshing(false);
        return;
      }

      await loadAll();
      alert("Partidos y apuestas actualizados ✅");
    } catch (error: any) {
      alert("Error actualizando: " + (error?.message ?? "Error desconocido"));
    }

    setRefreshing(false);
  }

  function applyStrategy(strategy: StrategyKey, offer: OfferRow) {
    const percent = Math.min(getStrategyPercent(strategy, offer.color), 0.1);
    const amount = availableBalance * percent;
    setSelectedStrategy(strategy);
    setBetAmount(amount > 0 ? amount.toFixed(2) : "");
  }

  function openBetModal(event: EventWithOffers, offer: OfferRow) {
    setSelectedEvent(event);
    setSelectedOffer(offer);
    setSelectedStrategy("auto");
    const pct = Math.min(getAutoPercent(offer.color), 0.1);
    const recommended = availableBalance * pct;
    setBetAmount(recommended > 0 ? recommended.toFixed(2) : "");
  }

  function closeBetModal() {
    setSelectedEvent(null);
    setSelectedOffer(null);
    setBetAmount("");
    setSelectedStrategy("auto");
  }

  function addToCombo(event: EventWithOffers, offer: OfferRow) {
    const pickId = `${event.id}-${offer.id}`;
    setComboPicks((prev) => {
      if (prev.some((p) => p.id === pickId)) return prev;
      return [
        ...prev,
        {
          id: pickId,
          eventLabel: `${event.home_team} vs ${event.away_team}`,
          pickLabel: offer.label,
          odds: Number(offer.odds),
          color: offer.color,
        },
      ];
    });
  }

  function removeFromCombo(id: string) {
    setComboPicks((prev) => prev.filter((pick) => pick.id !== id));
  }

  function clearCombo() {
    setComboPicks([]);
  }

  async function confirmBet() {
    if (!selectedEvent || !selectedOffer) return;

    const amount = Number(String(betAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return alert("La cantidad apostada no es válida.");

    const maxAllowed = availableBalance * 0.1;
    if (amount > maxAllowed) return alert(`No puedes apostar más del 10% de tu saldo.\nMáximo permitido ahora: ${maxAllowed.toFixed(2)}€`);
    if (amount > availableBalance) return alert("No tienes suficiente saldo disponible.");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert("No hay sesión iniciada.");

    const colorToSave = selectedOffer.color === "extra" ? "orange" : selectedOffer.color;

    const { data: bet, error: betError } = await supabase
      .from("bets")
      .insert({
        user_id: user.id,
        sport: selectedEvent.sport,
        event_label: `${selectedEvent.home_team} vs ${selectedEvent.away_team}`,
        pick_label: selectedOffer.label,
        color: colorToSave,
        prob_snapshot: Number(selectedOffer.model_probability ?? selectedOffer.probability),
        odds_taken: Number(selectedOffer.odds),
        stake: amount,
        stake_source: selectedStrategy,
        status: "pending",
        profit: 0,
        provider_event_id: selectedEvent.provider_event_id ?? null,
        provider_sport_key: selectedEvent.provider_sport_key ?? null,
        market_key: selectedOffer.market_key,
        selection_name: selectedOffer.label,
      })
      .select("id")
      .single();

    if (betError) return alert("Error guardando la apuesta: " + betError.message);

    const { error: ledgerError } = await supabase.from("ledger").insert({
      user_id: user.id,
      bet_id: bet.id,
      type: "stake_lock",
      amount: -amount,
    });

    if (ledgerError) {
      return alert("La apuesta se guardó, pero hubo un error al descontar el saldo: " + ledgerError.message);
    }

    alert("Apuesta guardada ✅");
    closeBetModal();
    window.location.reload();
  }

  const allOffers: RecommendedOffer[] = events.flatMap((e) => e.offers.map((o) => ({ ...o, event: e })));

  const recommended = allOffers
    .sort((a, b) => Number(b.final_score ?? 0) - Number(a.final_score ?? 0))
    .slice(0, 3);

  const currentPercent = selectedOffer
    ? Math.min(getStrategyPercent(selectedStrategy, selectedOffer.color), 0.1)
    : 0;

  return (
    <>
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666" }}>Panel profesional</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>Selección inteligente de apuestas</div>
          </div>

          <button
            onClick={refreshMatches}
            disabled={refreshing}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: refreshing ? "default" : "pointer",
              fontWeight: 800,
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Actualizando..." : "Actualizar partidos"}
          </button>
        </div>

        <ComboBuilder picks={comboPicks} onRemovePick={removeFromCombo} onClear={clearCombo} />

        {events.length === 0 ? (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 }}>
            No hay partidos disponibles ahora mismo.
          </div>
        ) : (
          <>
            <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%)", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>⭐ Mejores apuestas del momento</h2>
              <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
                Estas son las apuestas que el sistema considera más interesantes por valor y confianza.
              </p>

              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {recommended.map((offer) => (
                  <div key={offer.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        {badge(offer.color)} {offer.event.home_team} vs {offer.event.away_team}
                      </div>
                      <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>{offer.label}</div>
                      <div style={{ fontSize: 13, color: "#777", marginTop: 6 }}>
                        Cuota {offer.odds.toFixed(2)} · Ventaja {(Number(offer.edge ?? 0) * 100).toFixed(1)}% · Confianza {(Number(offer.confidence_score ?? 0) * 100).toFixed(0)}%
                      </div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                        Motivo: {offer.reason_text || "Sin explicación"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={buttonStyleSecondary} onClick={() => addToCombo(offer.event, offer)}>
                        Añadir a combinada
                      </button>
                      <button style={buttonStylePrimary} onClick={() => openBetModal(offer.event, offer)}>
                        Apostar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {events.map((event) => {
                const isOpen = expandedEventId === event.id;

                return (
                  <div key={event.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 16, overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandedEventId(isOpen ? null : event.id)}
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
                        {event.offers.map((offer) => (
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
                                  : "#fef2f2",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800 }}>
                                {badge(offer.color)} {offer.label}
                              </div>
                              <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                                {colorName(offer.color)} · Cuota {offer.odds.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                                Ventaja {(Number(offer.edge ?? 0) * 100).toFixed(1)}% · Confianza {(Number(offer.confidence_score ?? 0) * 100).toFixed(0)}% · Riesgo {(Number(offer.risk_score ?? 0) * 100).toFixed(0)}%
                              </div>
                              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                                Motivo: {offer.reason_text || "Sin explicación"}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button style={buttonStyleSecondary} onClick={() => addToCombo(event, offer)}>
                                Añadir a combinada
                              </button>
                              <button style={buttonStyleSecondary} onClick={() => openBetModal(event, offer)}>
                                Apostar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
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
              <button onClick={closeBetModal} style={closeButtonStyle}>✕</button>
            </div>

            <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 800 }}>
                {badge(selectedOffer.color)} {selectedOffer.label}
              </div>
              <div style={{ fontSize: 14, color: "#555", marginTop: 8 }}>
                Cuota: <b>{selectedOffer.odds.toFixed(2)}</b>
              </div>
              <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>
                Ventaja estimada: <b>{(Number(selectedOffer.edge ?? 0) * 100).toFixed(1)}%</b>
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                Motivo: {selectedOffer.reason_text || "Sin explicación"}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Estrategia de apuesta</div>
              <div style={{ display: "grid", gap: 10 }}>
                {(["auto", "safe", "balanced", "aggressive"] as StrategyKey[]).map((strategy) => {
                  const pct = Math.min(getStrategyPercent(strategy, selectedOffer.color), 0.1);
                  const euros = availableBalance * pct;
                  const active = selectedStrategy === strategy;

                  return (
                    <button
                      key={strategy}
                      onClick={() => applyStrategy(strategy, selectedOffer)}
                      style={{
                        textAlign: "left",
                        borderRadius: 12,
                        border: active ? "2px solid #111827" : "1px solid #ddd",
                        background: active ? "#f9fafb" : "white",
                        padding: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {strategyLabel(strategy)} · {(pct * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                        {strategyDescription(strategy)}
                      </div>
                      <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>
                        Cantidad sugerida: <b>{euros.toFixed(2)}€</b>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Recomendación actual</div>
              <div style={{ display: "grid", gap: 8, background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div>Saldo disponible: <b>{availableBalance.toFixed(2)}€</b></div>
                <div>Porcentaje recomendado: <b>{(currentPercent * 100).toFixed(1)}%</b></div>
                <div>Cantidad recomendada: <b>{(availableBalance * currentPercent).toFixed(2)}€</b></div>
                <div>Máximo permitido ahora (10%): <b>{(availableBalance * 0.1).toFixed(2)}€</b></div>
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

            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#fafafa", border: "1px solid #eee", fontSize: 14, color: "#555" }}>
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
              <button style={buttonStyleSecondary} onClick={closeBetModal}>Cancelar</button>
              <button style={buttonStylePrimary} onClick={confirmBet}>Confirmar apuesta</button>
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
