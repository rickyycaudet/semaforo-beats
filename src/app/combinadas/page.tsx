import AuthGate from "../../components/AuthGate";
import CombinadasClient from "../../components/CombinadasClient";

export default function CombinadasPage() {
  return (
    <AuthGate>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Combinadas
          </h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Aquí verás todas tus combinadas guardadas y su resultado.
          </p>
        </div>

        <CombinadasClient />
      </div>
    </AuthGate>
  );
}
