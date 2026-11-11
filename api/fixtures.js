// Vercel Serverless Function: proxy API-Football (jadwal per tanggal).
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

  const date = req.query && req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error: "Parameter date harus berformat YYYY-MM-DD."
    });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Asia/Jakarta`,
      { headers: { "x-apisports-key": key } }
    );
    const data = await response.json();
    data.fetched_at = new Date().toISOString();

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
      error: "Gagal mengambil jadwal pertandingan.",
      detail: error.message
    });
  }
};
