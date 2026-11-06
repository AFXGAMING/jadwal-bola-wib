// Server-side proxy: API key stays in Netlify environment variables.
exports.handler = async (event) => {
  const key = process.env.API_FOOTBALL_KEY;

  if (!key) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "API_FOOTBALL_KEY belum diatur di Netlify."
      })
    };
  }

  const date = event.queryStringParameters &&
    event.queryStringParameters.date;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Parameter date harus berformat YYYY-MM-DD."
      })
    };
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Asia/Jakarta`,
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
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Gagal mengambil jadwal pertandingan.",
        detail: error.message
      })
    };
  }
};
