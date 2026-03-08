import AuthGate from "../../components/AuthGate";
import EstadisticasClient from "../../components/EstadisticasClient";

export default function EstadisticasPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Estadísticas</h1>
        <p style={{ marginTop: 8, marginBottom: 14 }}>
          Aquí verás beneficio, ROI, winrate y resumen de tus apuestas.
        </p>

        <EstadisticasClient />
      </div>
    </AuthGate>
  );
}
