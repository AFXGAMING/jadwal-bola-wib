// Vercel Serverless Function: proxy API-Football (klasemen).
// API key dibaca dari Environment Variable API_FOOTBALL_KEY di Vercel.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "API_FOOTBALL_KEY belum diatur di Vercel."
    });
  }

  const league = req.query && req.query.league;
  const season = req.query && req.query.season;

  if (!/^\d+$/.test(league || "") || !/^\d{4}$/.test(season || "")) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error: "Parameter league atau season tidak valid."
    });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`,
      { headers: { "x-apisports-key": key } }
    );
    const data = await response.json();

    res.setHeader(
      "Cache-Control",
      response.ok
        ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=600"
        : "no-store"
    );
    return res.status(response.status).json(data);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "Gagal mengambil data klasemen.",
      detail: error.message
    });
  }
};
