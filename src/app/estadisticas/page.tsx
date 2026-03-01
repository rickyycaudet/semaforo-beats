import AuthGate from "../../components/AuthGate";

export default function EstadisticasPage() {
  return (
    <AuthGate>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Estadísticas</h1>
        <p style={{ marginTop: 8 }}>
          Aquí verás beneficio, ROI, winrate y rendimiento por color.
        </p>
      </div>
    </AuthGate>
  );
}
