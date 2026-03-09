import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OddsOutcome = {
  name: string;
  price: number;
  point?: number;
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

type CandidatePick = {
  label: string;
  market_key: string;
  odds: number;
  bookmaker: string;
  marketProbability: number;
  modelProbability: number;
  edge: number;
  riskScore: number;
  confidenceScore: number;
  finalScore: number;
  reasonText: string;
  isPremium: boolean;
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeNoVig(outcomes: OddsOutcome[]) {
  const implied = outcomes.map((o) => ({
    name: o.name,
    price: o.price,
    point: o.point,
    p: impliedProb(o.price),
  }));

  const sum = implied.reduce((acc, x) => acc + x.p, 0);

  if (!sum) {
    return implied.map((x) => ({
      name: x.name,
      price: x.price,
      point: x.point,
      probability: 0,
    }));
  }

  return implied.map((x) => ({
    name: x.name,
    price: x.price,
    point: x.point,
    probability: x.p / sum,
  }));
}

function getRiskScore(marketKey: string, probability: number, odds: number) {
  let risk = 0.5;

  if (marketKey === "h2h") risk -= 0.05;
  if (marketKey === "totals") risk += 0.03;
  if (marketKey === "btts") risk += 0.06;

  if (probability >= 0.7) risk -= 0.15;
  else if (probability >= 0.55) risk -= 0.05;
  else if (probability < 0.4) risk += 0.16;

  if (odds >= 3) risk += 0.2;
  else if (odds >= 2.2) risk += 0.1;
  else if (odds <= 1.45) risk -= 0.08;

  return clamp(risk, 0, 1);
}

function createDisplayLabel(
  marketKey: string,
  outcome: { name: string; point?: number | null }
) {
  if (marketKey === "h2h") {
    if (outcome.name === "Draw") return "Empate";
    return outcome.name;
  }

  if (marketKey === "totals") {
    const point = outcome.point ?? null;

    if (outcome.name.toLowerCase() === "over") {
      return point !== null ? `Más de ${point} goles` : "Más goles";
    }

    if (outcome.name.toLowerCase() === "under") {
      return point !== null ? `Menos de ${point} goles` : "Menos goles";
    }
  }

  if (marketKey === "btts") {
    if (outcome.name.toLowerCase() === "yes") return "Ambos marcan: Sí";
    if (outcome.name.toLowerCase() === "no") return "Ambos marcan: No";
  }

  return outcome.name;
}

function buildModelProbability(args: {
  marketKey: string;
  probability: number;
  odds: number;
  label: string;
  sport: string;
  event: DailyEventRow;
}) {
  const { marketKey, probability, odds, label, sport, event } = args;

  let model = probability;
  let confidence = 0.55;
  const reasons: string[] = [];

  const normalizedLabel = (label || "").toLowerCase();

  if (sport === "soccer") {
    if (marketKey === "h2h") {
      if (normalizedLabel.includes(event.home_team.toLowerCase())) {
        model += 0.025;
        confidence += 0.07;
        reasons.push("ligera ventaja al equipo local");
      }

      if (normalizedLabel === "draw" || normalizedLabel === "empate") {
        model -= 0.03;
        confidence -= 0.04;
        reasons.push("el empate suele ser menos estable");
      }

      if (odds <= 1.55) {
        model += 0.02;
        confidence += 0.05;
        reasons.push("favorito claro");
      }

      if (odds >= 3) {
        model -= 0.03;
        confidence -= 0.05;
        reasons.push("cuota alta implica mayor riesgo");
      }
    }

    if (marketKey === "totals") {
      if (normalizedLabel.includes("más de")) {
        if (odds >= 1.7 && odds <= 2.1) {
          model += 0.015;
          confidence += 0.04;
          reasons.push("línea de goles equilibrada");
        }
      }

      if (normalizedLabel.includes("menos de")) {
        if (odds <= 1.75) {
          model += 0.01;
          confidence += 0.03;
          reasons.push("línea conservadora");
        }
      }
    }

    if (marketKey === "btts") {
      if (normalizedLabel.includes("sí")) {
        model += 0.01;
        confidence += 0.03;
        reasons.push("mercado líquido y estable");
      } else {
        confidence -= 0.01;
      }
    }
  }

  if (sport === "tennis") {
    if (marketKey === "h2h") {
      if (odds <= 1.5) {
        model += 0.03;
        confidence += 0.08;
        reasons.push("favorito fuerte en tenis");
      }

      if (odds >= 2.5) {
        model -= 0.03;
        confidence -= 0.05;
        reasons.push("pick agresivo en tenis");
      }
    }
  }

  model = clamp(model, 0.02, 0.95);
  confidence = clamp(confidence, 0, 1);

  return {
    modelProbability: model,
    confidenceScore: confidence,
    reasonText:
      reasons.length > 0
        ? reasons.join(", ")
        : "selección estándar del sistema",
  };
}

function buildHumanReason(args: {
  marketKey: string;
  edge: number;
  riskScore: number;
  confidenceScore: number;
  odds: number;
  baseReason: string;
}) {
  const { marketKey, edge, riskScore, confidenceScore, odds, baseReason } = args;

  const parts: string[] = [];

  if (edge >= 0.05) parts.push("hay una ventaja clara frente al mercado");
  else if (edge >= 0.025) parts.push("hay una ventaja moderada frente al mercado");
  else if (edge > 0) parts.push("hay una pequeña ventaja frente al mercado");
  else parts.push("la ventaja es baja");

  if (confidenceScore >= 0.7) parts.push("la confianza del sistema es alta");
  else if (confidenceScore >= 0.58) parts.push("la confianza del sistema es aceptable");
  else parts.push("la confianza del sistema es limitada");

  if (riskScore <= 0.35) parts.push("el riesgo es bajo");
  else if (riskScore <= 0.55) parts.push("el riesgo es medio");
  else parts.push("el riesgo es alto");

  if (odds <= 1.35) {
    parts.push("pero la cuota es demasiado baja");
  } else if (odds >= 3.2) {
    parts.push("y la cuota es bastante agresiva");
  }

  if (marketKey === "totals") parts.push("mercado de goles");
  if (marketKey === "btts") parts.push("mercado de ambos marcan");
  if (marketKey === "h2h") parts.push("mercado de ganador");

  return `${parts.join(", ")}. Motivo base: ${baseReason}.`;
}

function isBadProbableBet(args: {
  edge: number;
  odds: number;
  confidenceScore: number;
}) {
  const { edge, odds, confidenceScore } = args;

  if (odds <= 1.22 && edge < 0.02) return true;
  if (odds <= 1.30 && edge < 0.015) return true;
  if (edge <= 0 && confidenceScore < 0.6) return true;

  return false;
}

function isPremiumPick(args: {
  edge: number;
  confidenceScore: number;
  riskScore: number;
  odds: number;
}) {
  const { edge, confidenceScore, riskScore, odds } = args;

  return (
    edge >= 0.025 &&
    confidenceScore >= 0.6 &&
    riskScore <= 0.55 &&
    odds >= 1.30
  );
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
      "&markets=h2h,totals,btts" +
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

      const bestByPick: Record<string, CandidatePick> = {};

      for (const bookmaker of oddsEvent.bookmakers) {
        const allowedMarkets = bookmaker.markets?.filter(
          (m) => m.key === "h2h" || m.key === "totals" || m.key === "btts"
        );

        if (!allowedMarkets || allowedMarkets.length === 0) continue;

        for (const market of allowedMarkets) {
          if (!market.outcomes || market.outcomes.length < 2) continue;

          const fairOutcomes = normalizeNoVig(market.outcomes);

          for (const outcome of fairOutcomes) {
            const label = createDisplayLabel(
              market.key,
              {
                name: outcome.name,
                point: outcome.point ?? null,
              }
            );

            const marketProbability = outcome.probability;

            const modelData = buildModelProbability({
              marketKey: market.key,
              probability: marketProbability,
              odds: outcome.price,
              label,
              sport: event.sport,
              event,
            });

            const edge = modelData.modelProbability - marketProbability;
            const riskScore = getRiskScore(
              market.key,
              modelData.modelProbability,
              outcome.price
            );

            if (
              isBadProbableBet({
                edge,
                odds: outcome.price,
                confidenceScore: modelData.confidenceScore,
              })
            ) {
              continue;
            }

            const finalScore =
              edge * 100 +
              modelData.confidenceScore * 10 -
              riskScore * 8;

            const reasonText = buildHumanReason({
              marketKey: market.key,
              edge,
              riskScore,
              confidenceScore: modelData.confidenceScore,
              odds: outcome.price,
              baseReason: modelData.reasonText,
            });

            const isPremium = isPremiumPick({
              edge,
              confidenceScore: modelData.confidenceScore,
              riskScore,
              odds: outcome.price,
            });

            const key = `${market.key}__${label}`;
            const existing = bestByPick[key];

            const candidate: CandidatePick = {
              label,
              market_key: market.key,
              odds: outcome.price,
              bookmaker: bookmaker.title,
              marketProbability,
              modelProbability: modelData.modelProbability,
              edge,
              riskScore,
              confidenceScore: modelData.confidenceScore,
              finalScore,
              reasonText,
              isPremium,
            };

            if (!existing || candidate.finalScore > existing.finalScore) {
              bestByPick[key] = candidate;
            }
          }
        }
      }

      let ranked = Object.values(bestByPick).sort(
        (a, b) => b.finalScore - a.finalScore
      );

      if (ranked.length === 0) continue;

      const premiumOnly = ranked.filter((pick) => pick.isPremium);
      if (premiumOnly.length >= 2) {
        ranked = premiumOnly;
      }

      const colors: Array<"green" | "orange" | "red"> = ["green", "orange", "red"];

      ranked.slice(0, 3).forEach((pick, index) => {
        offersToInsert.push({
          event_id: event.id,
          color: colors[index],
          market_key: pick.market_key,
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
      sample: offersToInsert.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
