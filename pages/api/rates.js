// pages/api/rates.js
// GET /api/rates
import { getLiveRates } from '../../lib/rates';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const data = await getLiveRates();
    // Cache 4 hours
    res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
