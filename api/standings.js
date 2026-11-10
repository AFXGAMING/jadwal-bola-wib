
// Vercel Serverless Function
// Klasemen dari API Ninjas

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.API_NINJAS_KEY;

  if (!key) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "API_NINJAS_KEY belum diatur di Vercel."
    });
  }

  const league = req.query?.league;

  const allowedLeagues = [
    "epl",
    "laliga",
    "bundesliga",
    "seriea",
    "ligue1",
    "ucl",
    "uel",
    "mls"
  ];

  if (!allowedLeagues.includes(league)) {
    return res.status(400).json({
      error: "Kode kompetisi tidak didukung."
    });
  }

  try {
    const response = await fetch(
      `https://api.api-ninjas.com/v1/soccerstandings?league=${league}`,
      {
        headers: {
          "X-Api-Key": key
        }
      }
    );

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

    if (!response.ok) {
      return res.status(response.status).json({
        error: "API Ninjas gagal mengambil klasemen.",
        detail: data
      });
    }

    if (!Array.isArray(data)) {
      return res.status(502).json({
        error: "Format data klasemen tidak sesuai."
      });
    }

    return res.status(200).json({
      provider: "API Ninjas",
      league,
      season: data[0]?.season ?? null,
      season_label: data[0]?.season_label ?? null,
      response: data
    });

  } catch (error) {
    res.setHeader("Cache-Control", "no-store");

    return res.status(500).json({
      error: "Gagal menghubungi API Ninjas.",
      detail: error.message
    });
  }
};

