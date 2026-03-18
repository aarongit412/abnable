export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { borrower, match, broker } = req.body;
  if (!borrower?.name || !borrower?.email) {
    return res.status(400).json({ error: 'borrower name and email required' });
  }

  const lead = {
    id: 'LEAD-' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    borrower, match, broker
  };

  console.log('[ABNable Lead]', JSON.stringify(lead));

  // Send email via Resend if key configured
  const resendKey = process.env.RESEND_API_KEY;
  const brokerEmail = broker?.email || process.env.DEFAULT_BROKER_EMAIL;

  if (resendKey && brokerEmail) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ABNable <onboarding@resend.dev>',
          to: brokerEmail,
          subject: `🔔 New lead: ${borrower.name} → ${match?.lender || 'matched lender'}`,
          html: `<h2>New ABNable Lead</h2>
            <p><strong>Name:</strong> ${borrower.name}</p>
            <p><strong>Phone:</strong> ${borrower.phone}</p>
            <p><strong>Email:</strong> ${borrower.email}</p>
            <p><strong>Business:</strong> ${borrower.bizType}</p>
            <p><strong>ABN age:</strong> ${borrower.abnAge}</p>
            <p><strong>Best lender:</strong> ${match?.lender}</p>
            <p><strong>Loan amount:</strong> ${match?.loan}</p>
            <p><strong>Track:</strong> ${match?.track}</p>
            <br><a href="https://abnable.vercel.app/platform">View in broker platform →</a>`
        })
      });
    } catch(e) { console.error('Email failed:', e.message); }
  }

  res.status(201).json({ success: true, leadId: lead.id });
}
