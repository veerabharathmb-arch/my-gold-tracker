// Netlify serverless function: fetch daily SETFGOLD.NS history server-side.
// Yahoo Finance is an unofficial source; this endpoint is not guaranteed.
exports.handler = async function () {
  const symbol = 'SETFGOLD.NS';
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const errors = [];

  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${symbol}?range=1y&interval=1d&includePrePost=false&events=div%2Csplits`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MyGoldTracker/1.0)'
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Yahoo returned HTTP ${response.status}`);
      const payload = await response.json();
      const result = payload && payload.chart && payload.chart.result && payload.chart.result[0];
      if (!result) {
        const description = payload && payload.chart && payload.chart.error && payload.chart.error.description;
        throw new Error(description || 'Yahoo returned an unexpected response');
      }
      const timestamps = result.timestamp || [];
      const closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
      const rows = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = Number(closes[i]);
        if (closes[i] === null || closes[i] === undefined || !Number.isFinite(close) || close <= 0) continue;
        const date = new Date(timestamps[i] * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        rows.push({ date, close: Number(close.toFixed(4)) });
      }
      if (!rows.length) throw new Error('Yahoo returned no daily closing prices');
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0'
        },
        body: JSON.stringify({ symbol, source: 'Yahoo Finance chart (unofficial)', fetchedAt: new Date().toISOString(), rows })
      };
    } catch (error) {
      errors.push(error && error.name === 'AbortError' ? 'Yahoo request timed out' : (error.message || 'Yahoo request failed'));
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    statusCode: 502,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ error: 'The server could not retrieve SETFGOLD daily prices. ' + errors.join('; ') })
  };
};
