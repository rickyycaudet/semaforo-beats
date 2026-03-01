import AuthGate from "../../components/AuthGate";

export default function HoyPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Hoy</h1>
        <p style={{ marginTop: 8 }}>
          Aquí saldrán los partidos del día y el semáforo (🟢 🟠 🔴).
        </p>
      </div>
    </AuthGate>
  );
}
