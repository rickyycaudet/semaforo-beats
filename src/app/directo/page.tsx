import AuthGate from "../../components/AuthGate";

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

export default async function DirectoPage() {
  const liveMatches = await getLiveMatches();

  return (
    <AuthGate>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Apuestas en directo
          </h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Aquí verás los partidos que están en juego ahora mismo y su marcador.
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
            {liveMatches.map((match) => (
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
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGate>
  );
}
