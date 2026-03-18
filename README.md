# ABNable — Deployment Guide

## What's in this folder

| File | URL after deploy | Purpose |
|---|---|---|
| `abnable.html` | `/` | Main borrower app — intake, matching, broker connection |
| `abnable-serviceability.html` | `/calculator` | Serviceability calculator |
| `abnable-bas-calculator.html` | `/bas` | BAS income translator |
| `abnable-report.html` | `/report` | Broker client report generator |
| `abnable-widget.html` | `/widget` | Embeddable broker widget demo |
| `abnable-platform.html` | `/platform` | Internal broker platform |
| `cdr-integration.js` | `/embed.js` | CDR API layer |

---

## Deploy to Vercel (free, 5 minutes)

### Step 1 — Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2 — Login
```bash
vercel login
```
Opens browser → log in with GitHub/email.

### Step 3 — Deploy from this folder
```bash
cd abnable
vercel --prod
```

Vercel will ask:
- **Set up and deploy?** → Y
- **Which scope?** → your account
- **Link to existing project?** → N
- **Project name?** → `abnable` (or whatever you want)
- **In which directory?** → `.` (current)
- **Want to override settings?** → N

Done. Your site is live at `https://abnable.vercel.app`

---

## Set up a custom domain (abnable.com.au)

1. Buy domain at Namecheap / GoDaddy / Crazy Domains
2. In Vercel dashboard → your project → Settings → Domains
3. Add `abnable.com.au`
4. Vercel gives you DNS records to add at your registrar
5. Takes 5–30 mins to propagate

**Recommended subdomains:**
- `abnable.com.au` → main borrower app
- `app.abnable.com.au` → broker platform
- `widget.abnable.com.au` → widget demo

---

## After deploy — wire live CDR rates

In `abnable-platform.html` and `cdr-integration.js`, the CDR calls are ready.
They were blocked in development (sandbox egress proxy) but work fine on Vercel.

Test these endpoints after deploy:
```bash
curl "https://services.liberty.com.au/api/data-holder-public/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES" -H "x-v: 3"
curl "https://api.macquariebank.io/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES" -H "x-v: 3"
curl "https://api.anz/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES" -H "x-v: 3"
```

---

## Environment variables (for future backend)

When you add a backend (leads API, email, Stripe), add these in Vercel dashboard → Settings → Environment Variables:

```
ANTHROPIC_API_KEY=sk-ant-...        # Policy AI in platform
RESEND_API_KEY=re_...               # Email delivery for reports
STRIPE_SECRET_KEY=sk_live_...       # Broker $299/mo subscriptions
WEBHOOK_SECRET=whsec_...            # Stripe webhook verification
```

---

## Share with brokers

After deploy, send this to broker contacts:

> "Hey [name], built something I think you'll find useful for your self-employed clients.
> Check it out: https://abnable.com.au
> 
> There's also a calculator that shows exactly how much each lender will lend based on BAS figures:
> https://abnable.com.au/calculator
> 
> Happy to walk you through it — takes 10 mins."

---

## Resume development

To continue building with Claude, paste `abnable-context.md` into a new chat.
