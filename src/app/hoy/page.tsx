import AuthGate from "../../components/AuthGate";
import BalanceBar from "../../components/BalanceBar";
import HoyClient from "../../components/HoyClient";

export default function HoyPage() {
  return (
    <AuthGate>
      <div style={{ display: "grid", gap: 14 }}>
        <BalanceBar />

        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Hoy</h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Aquí verás los partidos del día y las opciones del semáforo.
          </p>
        </div>

        <HoyClient />
      </div>
    </AuthGate>
  );
}
