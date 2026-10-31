// POST { first, last, credential, city, state } -> { photo } : a best-guess headshot URL, or null.
// shortcut: needs BRAVE_API_KEY set on the server; without it every doctor shows initials instead of a photo.
export async function POST(req) {
  const d = await req.json().catch(() => ({}))
  const key = process.env.BRAVE_API_KEY
  if (!key || !d.last) return Response.json({ photo: null })
  const q = ['Dr', d.first, d.last, d.credential, d.city, d.state].filter(Boolean).join(' ')
  const r = await fetch('https://api.search.brave.com/res/v1/images/search?' + new URLSearchParams({ q, count: '20', safesearch: 'strict' }), {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null)
  if (!r?.ok) return Response.json({ photo: null })
  return Response.json({ photo: pickPhoto((await r.json()).results, d)?.thumbnail?.src || null })
}

// A wrong face is worse than no face: only accept an image whose page names this doctor.
export function pickPhoto(results = [], { first = '', last = '' }) {
  const f = first.toLowerCase(), l = last.toLowerCase()
  return results.find(x => {
    const t = `${x.title || ''} ${x.url || ''}`.toLowerCase()
    return t.includes(l) && t.includes(f)
  })
}
