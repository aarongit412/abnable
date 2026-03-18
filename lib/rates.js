/**
 * ABNable — Live CDR Rates
 * Fetches live mortgage rates from Australian lender CDR endpoints.
 * Public API — no auth required. Cached for 4 hours.
 */

const CDR_LENDERS = {
  liberty:   { name: 'Liberty Financial',  url: 'https://services.liberty.com.au/api/data-holder-public/cds-au/v1', specialist: true },
  macquarie: { name: 'Macquarie Bank',     url: 'https://api.macquariebank.io/cds-au/v1',                           specialist: false },
  anz:       { name: 'ANZ',                url: 'https://api.anz/cds-au/v1',                                        specialist: false },
  cba:       { name: 'Commonwealth Bank',  url: 'https://api.commbank.com.au/public/cds-au/v1',                     specialist: false },
  nab:       { name: 'NAB',               url: 'https://openbank.api.nab.com.au/cds-au/v1',                        specialist: false },
  westpac:   { name: 'Westpac',           url: 'https://digital-api.westpac.com.au/cds-au/v1',                     specialist: false },
};

// Fallback rates when CDR unavailable — updated manually from lender sites
const FALLBACK_RATES = {
  pepper:    { name: 'Pepper Money',      variable: 6.49, comparison: 6.85, specialist: true },
  latrobe:   { name: 'La Trobe',          variable: 7.15, comparison: 7.52, specialist: true },
  liberty:   { name: 'Liberty Financial', variable: 6.74, comparison: 7.12, specialist: true },
  bluestone: { name: 'Bluestone',         variable: 7.35, comparison: 7.71, specialist: true },
  macquarie: { name: 'Macquarie Bank',    variable: 6.19, comparison: 6.41, specialist: false },
  anz:       { name: 'ANZ',               variable: 6.29, comparison: 6.52, specialist: false },
};

// In-memory cache
let rateCache = null;
let rateCacheTime = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function getLiveRates() {
  // Return cache if fresh
  if (rateCache && Date.now() - rateCacheTime < CACHE_TTL) {
    return rateCache;
  }

  const results = await Promise.allSettled(
    Object.entries(CDR_LENDERS).map(([id, lender]) =>
      fetchLenderRates(id, lender)
    )
  );

  const rates = { ...FALLBACK_RATES }; // start with fallbacks
  let liveCount = 0;

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      rates[r.value.id] = r.value;
      liveCount++;
    }
  });

  rateCache = {
    rates,
    liveCount,
    totalLenders: Object.keys(rates).length,
    updatedAt: new Date().toISOString(),
    source: liveCount > 0 ? 'cdr_live' : 'fallback',
  };
  rateCacheTime = Date.now();

  console.log(`[CDR] Fetched ${liveCount} live rates, ${Object.keys(rates).length - liveCount} from fallback`);
  return rateCache;
}

async function fetchLenderRates(id, lender) {
  try {
    const res = await fetch(
      `${lender.url}/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25`,
      {
        headers: { 'x-v': '3', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const products = json?.data?.products || [];
    if (!products.length) return null;

    // Extract best variable rate
    let bestVariable = null;
    let bestComparison = null;

    for (const p of products) {
      for (const r of (p.lendingRates || p.lending_rates || [])) {
        const rate = parseFloat(r.rate) * 100;
        if (rate < 2 || rate > 20) continue; // sanity check
        if (r.lendingRateType === 'VARIABLE' && (!bestVariable || rate < bestVariable)) {
          bestVariable = rate;
        }
        if (r.lendingRateType === 'COMPARISON' && (!bestComparison || rate < bestComparison)) {
          bestComparison = rate;
        }
      }
    }

    if (!bestVariable) return null;

    return {
      id,
      name: lender.name,
      variable: parseFloat(bestVariable.toFixed(2)),
      comparison: bestComparison ? parseFloat(bestComparison.toFixed(2)) : null,
      specialist: lender.specialist,
      source: 'cdr_live',
      productCount: products.length,
    };
  } catch (err) {
    console.warn(`[CDR] ${id} failed:`, err.message);
    return null;
  }
}

export function getRateForLender(rates, lenderId) {
  return rates[lenderId]?.variable || FALLBACK_RATES[lenderId]?.variable || null;
}
