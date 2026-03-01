import AuthGate from "../../components/AuthGate";

export default function MisApuestasPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Mis apuestas</h1>
        <p style={{ marginTop: 8 }}>
          Aquí verás todas tus apuestas (pendientes, ganadas, perdidas).
        </p>
      </div>
    </AuthGate>
  );
}
