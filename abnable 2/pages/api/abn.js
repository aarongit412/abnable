// pages/api/abn.js
// GET /api/abn?abn=51824753556
import { lookupABN } from '../../lib/abn';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { abn } = req.query;
  if (!abn) return res.status(400).json({ error: 'ABN required' });

  try {
    const result = await lookupABN(abn);
    // Cache for 24 hours — ABN data doesn't change often
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
