import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const results: any = {};

    // 1️⃣ Importar partidos
    try {
      const res = await fetch(`${baseUrl}/api/import-events`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();
      results.importEvents = data;
    } catch (err: any) {
      results.importEvents = {
        error: err?.message ?? "Error import-events",
      };
    }

    // 2️⃣ Generar apuestas
    try {
      const res = await fetch(`${baseUrl}/api/generate-offers`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();
      results.generateOffers = data;
    } catch (err: any) {
      results.generateOffers = {
        error: err?.message ?? "Error generate-offers",
      };
    }

    // 3️⃣ Cerrar apuestas
    try {
      const res = await fetch(`${baseUrl}/api/settle-bets`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();
      results.settleBets = data;
    } catch (err: any) {
      results.settleBets = {
        error: err?.message ?? "Error settle-bets",
      };
    }

    return NextResponse.json({
      ok: true,
      message: "Daily automation executed",
      results,
      executed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "Daily run error",
      },
      { status: 500 }
    );
  }
}
