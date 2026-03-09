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
  provider_sport_key?: string | null;
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
  market_probability: number;
  model_probability: number;
  edge: number;
  risk_score: number;
  confidence_score: number;
  final_score: number;
  reason_text: string;
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getRiskScore(probability: number, odds: number) {
  let risk = 0.5;

  if (probability >= 0.7) risk -= 0.18;
  else if (probability >= 0.55) risk -= 0.05;
  else if (probability < 0.4) risk += 0.2;

  if (odds >= 3) risk += 0.2;
  else if (odds >= 2) risk += 0.08;
  else if (odds <= 1.4) risk -= 0.08;

  return clamp(risk, 0, 1);
}

function buildModelProbability(args: {
  probability: number;
  odds: number;
  label: string;
  sport: string;
  event: DailyEventRow;
}) {
  const { probability, odds, label, sport, event } = args;

  let model = probability;
  const reasons: string[] = [];
  let confidence = 0.55;

  const normalizedLabel = (label || "").toLowerCase();

  if (sport === "soccer") {
    if (normalizedLabel.includes(event.home_team.toLowerCase())) {
      model += 0.03;
      reasons.push("ligera ventaja al equipo local");
      confidence += 0.08;
    }

    if (normalizedLabel === "draw" || normalizedLabel === "empate") {
      model -= 0.03;
      reasons.push("el empate suele ser menos estable");
      confidence -= 0.04;
    }

    if (odds <= 1.55) {
      model += 0.02;
      reasons.push("favorito claro");
      confidence += 0.06;
    }

    if (odds >= 3.0) {
      model -= 0.03;
      reasons.push("cuota alta implica mayor riesgo");
      confidence -= 0.06;
    }
  }

  if (sport === "tennis") {
    if (odds <= 1.5) {
      model += 0.03;
      reasons.push("favorito fuerte en tenis");
      confidence += 0.08;
    }

    if (odds >= 2.5) {
      model -= 0.03;
      reasons.push("pick agresivo en tenis");
      confidence -= 0.05;
    }
  }

  model = clamp(model, 0.02, 0.95);
  confidence = clamp(confidence, 0, 1);

  return {
    modelProbability: model,
    confidenceScore: confidence,
    reasonText: reasons.length > 0 ? reasons.join(", ") : "selección estándar del sistema",
  };
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
      .select("id, provider_event_id, provider_sport_key, sport, league, home_team, away_team, start_time")
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
      const oddsEvent = oddsEvents.find((oe) => oe.id === event.provider_event_id);

      if (!oddsEvent || !oddsEvent.bookmakers || oddsEvent.bookmakers.length === 0) {
        continue;
      }

      const bestByOutcome: Record<
        string,
        {
          label: string;
          odds: number;
          probability: number;
          bookmaker: string;
        }
      > = {};

      for (const bookmaker of oddsEvent.bookmakers) {
        const h2hMarket = bookmaker.markets?.find((m) => m.key === "h2h");

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

      const enriched = Object.values(bestByOutcome).map((pick) => {
        const marketProbability = pick.probability;

        const modelData = buildModelProbability({
          probability: marketProbability,
          odds: pick.odds,
          label: pick.label,
          sport: event.sport,
          event,
        });

        const edge = modelData.modelProbability - marketProbability;
        const riskScore = getRiskScore(modelData.modelProbability, pick.odds);

        const finalScore =
          edge * 100 +
          modelData.confidenceScore * 10 -
          riskScore * 8;

        return {
          ...pick,
          marketProbability,
          modelProbability: modelData.modelProbability,
          edge,
          riskScore,
          confidenceScore: modelData.confidenceScore,
          finalScore,
          reasonText: modelData.reasonText,
        };
      });

      const ranked = enriched.sort((a, b) => b.finalScore - a.finalScore);

      if (ranked.length < 2) continue;

      const colors: Array<"green" | "orange" | "red"> = ["green", "orange", "red"];

      ranked.slice(0, 3).forEach((pick, index) => {
        offersToInsert.push({
          event_id: event.id,
          color: colors[index],
          market_key: "h2h",
          label: pick.label,
          odds: pick.odds,
          probability: pick.modelProbability,
          bookmaker: pick.bookmaker,
          market_probability: pick.marketProbability,
          model_probability: pick.modelProbability,
          edge: pick.edge,
          risk_score: pick.riskScore,
          confidence_score: pick.confidenceScore,
          final_score: pick.finalScore,
          reason_text: pick.reasonText,
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
      sample: offersToInsert.slice(0, 6),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
