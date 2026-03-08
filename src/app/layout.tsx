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
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          background: "#f6f8fb",
          color: "#111827",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #e5e7eb",
            background: "white",
            position: "sticky",
            top: 0,
            zIndex: 10,
            boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Link
              href="/hoy"
              style={{
                fontWeight: 900,
                textDecoration: "none",
                color: "#111",
                fontSize: 20,
              }}
            >
              Semáforo Bets
            </Link>

            <nav
              style={{
                display: "flex",
                gap: 14,
                fontSize: 14,
                flexWrap: "wrap",
              }}
            >
              <Link href="/hoy" style={navLinkStyle}>
                Hoy
              </Link>
              <Link href="/directo" style={navLinkStyle}>
                Directo
              </Link>
              <Link href="/mis-apuestas" style={navLinkStyle}>
                Mis apuestas
              </Link>
              <Link href="/estadisticas" style={navLinkStyle}>
                Estadísticas
              </Link>
              <Link href="/ajustes" style={navLinkStyle}>
                Ajustes
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 16px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}

const navLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 600,
};
