
// Vercel Serverless Function: data pertandingan satu kompetisi penuh.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.API_FOOTBALL_KEY;

  if (!key) {
    return res.status(500).json({
      error: "API_FOOTBALL_KEY belum diatur di Vercel."
    });
  }

  const league = String(req.query?.league || "");
  const season = String(req.query?.season || "");

  if (!/^\d+$/.test(league) || !/^\d{4}$/.test(season)) {
    return res.status(400).json({
      error: "Parameter league dan season wajib diisi."
    });
  }

  try {
    const url = new URL("https://v3.football.api-sports.io/fixtures");

    url.searchParams.set("league", league);
    url.searchParams.set("season", season);
    url.searchParams.set("timezone", "Asia/Jakarta");

    const response = await fetch(url, {
      headers: { "x-apisports-key": key }
    });

    const data = await response.json();

    res.setHeader(
      "Cache-Control",
      response.ok
        ? "public, max-age=0, s-maxage=1800, stale-while-revalidate=300"
        : "no-store"
    );

    return res.status(response.status).json(data);

  } catch (error) {
    res.setHeader("Cache-Control", "no-store");

    return res.status(500).json({
      error: "Gagal mengambil data turnamen.",
      detail: error.message
    });
  }
};


module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.API_NINJAS_KEY;

  if (!key) {
    return res.status(500).json({
      error: "API_NINJAS_KEY belum diatur di Vercel."
    });
  }

  const league = String(req.query?.league || "");
  const season = String(req.query?.season || "");
  const offset = String(req.query?.offset || "0");

  const allowedLeagues = [
    "ucl", "uel", "uecl",
    "facup", "eflcup", "copadelrey",
    "dfbpokal", "coppaitalia", "coupedefrance",
    "libertadores", "sudamericana",
    "worldcup", "euro", "asiancup"
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
      headers: {
        "X-Api-Key": key
      }
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



module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.API_NINJAS_KEY;

  if (!key) {
    return res.status(500).json({
      error: "API_NINJAS_KEY belum diatur di Vercel."
    });
  }

  const league = req.query?.league;
  const season = req.query?.season || "2026";
  const offset = req.query?.offset || "0";

  const allowedLeagues = [
    "facup",
    "eflcup",
    "copadelrey",
    "dfbpokal",
    "coppaitalia",
    "coupedefrance",
    "ucl",
    "uel",
    "uecl",
    "libertadores",
    "clubworldcup",
    "worldcup",
    "asiancup",
    "afcon",
    "euro"
  ];

  if (!allowedLeagues.includes(league)) {
    return res.status(400).json({
      error: "Kompetisi tidak didukung."
    });
  }

  if (!/^\d{4}$/.test(season) || !/^\d+$/.test(offset)) {
    return res.status(400).json({
      error: "Parameter season atau offset tidak valid."
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
      headers: {
        "X-Api-Key": key
      }
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
        ? "public, max-age=0, s-maxage=1800, stale-while-revalidate=300"
        : "no-store"
    );

    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({
      error: "Gagal mengambil data turnamen.",
      detail: error.message
    });
  }
};
