import AuthGate from "../../components/AuthGate";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type ScoreItem = {
  name: string;
  score: string | number | null;
};

type LiveEvent = {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time?: string;
  completed?: boolean;
  home_team?: string;
  away_team?: string;
  scores?: ScoreItem[] | null;
};

type DisplayMatch = {
  id: string;
  league: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  commenceTime: string;
};

type UserBet = {
  id: string;
  event_label: string;
  pick_label: string;
  stake: number;
  odds_taken: number;
  status: "pending" | "won" | "lost" | "void";
  profit: number;
};

const SOCCER_KEYS = [
  "soccer_spain_la_liga",
  "soccer_epl",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function findScore(
  scores: ScoreItem[] | null | undefined,
  teamName: string | null | undefined
) {
  if (!scores || !teamName) return "-";

  const row = scores.find(
    (item) => normalizeText(item.name) === normalizeText(teamName)
  );

  if (!row || row.score === null || row.score === undefined || row.score === "") {
    return "-";
  }

  return String(row.score);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estadoBonito(status: UserBet["status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "won") return "Ganada";
  if (status === "lost") return "Perdida";
  return "Anulada";
}

async function getLiveMatches(): Promise<DisplayMatch[]> {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) return [];

  const now = Date.now();

  const requests = SOCCER_KEYS.map(async (sportKey) => {
    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/scores` +
      `?apiKey=${apiKey}&daysFrom=1&dateFormat=iso`;

    const res = await fetch(url, {
      cache: "no-store",
    });

    if (!res.ok) {
      return [] as LiveEvent[];
    }

    const data = (await res.json()) as LiveEvent[];
    return data;
  });

  const results = await Promise.all(requests);
  const flat = results.flat();

  const liveOnly = flat.filter((event) => {
    if (event.completed) return false;
    if (!event.commence_time) return false;

    const started = new Date(event.commence_time).getTime() <= now;
    const hasAnyScore =
      Array.isArray(event.scores) &&
      event.scores.some(
        (s) => s.score !== null && s.score !== undefined && String(s.score) !== ""
      );

    return started || hasAnyScore;
  });

  const mapped = liveOnly.map((event) => ({
    id: event.id,
    league: event.sport_title || event.sport_key,
    sportKey: event.sport_key,
    homeTeam: event.home_team || "Local",
    awayTeam: event.away_team || "Visitante",
    homeScore: findScore(event.scores, event.home_team),
    awayScore: findScore(event.scores, event.away_team),
    commenceTime: event.commence_time || "",
  }));

  return mapped.sort((a, b) => {
    return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
  });
}

async function getUserBets(): Promise<UserBet[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });

  const { data } = await supabase
    .from("bets")
    .select("id,event_label,pick_label,stake,odds_taken,status,profit")
    .order("placed_at", { ascending: false });

  return (data ?? []) as UserBet[];
}

function matchBetsForLiveGame(match: DisplayMatch, bets: UserBet[]) {
  const home = normalizeText(match.homeTeam);
  const away = normalizeText(match.awayTeam);

  return bets.filter((bet) => {
    const label = normalizeText(bet.event_label);
    return label.includes(home) && label.includes(away);
  });
}

export default async function DirectoPage() {
  const [liveMatches, userBets] = await Promise.all([
    getLiveMatches(),
    getUserBets(),
  ]);

  return (
    <AuthGate>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Apuestas en directo
          </h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Aquí verás los partidos que están en juego ahora mismo, su marcador y tus apuestas relacionadas.
          </p>
        </div>

        {liveMatches.length === 0 ? (
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 16,
            }}
          >
            Ahora mismo no hay partidos en directo disponibles.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {liveMatches.map((match) => {
              const relatedBets = matchBetsForLiveGame(match, userBets);

              return (
                <div
                  key={match.id}
                  style={{
                    background: "white",
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 16,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#666" }}>
                    🔴 EN DIRECTO · {match.league} · {formatDate(match.commenceTime)}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>
                        {match.homeTeam}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                        {match.awayTeam}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 72,
                        textAlign: "center",
                        borderRadius: 12,
                        background: "#f8fafc",
                        border: "1px solid #e5e7eb",
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {match.homeScore} - {match.awayScore}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
                      Tus apuestas en este partido
                    </div>

                    {relatedBets.length === 0 ? (
                      <div style={{ color: "#666", fontSize: 14 }}>
                        No tienes apuestas guardadas en este partido.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {relatedBets.map((bet) => (
                          <div
                            key={bet.id}
                            style={{
                              border: "1px solid #eee",
                              borderRadius: 12,
                              padding: 12,
                              background: "#fafafa",
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{bet.pick_label}</div>
                            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                              Cantidad apostada: {Number(bet.stake).toFixed(2)}€ ·
                              Cuota: {Number(bet.odds_taken).toFixed(2)} ·
                              Estado: {estadoBonito(bet.status)}
                            </div>
                            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                              Ganancia / pérdida: {Number(bet.profit).toFixed(2)}€
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AuthGate>
  );
}
