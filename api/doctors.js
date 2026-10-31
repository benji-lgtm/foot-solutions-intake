// POST { name, city, state } -> matching individual providers from the CMS NPI Registry.
// Only the doctor's name and city ever reach this server, never anything about the patient.
const NPI = 'https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-1&limit=50'
const TITLES = new Set(['dr', 'doctor', 'md', 'do', 'dpm', 'np', 'pa', 'pac', 'fnp', 'aprn', 'rn', 'mbbs', 'phd', 'jr', 'sr', 'ii', 'iii'])

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const { first, last } = parseName(String(body.name || ''))
  if (last.length < 2) return Response.json({ error: "Please type the doctor's last name." }, { status: 400 })
  const state = /^[a-z]{2}$/i.test(body.state || '') ? body.state.toUpperCase() : 'UT'
  const city = String(body.city || '').trim().slice(0, 40)
  const base = { last_name: last, state, ...(first && { first_name: first + '*' }) }
  const pod = body.kind === 'podiatrist' && { ...base, taxonomy_description: 'Podiatrist' }
  // Narrowest search first; widen if nothing matches (the registry may only list a mailing address in that city).
  const tries = [pod && city && { ...pod, city }, pod, city && { ...base, city }, base].filter(Boolean)
  try {
    let rows = []
    for (const p of tries) if (!rows.length) rows = await search(p)
    return Response.json({ doctors: rank(rows, city).slice(0, 10) })
  } catch {
    return Response.json({ error: "We couldn't reach the doctor directory. Please try again." }, { status: 502 })
  }
}

async function search(params) {
  const r = await fetch(NPI + '&' + new URLSearchParams(params), { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error('NPI registry ' + r.status)
  return (await r.json()).results || []
}

// "Dr. John A. Smith, MD" -> john / smith ; "Smith, John" -> john / smith
export function parseName(raw) {
  const words = s => s.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !TITLES.has(w.replace(/['-]/g, '')))
  const parts = raw.split(',').map(words).filter(p => p.length)
  if (parts.length > 1) return { first: parts[1][0], last: parts[0].at(-1) }
  const w = parts[0] || []
  return { first: w.length > 1 ? w[0] : '', last: w.at(-1) || '' }
}

// Active clinicians only. Prescribers first (MD/DO, podiatrists, NPs, PAs), then whose office is in the typed city.
export function rank(rows, city) {
  const c = city.toLowerCase()
  return rows
    .filter(r => r.basic?.status === 'A' && !/student/i.test(primaryTaxonomy(r).desc || ''))
    .map(r => ({ r, doc: toDoctor(r) }))
    .sort((a, b) => score(b.r, c) - score(a.r, c))
    .map(x => x.doc)
}

const primaryTaxonomy = r => (r.taxonomies || []).find(t => t.primary) || (r.taxonomies || [])[0] || {}
const office = r => (r.addresses || []).find(a => a.address_purpose === 'LOCATION') || (r.addresses || [])[0] || {}
const inCity = (r, c) => Number(!!c && [office(r), ...(r.practiceLocations || [])].some(a => (a.city || '').toLowerCase() === c))
const score = (r, c) => 2 * /^(20|213E|363L|363A)/.test(primaryTaxonomy(r).code || '') + inCity(r, c)
const title = s => (s || '').toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase())

export function toDoctor(r) {
  const b = r.basic || {}, a = office(r), zip = a.postal_code || ''
  return {
    npi: r.number,
    first: title(b.first_name),
    last: title(b.last_name),
    credential: (b.credential || '').replace(/\./g, '').replace(/\s+/g, ' ').trim().toUpperCase(), // "D.P.M., P.C." -> "DPM, PC"
    specialty: primaryTaxonomy(r).desc || '',
    address: [a.address_1, a.address_2].filter(Boolean).map(title).join(', '),
    city: title(a.city),
    state: a.state || '',
    zip: zip.length === 9 ? zip.slice(0, 5) + '-' + zip.slice(5) : zip,
    phone: a.telephone_number || '',
    fax: a.fax_number || '',
  }
}
