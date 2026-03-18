/**
 * ABNable — Email Notifications via Resend
 * Sign up free at resend.com — 100 emails/day free tier
 * Set env var: RESEND_API_KEY=re_xxxxxxxxxxxx
 * Set env var: FROM_EMAIL=leads@abnable.com.au (verify domain in Resend)
 */

const RESEND_BASE = 'https://api.resend.com';
const FROM = process.env.FROM_EMAIL || 'ABNable <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'YOUR_RESEND_KEY') {
    console.log(`[Email DEMO] To: ${to} | Subject: ${subject}`);
    return { id: 'demo-' + Date.now(), demo: true };
  }

  const res = await fetch(`${RESEND_BASE}/emails`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ============================================================
// EMAIL 1: Broker lead notification
// Sent to broker the moment a borrower submits their details
// ============================================================
export async function sendBrokerLeadEmail({ broker, borrower, match }) {
  const subject = `🔔 New lead: ${borrower.name} — ${match.lender} — ${match.loan}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: #f4f1eb; margin: 0; padding: 32px 16px; }
    .card { background: white; border-radius: 16px; max-width: 560px; margin: 0 auto; overflow: hidden; }
    .header { background: #1a6b3c; padding: 24px 32px; }
    .logo { font-size: 22px; font-weight: 700; color: white; letter-spacing: -0.5px; }
    .logo span { color: #c8873a; }
    .tag { display: inline-block; background: rgba(255,255,255,.15); color: white; font-size: 11px; padding: 3px 10px; border-radius: 20px; margin-top: 8px; }
    .body { padding: 28px 32px; }
    h2 { font-size: 20px; color: #0f1a12; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #7a8f7d; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ede9e0; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #7a8f7d; }
    .val { font-weight: 500; color: #0f1a12; }
    .val-green { font-weight: 600; color: #1a6b3c; }
    .highlight { background: #e8f4ed; border-radius: 12px; padding: 16px 20px; margin: 20px 0; }
    .highlight-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #1a6b3c; margin-bottom: 8px; }
    .btn { display: block; background: #1a6b3c; color: white; text-decoration: none; padding: 14px 24px; border-radius: 40px; text-align: center; font-weight: 500; font-size: 15px; margin-top: 24px; }
    .docs { background: #fdf0e3; border-radius: 12px; padding: 16px 20px; margin: 16px 0; }
    .doc-item { font-size: 13px; color: #3d5040; padding: 3px 0; }
    .footer { padding: 16px 32px; font-size: 12px; color: #7a8f7d; background: #f4f1eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">ABN<span>able</span></div>
      <div class="tag">New borrower lead</div>
    </div>
    <div class="body">
      <h2>New lead matched to you</h2>
      <p class="sub">A borrower completed the ABNable intake and was matched to your lender specialisation.</p>

      <div class="row"><span class="label">Name</span><span class="val">${borrower.name}</span></div>
      <div class="row"><span class="label">Mobile</span><span class="val">${borrower.phone}</span></div>
      <div class="row"><span class="label">Email</span><span class="val">${borrower.email}</span></div>
      <div class="row"><span class="label">Business type</span><span class="val">${borrower.bizType}</span></div>
      <div class="row"><span class="label">ABN age</span><span class="val">${borrower.abnAge}</span></div>
      ${borrower.abnName ? `<div class="row"><span class="label">Business name</span><span class="val">${borrower.abnName}</span></div>` : ''}

      <div class="highlight">
        <div class="highlight-title">Best lender match</div>
        <div class="row" style="border:none;padding:4px 0;"><span class="label">Lender</span><span class="val-green">${match.lender}</span></div>
        <div class="row" style="border:none;padding:4px 0;"><span class="label">Loan amount</span><span class="val-green">${match.loan}</span></div>
        <div class="row" style="border:none;padding:4px 0;"><span class="label">Rate from</span><span class="val-green">${match.rate}% p.a.</span></div>
        <div class="row" style="border:none;padding:4px 0;"><span class="label">Max LVR</span><span class="val">${match.lvr}%</span></div>
        <div class="row" style="border:none;padding:4px 0;"><span class="label">Track</span><span class="val">${match.track}</span></div>
      </div>

      <div class="docs">
        <div class="highlight-title" style="color:#c8873a;">Documents borrower has ready</div>
        ${(match.docs || []).map(d => `<div class="doc-item">✓ ${d}</div>`).join('\n')}
      </div>

      <p style="font-size:13px;color:#3d5040;">⏱ <strong>Respond within 1 business day</strong> — borrowers who receive fast callbacks convert at 3x the rate.</p>

      <a href="https://abnable.vercel.app/platform" class="btn">View in broker platform →</a>
    </div>
    <div class="footer">
      You received this because ${borrower.name} was matched to your broker profile on ABNable.<br>
      <a href="https://abnable.vercel.app/brokers" style="color:#1a6b3c;">Manage your profile</a>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to: broker.email, subject, html });
}

// ============================================================
// EMAIL 2: Borrower confirmation
// Sent to borrower after they submit — confirms next steps
// ============================================================
export async function sendBorrowerConfirmationEmail({ borrower, match, broker }) {
  const subject = `Your ABNable match report — ${match.lender}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: #f4f1eb; margin: 0; padding: 32px 16px; }
    .card { background: white; border-radius: 16px; max-width: 560px; margin: 0 auto; overflow: hidden; }
    .header { background: #1a6b3c; padding: 28px 32px; }
    .logo { font-size: 22px; font-weight: 700; color: white; }
    .logo span { color: #c8873a; }
    .greeting { color: rgba(255,255,255,.85); margin-top: 8px; font-size: 15px; }
    .body { padding: 28px 32px; }
    h2 { font-size: 20px; color: #0f1a12; margin: 0 0 8px; }
    .match-card { background: #e8f4ed; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .match-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #1a6b3c; margin-bottom: 12px; }
    .match-lender { font-size: 22px; font-weight: 700; color: #1a6b3c; }
    .match-rate { font-size: 15px; color: #3d5040; margin-top: 4px; }
    .step { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
    .step-num { width: 28px; height: 28px; background: #1a6b3c; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .step-text { font-size: 14px; color: #3d5040; line-height: 1.6; }
    .step-title { font-weight: 600; color: #0f1a12; }
    .broker-card { background: #f4f1eb; border-radius: 12px; padding: 16px 20px; margin: 20px 0; }
    .btn { display: block; background: #1a6b3c; color: white; text-decoration: none; padding: 14px 24px; border-radius: 40px; text-align: center; font-weight: 500; font-size: 15px; margin-top: 24px; }
    .footer { padding: 16px 32px; font-size: 12px; color: #7a8f7d; background: #f4f1eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">ABN<span>able</span></div>
      <div class="greeting">Hi ${borrower.name.split(' ')[0]}, your results are ready</div>
    </div>
    <div class="body">
      <h2>Your best lender match</h2>
      <p style="font-size:14px;color:#7a8f7d;margin-bottom:0;">Based on your ABN history, income structure, and loan requirements</p>

      <div class="match-card">
        <div class="match-title">Top match</div>
        <div class="match-lender">${match.lender}</div>
        <div class="match-rate">From ${match.rate}% p.a. · Up to ${match.lvr}% LVR · ${match.track} track</div>
      </div>

      <p style="font-size:15px;font-weight:600;color:#0f1a12;margin-bottom:16px;">What happens next</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">
          <div class="step-title">Your broker will call you within 1 business day</div>
          ${broker.name} from ${broker.biz} has your match report and will reach out to ${borrower.phone}.
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">
          <div class="step-title">Gather your documents</div>
          Start pulling together your ${match.track === 'PAYG' ? '3 recent payslips and 3 months bank statements' : 'BAS statements, tax returns, and accountant letter'}. Your broker will confirm exactly what ${match.lender} needs.
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">
          <div class="step-title">No credit check until you're ready</div>
          Nothing has been submitted to any lender. Your credit file is untouched until you give the green light.
        </div>
      </div>

      ${broker ? `
      <div class="broker-card">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7a8f7d;margin-bottom:8px;">Your matched broker</div>
        <div style="font-size:15px;font-weight:600;color:#0f1a12;">${broker.name}</div>
        <div style="font-size:13px;color:#7a8f7d;">${broker.biz} · ${broker.phone}</div>
      </div>` : ''}

      <a href="https://abnable.vercel.app/calculator" class="btn">Run full borrowing calculator →</a>
    </div>
    <div class="footer">
      ABNable · Home loans that actually work for the self-employed<br>
      <a href="https://abnable.vercel.app" style="color:#1a6b3c;">abnable.vercel.app</a>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to: borrower.email, subject, html });
}

// ============================================================
// EMAIL 3: Doc chase reminder
// Sent to borrower 3 days after lead if docs not submitted
// ============================================================
export async function sendDocChaseEmail({ borrower, match, broker }) {
  const subject = `Quick reminder — ${match.lender} application`;
  const docsNeeded = match.track === 'PAYG'
    ? ['3 recent payslips', '3 months bank statements', 'Employment contract (if available)']
    : ['2 years tax returns', '4 BAS statements', 'Accountant letter', '6 months bank statements'];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: #f4f1eb; margin: 0; padding: 32px 16px; }
    .card { background: white; border-radius: 16px; max-width: 560px; margin: 0 auto; overflow: hidden; }
    .header { background: #c8873a; padding: 24px 32px; }
    .logo { font-size: 22px; font-weight: 700; color: white; }
    .body { padding: 28px 32px; }
    .doc { display: flex; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid #ede9e0; font-size: 14px; color: #3d5040; }
    .btn { display: block; background: #1a6b3c; color: white; text-decoration: none; padding: 14px 24px; border-radius: 40px; text-align: center; font-weight: 500; font-size: 15px; margin-top: 24px; }
    .footer { padding: 16px 32px; font-size: 12px; color: #7a8f7d; background: #f4f1eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">ABNable</div>
    </div>
    <div class="body">
      <h2 style="font-size:20px;color:#0f1a12;margin:0 0 8px;">Hi ${borrower.name.split(' ')[0]} — just checking in</h2>
      <p style="font-size:14px;color:#7a8f7d;">Your ${match.lender} application is ready to go — we just need a few documents to proceed.</p>

      <p style="font-size:14px;font-weight:600;color:#0f1a12;margin-bottom:4px;">Documents needed:</p>
      ${docsNeeded.map(d => `<div class="doc">📄 ${d}</div>`).join('')}

      <p style="font-size:13px;color:#7a8f7d;margin-top:16px;">Questions? Call ${broker.name} directly on ${broker.phone}.</p>

      <a href="https://abnable.vercel.app" class="btn">Return to ABNable →</a>
    </div>
    <div class="footer">ABNable · <a href="#" style="color:#1a6b3c;">Unsubscribe</a></div>
  </div>
</body>
</html>`;

  return sendEmail({ to: borrower.email, subject, html });
}
