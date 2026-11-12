module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ error: "Method tidak diizinkan." });
  }

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "API_FOOTBALL_KEY belum diatur." });
  }

  const fixture = String(req.query?.fixture || "");
  if (!/^\d+$/.test(fixture)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ error: "ID pertandingan tidak valid." });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${encodeURIComponent(fixture)}`,
      { headers: { "x-apisports-key": key } }
    );

    const data = await response.json();
    res.setHeader(
      "Cache-Control",
      response.ok
        ? "public, max-age=0, s-maxage=300, stale-while-revalidate=60"
        : "no-store"
    );
    return res.status(response.status).json(data);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "Gagal mengambil statistik pertandingan.",
      detail: error.message
    });
  }
};
