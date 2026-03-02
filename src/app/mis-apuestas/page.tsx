import AuthGate from "../../components/AuthGate";
import MisApuestasClient from "../../components/MisApuestasClient";

export default function MisApuestasPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Mis apuestas</h1>
        <p style={{ marginTop: 8, marginBottom: 14 }}>
          Añade apuestas y revisa tu historial.
        </p>

        <MisApuestasClient />
      </div>
    </AuthGate>
  );
}
