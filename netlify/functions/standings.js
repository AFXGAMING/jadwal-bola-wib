
exports.handler = async (event) => {
  const key = process.env.API_FOOTBALL_KEY;

  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "API_FOOTBALL_KEY belum diatur di Netlify."
      })
    };
  }

  const league = event.queryStringParameters?.league;
  const season = event.queryStringParameters?.season;

  if (
    !/^\d+$/.test(league || "") ||
    !/^\d{4}$/.test(season || "")
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Parameter league atau season tidak valid."
      })
    };
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`,
      {
        headers: {
          "x-apisports-key": key
        }
      }
    );

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": response.ok
          ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=600"
          : "no-store"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Gagal mengambil data klasemen.",
        detail: error.message
      })
    };
  }
};
