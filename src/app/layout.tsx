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
          background:
            "radial-gradient(circle at top left, #f8fbff 0%, #f4f7fb 45%, #f6f8fb 100%)",
          color: "#111827",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #e5e7eb",
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 20,
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              maxWidth: 1240,
              margin: "0 auto",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/hoy"
              style={{
                fontWeight: 900,
                textDecoration: "none",
                color: "#111827",
                fontSize: 22,
                letterSpacing: "-0.02em",
              }}
            >
              Semáforo Bets
            </Link>

            <nav
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <NavButton href="/hoy" label="Hoy" />
              <NavButton href="/directo" label="Directo" />
              <NavButton href="/mis-apuestas" label="Mis apuestas" />
              <NavButton href="/combinadas" label="Combinadas" />
              <NavButton href="/estadisticas" label="Estadísticas" />
              <NavButton href="/ajustes" label="Ajustes" />
            </nav>
          </div>
        </header>

        <main
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "24px 18px 40px 18px",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "#111827",
        fontWeight: 700,
        fontSize: 14,
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "white",
        boxShadow: "0 4px 10px rgba(0,0,0,0.02)",
      }}
    >
      {label}
    </Link>
  );
}
