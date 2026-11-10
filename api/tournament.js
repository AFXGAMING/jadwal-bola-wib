
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
