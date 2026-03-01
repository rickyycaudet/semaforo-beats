import AuthGate from "../../components/AuthGate";
import AjustesClient from "../../components/AjustesClient";

export default function AjustesPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Ajustes</h1>
        <p style={{ marginTop: 8, marginBottom: 14 }}>
          Configura tu bankroll inicial y el staking (manual o Kelly fraccional).
        </p>

        <AjustesClient />
      </div>
    </AuthGate>
  );
}
