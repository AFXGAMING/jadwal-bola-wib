// Server-side proxy: API key stays in Netlify environment variables.
exports.handler = async (event) => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'API_FOOTBALL_KEY belum diatur di Netlify.' }) };
  }
  const date = event.queryStringParameters && event.queryStringParameters.date;
  if (!date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Parameter date harus berformat YYYY-MM-DD.' }) };
  }
  try {
    const upstream = await fetch(`https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Asia/Jakarta`, {
      headers: { 'x-apisports-key': key, 'Accept': 'application/json' }
    });
    const body = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=300'
      },
      body
    };
  } catch (error) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Tidak dapat menghubungi API-Football.' }) };
  }
};
 
