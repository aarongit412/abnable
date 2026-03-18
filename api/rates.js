const CDR_LENDERS = {
  liberty:   { name: 'Liberty Financial',  url: 'https://services.liberty.com.au/api/data-holder-public/cds-au/v1' },
  macquarie: { name: 'Macquarie Bank',     url: 'https://api.macquariebank.io/cds-au/v1' },
  anz:       { name: 'ANZ',                url: 'https://api.anz/cds-au/v1' },
  cba:       { name: 'Commonwealth Bank',  url: 'https://api.commbank.com.au/public/cds-au/v1' },
};

const FALLBACK = {
  pepper:    { name: 'Pepper Money',      variable: 6.49 },
  latrobe:   { name: 'La Trobe',          variable: 7.15 },
  liberty:   { name: 'Liberty Financial', variable: 6.74 },
  bluestone: { name: 'Bluestone',         variable: 7.35 },
  macquarie: { name: 'Macquarie Bank',    variable: 6.19 },
  anz:       { name: 'ANZ',               variable: 6.29 },
};

let cache = null;
let cacheTime = 0;

async function fetchRates(id, url) {
  try {
    const res = await fetch(
      `${url}/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25`,
      { headers: { 'x-v': '3', 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const products = json?.data?.products || [];
    let best = null;
    for (const p of products) {
      for (const r of (p.lendingRates || [])) {
        const rate = parseFloat(r.rate) * 100;
        if (r.lendingRateType === 'VARIABLE' && rate > 2 && rate < 20) {
          if (!best || rate < best) best = rate;
        }
      }
    }
    return best ? { id, name: CDR_LENDERS[id].name, variable: parseFloat(best.toFixed(2)), source: 'cdr_live' } : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cache && Date.now() - cacheTime < 4 * 60 * 60 * 1000) {
    return res.json(cache);
  }
  const results = await Promise.allSettled(
    Object.entries(CDR_LENDERS).map(([id, l]) => fetchRates(id, l.url))
  );
  const rates = { ...FALLBACK };
  let liveCount = 0;
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      rates[r.value.id] = r.value;
      liveCount++;
    }
  });
  cache = { rates, liveCount, updatedAt: new Date().toISOString() };
  cacheTime = Date.now();
  res.setHeader('Cache-Control', 's-maxage=14400');
  res.json(cache);
}
