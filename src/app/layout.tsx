import Link from "next/link";

export const metadata = {
  title: "Semáforo Bets",
  description: "Apuestas diarias con semáforo y tracking",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <header
          style={{
            borderBottom: "1px solid #eee",
            background: "white",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Link href="/hoy" style={{ fontWeight: 800, textDecoration: "none", color: "#111" }}>
              Semáforo Bets
            </Link>

            <nav style={{ display: "flex", gap: 14, fontSize: 14 }}>
              <Link href="/hoy" style={{ textDecoration: "none", color: "#111" }}>
                Hoy
              </Link>
              <Link href="/mis-apuestas" style={{ textDecoration: "none", color: "#111" }}>
                Mis apuestas
              </Link>
              <Link href="/estadisticas" style={{ textDecoration: "none", color: "#111" }}>
                Estadísticas
              </Link>
              <Link href="/ajustes" style={{ textDecoration: "none", color: "#111" }}>
                Ajustes
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
