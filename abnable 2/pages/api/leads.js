// pages/api/leads.js
// POST /api/leads
import { sendBrokerLeadEmail, sendBorrowerConfirmationEmail } from '../../lib/email';

// In-memory lead store — replace with database (Vercel Postgres, PlanetScale etc) in production
const leads = [];

export default async function handler(req, res) {
  if (req.method === 'POST') return handleCreate(req, res);
  if (req.method === 'GET') return handleList(req, res);
  return res.status(405).end();
}

async function handleCreate(req, res) {
  const { borrower, match, broker } = req.body;

  // Validate required fields
  if (!borrower?.name || !borrower?.phone || !borrower?.email) {
    return res.status(400).json({ error: 'borrower name, phone and email required' });
  }
  if (!match?.lender) {
    return res.status(400).json({ error: 'match.lender required' });
  }

  const lead = {
    id: 'LEAD-' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    status: 'new',
    borrower,
    match,
    broker: broker || { name: 'ABNable Team', biz: 'ABNable', phone: '1300 226 253', email: process.env.DEFAULT_BROKER_EMAIL || 'leads@abnable.com.au' },
  };

  leads.push(lead);
  console.log(`[Lead] Created ${lead.id} — ${borrower.name} → ${match.lender}`);

  // Send emails in parallel — don't let email failure block the response
  const emailResults = await Promise.allSettled([
    sendBrokerLeadEmail({ broker: lead.broker, borrower, match }),
    sendBorrowerConfirmationEmail({ borrower, match, broker: lead.broker }),
  ]);

  emailResults.forEach((r, i) => {
    const type = i === 0 ? 'broker' : 'borrower';
    if (r.status === 'fulfilled') {
      console.log(`[Email] ${type} email sent — id: ${r.value?.id}`);
    } else {
      console.error(`[Email] ${type} email failed:`, r.reason?.message);
    }
  });

  res.status(201).json({
    success: true,
    leadId: lead.id,
    emailsSent: emailResults.filter(r => r.status === 'fulfilled').length,
  });
}

async function handleList(req, res) {
  // Simple auth — check for admin key
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.status(200).json({ leads, total: leads.length });
}
