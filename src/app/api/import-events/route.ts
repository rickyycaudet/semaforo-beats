import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OddsEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
};

export async function GET() {
  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!oddsApiKey) {
    return NextResponse.json({ error: "Falta ODDS_API_KEY" }, { status: 500 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Faltan variables de Supabase" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url =
      "https://api.the-odds-api.com/v4/sports/upcoming/odds" +
      "?apiKey=" +
      oddsApiKey +
      "&regions=eu" +
      "&markets=h2h" +
      "&oddsFormat=decimal" +
      "&dateFormat=iso";

    const res = await fetch(url, { method: "GET", cache: "no-store" });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: "Error The Odds API", details: txt },
        { status: 500 }
      );
    }

    const data: OddsEvent[] = await res.json();

    const allowedSoccer = new Set([
      "soccer_spain_la_liga",
      "soccer_epl",
      "soccer_italy_serie_a",
      "soccer_germany_bundesliga",
      "soccer_france_ligue_one",
      "soccer_uefa_champs_league",
      "soccer_uefa_europa_league",
    ]);

    const allowedTennis = (sportKey: string) => sportKey.startsWith("tennis_");

    const filtered = data.filter((event) => {
      return (
        allowedSoccer.has(event.sport_key) || allowedTennis(event.sport_key)
      );
    });

    const rows = filtered
      .filter((event) => event.home_team && event.away_team)
      .map((event) => ({
        provider_event_id: event.id,
        provider_sport_key: event.sport_key,
        sport: event.sport_key.startsWith("tennis_") ? "tennis" : "soccer",
        league: event.sport_title,
        home_team: event.home_team as string,
        away_team: event.away_team as string,
        start_time: event.commence_time,
      }));

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        message: "No se encontraron partidos válidos",
      });
    }

    const { error } = await supabase
      .from("daily_events")
      .upsert(rows, { onConflict: "provider_event_id" });

    if (error) {
      return NextResponse.json(
        { error: "Error guardando en Supabase", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      inserted: rows.length,
      sample: rows.slice(0, 5),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
