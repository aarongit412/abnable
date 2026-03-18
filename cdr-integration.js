/**
 * ABNable — Australian CDR Open Banking Integration Layer
 * 
 * This module handles live data fetching from Australian lender CDR APIs.
 * All endpoints are public product reference data (no auth required).
 * 
 * CDR Standard: https://consumerdatastandardsaustralia.github.io/standards/
 */

// ============================================================
// LENDER REGISTRY — CDR endpoints + our self-employed metadata
// ============================================================
// Note: CDR gives us rates/fees/LVR. Self-employed policy data
// comes from our own database (built from BDM relationships + aggregator panel)

export const LENDER_REGISTRY = {
  liberty: {
    name: "Liberty Financial",
    cdrEndpoint: "https://services.liberty.com.au/api/data-holder-public/cds-au/v1",
    category: "non-bank",
    specialistSelfEmployed: true,
    selfEmployedPolicy: {
      minAbnAge: 12,          // months
      acceptsBas: true,
      acceptsLowDoc: true,
      minBasStatements: 2,
      acceptsAccountantLetter: true,
      maxLvr: 80,
      assessmentMethod: "gross_revenue",  // vs net_profit
      notes: "Strong for contractors and sole traders. Uses 2yr avg of gross business income."
    }
  },
  pepper: {
    name: "Pepper Money",
    cdrEndpoint: null, // Not yet on CDR — direct relationship needed
    category: "non-bank",
    specialistSelfEmployed: true,
    selfEmployedPolicy: {
      minAbnAge: 12,
      acceptsBas: true,
      acceptsLowDoc: true,
      minBasStatements: 4,
      acceptsAccountantLetter: true,
      maxLvr: 85,
      assessmentMethod: "net_profit_addback",
      notes: "Best for ABN holders with tax minimisation. Allows depreciation addback."
    }
  },
  latrobe: {
    name: "La Trobe Financial",
    cdrEndpoint: null, // Non-bank, CDR from July 2026
    category: "non-bank",
    specialistSelfEmployed: true,
    selfEmployedPolicy: {
      minAbnAge: 6,           // Most lenient on market
      acceptsBas: true,
      acceptsLowDoc: true,
      minBasStatements: 2,
      acceptsAccountantLetter: true,
      maxLvr: 80,
      assessmentMethod: "gross_revenue",
      notes: "Excellent for newer ABN holders (6mo+). Alt-doc product strong for high deduction earners."
    }
  },
  bluestone: {
    name: "Bluestone Mortgages",
    cdrEndpoint: null,
    category: "non-bank",
    specialistSelfEmployed: true,
    selfEmployedPolicy: {
      minAbnAge: 12,
      acceptsBas: true,
      acceptsLowDoc: true,
      minBasStatements: 4,
      acceptsAccountantLetter: false,
      maxLvr: 80,
      assessmentMethod: "net_profit",
      notes: "Good for established businesses with clean financials."
    }
  },
  macquarie: {
    name: "Macquarie Bank",
    cdrEndpoint: "https://api.macquariebank.io/cds-au/v1",
    category: "bank",
    specialistSelfEmployed: false,
    selfEmployedPolicy: {
      minAbnAge: 24,
      acceptsBas: false,
      acceptsLowDoc: false,
      minBasStatements: 0,
      acceptsAccountantLetter: false,
      maxLvr: 80,
      assessmentMethod: "net_profit",
      notes: "Requires full financials. Good rates for established businesses with strong tax returns."
    }
  },
  anz: {
    name: "ANZ",
    cdrEndpoint: "https://api.anz/cds-au/v1",
    category: "major-bank",
    specialistSelfEmployed: false,
    selfEmployedPolicy: {
      minAbnAge: 24,
      acceptsBas: false,
      acceptsLowDoc: false,
      minBasStatements: 0,
      acceptsAccountantLetter: false,
      maxLvr: 80,
      assessmentMethod: "net_profit",
      notes: "Standard bank policy. Needs 2yr tax returns and strong declared income."
    }
  }
};

// ============================================================
// CDR API CLIENT
// ============================================================

const CDR_HEADERS = {
  "x-v": "3",
  "Accept": "application/json",
};

/**
 * Fetch mortgage products from a lender's CDR endpoint
 * Returns standardised product objects
 */
export async function fetchLenderProducts(lenderId) {
  const lender = LENDER_REGISTRY[lenderId];
  if (!lender?.cdrEndpoint) {
    console.log(`[CDR] ${lender?.name}: No CDR endpoint yet (non-bank, CDR from July 2026)`);
    return null;
  }

  try {
    const url = `${lender.cdrEndpoint}/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25`;
    const res = await fetch(url, { headers: CDR_HEADERS });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const products = data?.data?.products || [];
    
    return products.map(p => normaliseCdrProduct(p, lenderId));
  } catch (err) {
    console.error(`[CDR] Failed to fetch ${lender.name}:`, err.message);
    return null;
  }
}

/**
 * Fetch detailed product info including rates
 */
export async function fetchProductDetail(lenderId, productId) {
  const lender = LENDER_REGISTRY[lenderId];
  if (!lender?.cdrEndpoint) return null;

  try {
    const url = `${lender.cdrEndpoint}/banking/products/${productId}`;
    const res = await fetch(url, { headers: CDR_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[CDR] Product detail failed:`, err.message);
    return null;
  }
}

/**
 * Normalise CDR product format → ABNable standard format
 */
function normaliseCdrProduct(cdrProduct, lenderId) {
  const rates = extractRates(cdrProduct);
  return {
    id: cdrProduct.productId,
    lenderId,
    lenderName: LENDER_REGISTRY[lenderId].name,
    name: cdrProduct.name,
    description: cdrProduct.description,
    effectiveFrom: cdrProduct.effectiveFrom,
    rates: {
      variableMin: rates.variable?.min,
      variableMax: rates.variable?.max,
      fixedRates: rates.fixed || [],
      comparisonRate: rates.comparison,
    },
    features: extractFeatures(cdrProduct),
    fees: extractFees(cdrProduct),
    constraints: extractConstraints(cdrProduct),
    rawCdr: cdrProduct, // Keep original for deep inspection
  };
}

function extractRates(product) {
  const rates = { variable: null, fixed: [], comparison: null };
  const lendingRates = product.lending_rates || product.lendingRates || [];
  
  lendingRates.forEach(r => {
    const rateVal = parseFloat(r.rate) * 100; // CDR returns decimal e.g. 0.0649
    if (r.lendingRateType === 'VARIABLE') {
      if (!rates.variable) rates.variable = { min: rateVal, max: rateVal };
      else {
        rates.variable.min = Math.min(rates.variable.min, rateVal);
        rates.variable.max = Math.max(rates.variable.max, rateVal);
      }
    } else if (r.lendingRateType === 'FIXED') {
      rates.fixed.push({ term: r.additionalValue, rate: rateVal });
    } else if (r.lendingRateType === 'COMPARISON') {
      rates.comparison = rateVal;
    }
  });
  return rates;
}

function extractFeatures(product) {
  return (product.features || []).map(f => ({
    type: f.featureType,
    value: f.additionalValue,
    info: f.additionalInfo,
  }));
}

function extractFees(product) {
  return (product.fees || []).map(f => ({
    name: f.name,
    type: f.feeType,
    amount: f.amount,
    currency: f.currency || 'AUD',
  }));
}

function extractConstraints(product) {
  return (product.constraints || []).map(c => ({
    type: c.constraintType, // MIN_BALANCE, MAX_BALANCE, etc
    value: c.additionalValue,
  }));
}

// ============================================================
// MATCHING ENGINE — core of ABNable
// ============================================================

/**
 * Main matching function
 * Takes borrower profile, returns ranked lender matches with scores
 */
export function matchLenders(profile) {
  const results = [];

  for (const [lenderId, lender] of Object.entries(LENDER_REGISTRY)) {
    const match = scoreLender(profile, lenderId, lender);
    if (match.eligible) {
      results.push(match);
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

function scoreLender(profile, lenderId, lender) {
  const policy = lender.selfEmployedPolicy;
  const reasons = [];
  const blockers = [];
  let score = 0;
  let eligible = true;

  // --- HARD BLOCKERS (instant disqualification) ---

  // ABN age check
  if (profile.abnAgeMonths < policy.minAbnAge) {
    eligible = false;
    blockers.push(`Requires ${policy.minAbnAge}+ months ABN history (you have ${profile.abnAgeMonths}mo)`);
  }

  // LVR check
  const lvr = (profile.loanAmount / profile.propertyValue) * 100;
  if (lvr > policy.maxLvr) {
    eligible = false;
    blockers.push(`LVR ${lvr.toFixed(0)}% exceeds maximum ${policy.maxLvr}%`);
  }

  // Low-doc: do they have what's needed?
  if (!policy.acceptsLowDoc && !profile.hasTaxReturns) {
    eligible = false;
    blockers.push(`Requires full tax returns (low-doc not available)`);
  }

  if (!eligible) {
    return { lenderId, lenderName: lender.name, eligible: false, blockers, score: 0 };
  }

  // --- SCORING (higher = better match) ---

  // Specialist self-employed lender bonus
  if (lender.specialistSelfEmployed) score += 30;

  // Low-doc match
  if (policy.acceptsLowDoc && !profile.hasTaxReturns) {
    score += 25;
    reasons.push("Accepts low-doc — no tax returns needed");
  }

  // BAS acceptance
  if (policy.acceptsBas && profile.hasBas) {
    score += 20;
    reasons.push(`Accepts ${policy.minBasStatements} BAS statements as income evidence`);
  }

  // Accountant letter
  if (policy.acceptsAccountantLetter && profile.hasAccountantLetter) {
    score += 10;
    reasons.push("Accepts accountant's letter for income verification");
  }

  // Assessment method bonus
  if (policy.assessmentMethod === 'gross_revenue' && profile.hasHighDeductions) {
    score += 20;
    reasons.push("Assesses gross revenue — your tax deductions won't hurt you");
  }

  // ABN age headroom
  const abnHeadroom = profile.abnAgeMonths - policy.minAbnAge;
  if (abnHeadroom >= 12) score += 10;

  // Category bonus (specialist non-banks score higher for self-employed)
  if (lender.category === 'non-bank') score += 15;

  // Determine approval likelihood
  let approvalLikelihood;
  if (score >= 80) approvalLikelihood = 'High';
  else if (score >= 50) approvalLikelihood = 'Medium';
  else approvalLikelihood = 'Possible';

  return {
    lenderId,
    lenderName: lender.name,
    eligible: true,
    score,
    approvalLikelihood,
    reasons,
    blockers: [],
    policy,
    notes: policy.notes,
    isSpecialist: lender.specialistSelfEmployed,
    category: lender.category,
  };
}

// ============================================================
// REJECTION COACH — tells borrowers what to fix
// ============================================================

export function generateRejectionCoaching(profile, matchResults) {
  const coaching = [];
  const ineligibleLenders = matchResults.filter(m => !m.eligible);
  
  // What would unlock the most lenders?
  const allBlockers = ineligibleLenders.flatMap(m => m.blockers);
  
  // Tax returns missing
  if (!profile.hasTaxReturns && allBlockers.some(b => b.includes('tax returns'))) {
    coaching.push({
      priority: 1,
      action: "Lodge outstanding tax returns",
      impact: "Unlocks major banks and most standard lenders",
      timeframe: "4–8 weeks with an accountant",
    });
  }

  // ABN too new
  if (profile.abnAgeMonths < 12) {
    coaching.push({
      priority: 2,
      action: "Wait until 12 months ABN history",
      impact: `${12 - profile.abnAgeMonths} months until you unlock significantly more lenders`,
      timeframe: `${12 - profile.abnAgeMonths} months`,
    });
  }

  // LVR too high
  const lvr = (profile.loanAmount / profile.propertyValue) * 100;
  if (lvr > 80) {
    coaching.push({
      priority: 3,
      action: "Reduce LVR below 80% with additional deposit",
      impact: "Opens specialist lenders at better rates, avoids LMI",
      timeframe: "Depends on savings capacity",
    });
  }

  // Missing BAS
  if (!profile.hasBas) {
    coaching.push({
      priority: 4,
      action: "Ensure BAS statements are lodged and up to date",
      impact: "Required by most self-employed specialist lenders",
      timeframe: "Can obtain from ATO Business Portal immediately",
    });
  }

  return coaching.sort((a, b) => a.priority - b.priority);
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/*
const borrowerProfile = {
  bizType: "sole_trader",
  abnAgeMonths: 18,        // 1.5 years trading
  annualIncome: 120000,
  industry: "IT",
  loanPurpose: "buy_home",
  loanAmount: 650000,
  propertyValue: 850000,   // LVR = 76.5%
  hasTaxReturns: false,    // Only has 1 year
  hasBas: true,            // Has 4 quarters BAS
  hasAccountantLetter: true,
  hasHighDeductions: true, // Tech expenses, home office etc
};

const matches = matchLenders(borrowerProfile);
const coaching = generateRejectionCoaching(borrowerProfile, matches);

console.log("Top matches:", matches.filter(m => m.eligible));
console.log("Coaching:", coaching);
*/

export default { LENDER_REGISTRY, fetchLenderProducts, matchLenders, generateRejectionCoaching };
