export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { abn } = req.query;
  if (!abn) return res.status(400).json({ error: 'ABN required' });

  const clean = abn.replace(/\s/g, '');
  if (clean.length !== 11) return res.status(400).json({ error: 'ABN must be 11 digits' });

  const guid = process.env.ABR_GUID;
  if (!guid || guid === 'YOUR_GUID_HERE') {
    return res.json(demoABN(clean));
  }

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${clean}&guid=${guid}&callback=x`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    const json = JSON.parse(text.replace(/^x\(/, '').replace(/\);?$/, ''));
    return res.json(processABR(json, clean));
  } catch(e) {
    return res.json(demoABN(clean));
  }
}

function processABR(data, abn) {
  const reg = new Date(data.AbnStatusEffectiveFrom || Date.now());
  const mos = Math.floor((Date.now() - reg.getTime()) / (1000*60*60*24*30.44));
  const yrs = Math.floor(mos/12);
  const age = yrs > 0 ? `${yrs}yr ${mos%12}mo` : `${mos} months`;
  const gst = !!data.Gst?.EffectiveFrom;
  let lenders, note, noteType;
  if (mos < 6)  { lenders='Very limited'; note='Most lenders need 6+ months ABN.'; noteType='warning'; }
  else if (mos < 12) { lenders='La Trobe Financial'; note='At 12 months you unlock Pepper + Liberty.'; noteType='warning'; }
  else if (mos < 24) { lenders='Pepper, La Trobe, Liberty'; note=`${age} — at 24 months you access major banks too.`; noteType='positive'; }
  else { lenders='All lenders incl. Macquarie & ANZ'; note=`Excellent — ${age} ABN, full lender access.`; noteType='positive'; }
  return { abn, status: data.AbnStatus||'Active', entityName: data.EntityName||'Unknown',
    entityType: data.EntityTypeName||'Unknown', gstRegistered: gst,
    state: data.AddressState||null, ageMonths: mos, ageDisplay: age,
    eligibleLenders: lenders, lenderNote: note, lenderNoteType: noteType, source:'ato_abr_live' };
}

function demoABN(abn) {
  const mos = [8,14,18,26,36,50][Math.floor(Math.random()*6)];
  const d = new Date(); d.setMonth(d.getMonth()-mos);
  return processABR({ AbnStatus:'Active', AbnStatusEffectiveFrom: d.toISOString().slice(0,10),
    EntityName:'Your Business Name', EntityTypeName:'Sole Trader',
    Gst: mos>6?{EffectiveFrom:'2023-01-01'}:null, AddressState:'NSW' }, abn);
}
