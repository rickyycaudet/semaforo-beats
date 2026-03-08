import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PendingBet = {
  id: string;
  user_id: string;
  provider_event_id: string | null;
  provider_sport_key: string | null;
  market_key: string | null;
  selection_name: string | null;
  stake: number;
  odds_taken: number;
  status: string;
};

type ScoreItem = {
  name: string;
  score: string | number | null;
};

type ScoreEvent = {
  id: string;
  sport_key: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: ScoreItem[] | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function toNumber(value: string | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getWinnerName(event: ScoreEvent): string | null {
  if (!event.scores || event.scores.length < 2) return null;

  const homeScoreObj = event.scores.find(
    (s) => normalizeText(s.name) === normalizeText(event.home_team)
  );
  const awayScoreObj = event.scores.find(
    (s) => normalizeText(s.name) === normalizeText(event.away_team)
  );

  if (!homeScoreObj || !awayScoreObj) return null;

  const homeScore = toNumber(homeScoreObj.score);
  const awayScore = toNumber(awayScoreObj.score);

  if (homeScore === null || awayScore === null) return null;

  if (homeScore > awayScore) return event.home_team;
  if (awayScore > homeScore) return event.away_team;
  return "Draw";
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
    const { data: betsData, error: betsError } = await supabase
      .from("bets")
      .select(
        "id,user_id,provider_event_id,provider_sport_key,market_key,selection_name,stake,odds_taken,status"
      )
      .eq("status", "pending")
      .not("provider_event_id", "is", null)
      .not("provider_sport_key", "is", null)
      .eq("market_key", "h2h");

    if (betsError) {
      return NextResponse.json(
        { error: "Error leyendo apuestas pendientes", details: betsError.message },
        { status: 500 }
      );
    }

    const pendingBets = (betsData ?? []) as PendingBet[];

    if (pendingBets.length === 0) {
      return NextResponse.json({
        ok: true,
        settled: 0,
        message: "No hay apuestas pendientes automáticas para cerrar",
      });
    }

    const betsBySport: Record<string, PendingBet[]> = {};
    for (const bet of pendingBets) {
      const sportKey = bet.provider_sport_key;
      if (!sportKey) continue;
      if (!betsBySport[sportKey]) betsBySport[sportKey] = [];
      betsBySport[sportKey].push(bet);
    }

    const completedResults: Record<string, ScoreEvent> = {};

    for (const sportKey of Object.keys(betsBySport)) {
      const eventIdsMap: Record<string, boolean> = {};
      for (const bet of betsBySport[sportKey]) {
        if (bet.provider_event_id) {
          eventIdsMap[bet.provider_event_id] = true;
        }
      }

      const eventIds = Object.keys(eventIdsMap);
      if (eventIds.length === 0) continue;

      const url =
        "https://api.the-odds-api.com/v4/sports/" +
        sportKey +
        "/scores" +
        "?apiKey=" +
        oddsApiKey +
        "&daysFrom=3" +
        "&dateFormat=iso" +
        "&eventIds=" +
        encodeURIComponent(eventIds.join(","));

      const res = await fetch(url, { method: "GET", cache: "no-store" });

      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json(
          {
            error: "Error consultando resultados en The Odds API",
            sportKey,
            details: txt,
          },
          { status: 500 }
        );
      }

      const scoreEvents = (await res.json()) as ScoreEvent[];

      for (const scoreEvent of scoreEvents) {
        if (scoreEvent.completed) {
          completedResults[scoreEvent.id] = scoreEvent;
        }
      }
    }

    let settledCount = 0;
    const settledBetsSummary: Array<{
      bet_id: string;
      result: "won" | "lost";
      winner: string | null;
    }> = [];

    for (const bet of pendingBets) {
      if (!bet.provider_event_id || !bet.selection_name) continue;

      const scoreEvent = completedResults[bet.provider_event_id];
      if (!scoreEvent) continue;

      const winnerName = getWinnerName(scoreEvent);
      if (!winnerName) continue;

      const didWin =
        normalizeText(bet.selection_name) === normalizeText(winnerName);

      const result = didWin ? "won" : "lost";
      const stakeNum = Number(bet.stake ?? 0);
      const oddsNum = Number(bet.odds_taken ?? 0);
      const profit = didWin ? stakeNum * (oddsNum - 1) : -stakeNum;

      if (didWin) {
        const { data: existingPayout, error: payoutCheckError } = await supabase
          .from("ledger")
          .select("id")
          .eq("bet_id", bet.id)
          .eq("type", "payout")
          .limit(1);

        if (payoutCheckError) {
          return NextResponse.json(
            {
              error: "Error comprobando payouts existentes",
              details: payoutCheckError.message,
            },
            { status: 500 }
          );
        }

        if (!existingPayout || existingPayout.length === 0) {
          const payout = stakeNum * oddsNum;

          const { error: payoutError } = await supabase.from("ledger").insert({
            user_id: bet.user_id,
            bet_id: bet.id,
            type: "payout",
            amount: payout,
          });

          if (payoutError) {
            return NextResponse.json(
              {
                error: "Error insertando payout",
                bet_id: bet.id,
                details: payoutError.message,
              },
              { status: 500 }
            );
          }
        }
      }

      const { error: updateError } = await supabase
        .from("bets")
        .update({
          status: result,
          profit,
          settled_at: new Date().toISOString(),
        })
        .eq("id", bet.id)
        .eq("status", "pending");

      if (updateError) {
        return NextResponse.json(
          {
            error: "Error actualizando apuesta",
            bet_id: bet.id,
            details: updateError.message,
          },
          { status: 500 }
        );
      }

      settledCount += 1;
      settledBetsSummary.push({
        bet_id: bet.id,
        result,
        winner: winnerName,
      });
    }

    return NextResponse.json({
      ok: true,
      settled: settledCount,
      sample: settledBetsSummary.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
