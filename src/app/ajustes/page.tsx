import AuthGate from "../../components/AuthGate";

export default function AjustesPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Ajustes</h1>
        <p style={{ marginTop: 8 }}>
          Aquí configurarás tu bankroll y el modo de staking.
        </p>
      </div>
    </AuthGate>
  );
}
