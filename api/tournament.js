module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method tidak diizinkan."
    });
  }

  const key = process.env.API_NINJAS_KEY;

  if (!key) {
    return res.status(500).json({
      error: "API_NINJAS_KEY belum diatur di Vercel."
    });
  }

  const league = String(req.query?.league || "");
  const season = String(req.query?.season || "2026");
  const offset = String(req.query?.offset || "0");

  const allowedLeagues = [
    "facup", "eflcup", "copadelrey",
    "dfbpokal", "coppaitalia", "coupedefrance",
    "ucl", "uel", "uecl", "libertadores",
    "sudamericana", "worldcup", "euro", "asiancup"
  ];

  if (!allowedLeagues.includes(league)) {
    return res.status(400).json({
      error: "Kompetisi turnamen tidak didukung."
    });
  }

  if (!/^\d{4}$/.test(season) || !/^\d+$/.test(offset)) {
    return res.status(400).json({
      error: "Season atau offset tidak valid."
    });
  }

  try {
    const url = new URL(
      "https://api.api-ninjas.com/v1/soccermatches"
    );

    url.searchParams.set("league", league);
    url.searchParams.set("season", season);
    url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { "X-Api-Key": key }
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }

    res.setHeader(
      "Cache-Control",
      response.ok
        ? "public, max-age=0, s-maxage=1800"
        : "no-store"
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "API Ninjas gagal mengambil pertandingan.",
        detail: data
      });
    }

    if (!Array.isArray(data)) {
      return res.status(502).json({
        error: "Format data pertandingan tidak sesuai."
      });
    }

    return res.status(200).json({
      provider: "API Ninjas",
      league,
      season: Number(season),
      offset: Number(offset),
      count: data.length,
      matches: data
    });

  } catch (error) {
    return res.status(500).json({
      error: "Gagal menghubungi API Ninjas.",
      detail: error.message
    });
  }
};
