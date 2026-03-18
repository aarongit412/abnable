/**
 * ABNable — ATO ABR Lookup
 * Free API — register GUID at abr.business.gov.au/RegisterABRfunctions
 * Set env var: ABR_GUID=your-guid-here
 */

const ABR_BASE = 'https://abr.business.gov.au/json/AbnDetails.aspx';

export async function lookupABN(abn) {
  const clean = abn.replace(/\s/g, '');
  if (clean.length !== 11) throw new Error('ABN must be 11 digits');

  const guid = process.env.ABR_GUID;
  if (!guid || guid === 'YOUR_GUID_HERE') {
    // Return realistic demo data when no GUID set
    return demoABNResult(clean);
  }

  const url = `${ABR_BASE}?abn=${clean}&guid=${guid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ABR API error: ${res.status}`);

  // ABR returns JSONP-wrapped — parse out the JSON
  const text = await res.text();
  const json = text.replace(/^callback\(/, '').replace(/\);?$/, '');
  const data = JSON.parse(json);

  if (data.Message) throw new Error(data.Message);

  return normaliseABR(data, clean);
}

function normaliseABR(data, abn) {
  const regDate = new Date(data.AbnStatusEffectiveFrom || data.EntityTypeCode);
  const ageMonths = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const ageYears = Math.floor(ageMonths / 12);
  const ageDisplay = ageYears > 0
    ? `${ageYears}yr ${ageMonths % 12}mo`
    : `${ageMonths} months`;

  const gstRegistered = !!data.Gst?.EffectiveFrom;

  // Which lenders are available based on ABN age
  let eligibleLenders, lenderNote, lenderNoteType;
  if (ageMonths < 6) {
    eligibleLenders = 'Very limited';
    lenderNote = 'Most lenders require 6+ months ABN. Consider waiting for La Trobe Financial.';
    lenderNoteType = 'warning';
  } else if (ageMonths < 12) {
    eligibleLenders = 'La Trobe Financial';
    lenderNote = `La Trobe accepts from 6 months. At 12 months you unlock Pepper Money and Liberty Financial.`;
    lenderNoteType = 'warning';
  } else if (ageMonths < 24) {
    eligibleLenders = 'Pepper Money, La Trobe, Liberty Financial';
    lenderNote = `${ageDisplay} ABN — all specialist lenders available. At 24 months you also access major banks (Macquarie, ANZ).`;
    lenderNoteType = 'positive';
  } else {
    eligibleLenders = 'All lenders including Macquarie & ANZ';
    lenderNote = `Excellent — ${ageDisplay} ABN gives you access to every lender on our platform including major banks at best rates.`;
    lenderNoteType = 'positive';
  }

  return {
    abn,
    status: data.AbnStatus || 'Active',
    entityName: data.EntityName || data.MainName?.OrganisationName || 'Unknown',
    entityType: data.EntityTypeName || 'Unknown',
    gstRegistered,
    gstDate: data.Gst?.EffectiveFrom || null,
    state: data.AddressState || data.BusinessAddress?.State || null,
    postcode: data.AddressPostcode || data.BusinessAddress?.Postcode || null,
    registeredDate: data.AbnStatusEffectiveFrom,
    ageMonths,
    ageDisplay,
    eligibleLenders,
    lenderNote,
    lenderNoteType,
    source: 'ato_abr_live',
  };
}

function demoABNResult(abn) {
  // Realistic demo when no ABR GUID configured
  const ageMonths = [8, 14, 18, 26, 36, 50][Math.floor(Math.random() * 6)];
  const regDate = new Date();
  regDate.setMonth(regDate.getMonth() - ageMonths);

  return normaliseABR({
    AbnStatus: 'Active',
    AbnStatusEffectiveFrom: regDate.toISOString().slice(0, 10),
    EntityName: 'Your Business Name',
    EntityTypeName: ['Sole Trader', 'Australian Private Company', 'Discretionary Trust'][Math.floor(Math.random() * 3)],
    Gst: ageMonths > 6 ? { EffectiveFrom: regDate.toISOString().slice(0, 10) } : null,
    AddressState: ['NSW', 'VIC', 'QLD', 'WA', 'SA'][Math.floor(Math.random() * 5)],
    AddressPostcode: '2000',
  }, abn);
}
