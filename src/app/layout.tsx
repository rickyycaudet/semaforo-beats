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
      <body>{children}</body>
    </html>
  );
}
