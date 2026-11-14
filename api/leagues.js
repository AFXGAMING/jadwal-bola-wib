// Daftar kompetisi pilihan dari Highlightly.
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method tidak diizinkan." });
  }

  const season = Number(req.query?.season || new Date().getFullYear());

  if (!Number.isInteger(season) || season < 1900 || season > 2100) {
    return res.status(400).json({ error: "Musim tidak valid." });
  }

  const fallbackLeagues = [
    { id: 33973, name: "Premier League", type: "League", country: "England", season },
    { id: 119924, name: "La Liga", type: "League", country: "Spain", season },
    { id: 115669, name: "Serie A", type: "League", country: "Italy", season },
    { id: 67162, name: "Bundesliga", type: "League", country: "Germany", season },
    { id: 52695, name: "Ligue 1", type: "League", country: "France", season },
    { id: 2486, name: "UEFA Champions League", type: "Cup", country: "World", season },
    { id: 1064534, name: "League Cup Indonesia", type: "Cup", country: "Indonesia", season },
    { id: 233958, name: "Liga 1", type: "League", country: "Indonesia", season },
    { id: 787108, name: "Piala Presiden", type: "Cup", country: "Indonesia", season }
  ];

  const sendFallback = () => {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=21600, stale-while-revalidate=3600");
    return res.status(200).json({
      provider: "Local fallback",
      fetched_at: null,
      season,
      count: fallbackLeagues.length,
      response: fallbackLeagues
    });
  };

  const key = process.env.HIGHLIGHTLY_API_KEY;

  if (!key) {
    return sendFallback();
  }

  const allowedCompetitions = new Map([
    ["england|premier league", { order: 1, type: "League" }],
    ["spain|la liga", { order: 2, type: "League" }],
    ["italy|serie a", { order: 3, type: "League" }],
    ["germany|bundesliga", { order: 4, type: "League" }],
    ["france|ligue 1", { order: 5, type: "League" }],
    ["world|uefa champions league", { order: 6, type: "Cup" }],
    ["indonesia|league cup indonesia", { order: 7, type: "Cup" }],
    ["indonesia|liga 1", { order: 8, type: "League" }],
    ["indonesia|piala presiden", { order: 9, type: "Cup" }]
  ]);

  const baseUrl = "https://sports.highlightly.net/football/leagues";
  const limit = 100;

  try {
    const leagues = [];
    let offset = 0;
    let totalCount = Infinity;

    while (offset < totalCount && offset < 2000) {
      const params = new URLSearchParams({
        season: String(season),
        limit: String(limit),
        offset: String(offset)
      });

      const response = await fetch(`${baseUrl}?${params}`, {
        headers: { "x-rapidapi-key": key }
      });

      const data = await response.json();

      if (!response.ok) {
        return sendFallback();
      }

      if (!Array.isArray(data.data)) {
        return res.status(502).json({
          error: "Format daftar kompetisi Highlightly tidak sesuai."
        });
      }

      totalCount = Number(
        data.pagination?.totalCount ?? offset + data.data.length
      );

      for (const item of data.data) {
        const hasSeason = (item.seasons || []).some(
          entry => Number(entry.season) === season
        );

        if (!item.id || !item.name || !hasSeason) continue;

        const country = item.country?.name || "";
        const competitionKey =
          `${country.toLowerCase()}|${item.name.trim().toLowerCase()}`;

        const config = allowedCompetitions.get(competitionKey);
        if (!config) continue;

        leagues.push({
          id: Number(item.id),
          name: item.name,
          type: config.type,
          country,
          season
        });
      }

      if (data.data.length < limit) break;
      offset += limit;
    }

    leagues.sort((a, b) => {
      const keyA = `${a.country.toLowerCase()}|${a.name.toLowerCase()}`;
      const keyB = `${b.country.toLowerCase()}|${b.name.toLowerCase()}`;

      return allowedCompetitions.get(keyA).order -
        allowedCompetitions.get(keyB).order;
    });

    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=21600, stale-while-revalidate=3600"
    );

    return res.status(200).json({
      provider: "Highlightly",
      fetched_at: new Date().toISOString(),
      season,
      count: leagues.length,
      response: leagues
    });

  } catch (error) {
    return sendFallback();
  }
};
