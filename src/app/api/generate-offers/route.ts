import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OddsOutcome = {
  name: string;
  price: number;
};

type OddsMarket = {
  key: string;
  outcomes: OddsOutcome[];
};

type OddsBookmaker = {
  key: string;
  title: string;
  markets: OddsMarket[];
};

type OddsEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OddsBookmaker[];
};

type DailyEventRow = {
  id: string;
  provider_event_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
};

type OfferInsert = {
  event_id: string;
  color: "green" | "orange" | "red";
  market_key: string;
  label: string;
  odds: number;
  probability: number;
  bookmaker: string | null;
};

function impliedProb(decimalOdds: number) {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}

function normalizeNoVig(outcomes: OddsOutcome[]) {
  const implied = outcomes.map((o) => ({
    name: o.name,
    price: o.price,
    p: impliedProb(o.price),
  }));

  const sum = implied.reduce((acc, x) => acc + x.p, 0);

  if (!sum) {
    return implied.map((x) => ({
      name: x.name,
      price: x.price,
      probability: 0,
    }));
  }

  return implied.map((x) => ({
    name: x.name,
    price: x.price,
    probability: x.p / sum,
  }));
}

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
    const { data: dailyEvents, error: eventsErr } = await supabase
      .from("daily_events")
      .select("id, provider_event_id, sport, league, home_team, away_team, start_time")
      .order("start_time", { ascending: true });

    if (eventsErr) {
      return NextResponse.json(
        { error: "Error leyendo daily_events", details: eventsErr.message },
        { status: 500 }
      );
    }

    const events = (dailyEvents ?? []) as DailyEventRow[];

    if (events.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        message: "No hay partidos en daily_events",
      });
    }

    const url =
      "https://api.the-odds-api.com/v4/sports/upcoming/odds" +
      "?apiKey=" + oddsApiKey +
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

    const oddsEvents = (await res.json()) as OddsEvent[];

    const offersToInsert: OfferInsert[] = [];

    for (const event of events) {
      const oddsEvent = oddsEvents.find(function (oe) {
        return oe.id === event.provider_event_id;
      });

      if (!oddsEvent || !oddsEvent.bookmakers || oddsEvent.bookmakers.length === 0) {
        continue;
      }

      const bestByOutcome: Record<
        string,
        { label: string; odds: number; probability: number; bookmaker: string }
      > = {};

      for (const bookmaker of oddsEvent.bookmakers) {
        const h2hMarket = bookmaker.markets?.find(function (m) {
          return m.key === "h2h";
        });

        if (!h2hMarket || !h2hMarket.outcomes || h2hMarket.outcomes.length < 2) {
          continue;
        }

        const fairOutcomes = normalizeNoVig(h2hMarket.outcomes);

        for (const outcome of fairOutcomes) {
          const existing = bestByOutcome[outcome.name];

          if (!existing || outcome.price > existing.odds) {
            bestByOutcome[outcome.name] = {
              label: outcome.name,
              odds: outcome.price,
              probability: outcome.probability,
              bookmaker: bookmaker.title,
            };
          }
        }
      }

      const ranked = Object.values(bestByOutcome).sort(function (a, b) {
        return b.probability - a.probability;
      });

      if (ranked.length < 2) {
        continue;
      }

      const colors: Array<"green" | "orange" | "red"> = ["green", "orange", "red"];

      ranked.slice(0, 3).forEach(function (pick, index) {
        if (!colors[index]) return;

        offersToInsert.push({
          event_id: event.id,
          color: colors[index],
          market_key: "h2h",
          label: pick.label,
          odds: pick.odds,
          probability: pick.probability,
          bookmaker: pick.bookmaker,
        });
      });
    }

    if (offersToInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        message: "No se pudieron generar ofertas",
      });
    }

    const eventIdsMap: Record<string, boolean> = {};
    for (const offer of offersToInsert) {
      eventIdsMap[offer.event_id] = true;
    }
    const eventIds = Object.keys(eventIdsMap);

    const { error: deleteErr } = await supabase
      .from("daily_offers")
      .delete()
      .in("event_id", eventIds);

    if (deleteErr) {
      return NextResponse.json(
        { error: "Error borrando ofertas antiguas", details: deleteErr.message },
        { status: 500 }
      );
    }

    const { error: insertErr } = await supabase
      .from("daily_offers")
      .insert(offersToInsert);

    if (insertErr) {
      return NextResponse.json(
        { error: "Error insertando ofertas", details: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      inserted: offersToInsert.length,
      eventsProcessed: events.length,
      sample: offersToInsert.slice(0, 6),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
