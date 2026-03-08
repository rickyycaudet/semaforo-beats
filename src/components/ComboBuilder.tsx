"use client";

import { useMemo, useState } from "react";

export type ComboPick = {
  id: string;
  eventLabel: string;
  pickLabel: string;
  odds: number;
  color: "green" | "orange" | "red" | "extra";
};

type Props = {
  picks: ComboPick[];
  onRemovePick: (id: string) => void;
  onClear: () => void;
};

function colorBadge(color: ComboPick["color"]) {
  if (color === "green") return "🟢";
  if (color === "orange") return "🟠";
  if (color === "red") return "🔴";
  return "⚪";
}

export default function ComboBuilder({
  picks,
  onRemovePick,
  onClear,
}: Props) {
  const [amount, setAmount] = useState<string>("10");

  const combinedOdds = useMemo(() => {
    if (picks.length === 0) return 0;
    return picks.reduce((acc, pick) => acc * Number(pick.odds), 1);
  }, [picks]);

  const amountNumber = Number(String(amount).replace(",", "."));
  const possibleReturn =
    Number.isFinite(amountNumber) && amountNumber > 0 && combinedOdds > 0
      ? amountNumber * combinedOdds
      : 0;

  const possibleProfit =
    Number.isFinite(amountNumber) && amountNumber > 0 && combinedOdds > 0
      ? possibleReturn - amountNumber
      : 0;

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
            🧩 Tu combinada
          </h3>
          <p style={{ margin: "6px 0 0 0", color: "#666", fontSize: 14 }}>
            Junta varias apuestas para ver una cuota combinada estimada.
          </p>
        </div>

        {picks.length > 0 && (
          <button
            onClick={onClear}
            style={{
              border: "1px solid #ddd",
              background: "white",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 700,
              height: "fit-content",
            }}
          >
            Vaciar
          </button>
        )}
      </div>

      {picks.length === 0 ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            background: "#f9fafb",
            border: "1px dashed #d1d5db",
            color: "#666",
            fontSize: 14,
          }}
        >
          Aún no has añadido apuestas a la combinada.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {picks.map((pick) => (
              <div
                key={pick.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {colorBadge(pick.color)} {pick.pickLabel}
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                    {pick.eventLabel}
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                    Cuota: <b>{Number(pick.odds).toFixed(2)}</b>
                  </div>
                </div>

                <button
                  onClick={() => onRemovePick(pick.id)}
                  style={{
                    border: "1px solid #ddd",
                    background: "white",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gap: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "#666" }}>Cuota combinada estimada</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>
                {combinedOdds.toFixed(2)}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
                Cantidad a apostar (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  fontSize: 16,
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "white",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: "#666" }}>Retorno total estimado</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {possibleReturn.toFixed(2)}€
                </div>
              </div>

              <div
                style={{
                  background: "white",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: "#666" }}>Ganancia neta estimada</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {possibleProfit.toFixed(2)}€
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#666",
                lineHeight: 1.6,
                background: "white",
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
              }}
            >
              Esta combinada es una <b>estimación interna</b> de tu panel. La cuota real
              final puede variar en la casa de apuestas.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
