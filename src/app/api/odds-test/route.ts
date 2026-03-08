import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta ODDS_API_KEY en las variables de entorno" },
      { status: 500 }
    );
  }

  try {
    const url =
      "https://api.the-odds-api.com/v4/sports/upcoming/odds" +
      "?apiKey=" + apiKey +
      "&regions=eu" +
      "&markets=h2h" +
      "&oddsFormat=decimal" +
      "&dateFormat=iso";

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
