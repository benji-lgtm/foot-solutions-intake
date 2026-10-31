// Turns what the camera reads off a card into form fields. Pure text in, fields out: no network, no storage.
// Loaded as a plain <script> in the page and imported by test.mjs, so it hangs its functions on globalThis.
;(() => {
  const title = s => (s || '').toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase())

  // The PDF417 barcode on the back of every US license and state ID (AAMVA standard).
  function parseLicense(text) {
    if (!/ANSI |AAMVA/.test(text || '')) return null
    const f = code => ((text.match(new RegExp(`(?:^|[\\n\\r\\x1e]|DL|ID)${code}([^\\n\\r\\x1e]*)`)) || [])[1] || '').trim()
    let last = f('DCS'), first = f('DAC') || f('DCT')
    if (!last && f('DAA')) [last, first = ''] = f('DAA').split(/[,$]/) // oldest licenses: one LAST,FIRST,MIDDLE field
    const b = f('DBB'), us = /^(0[1-9]|1[0-2])\d{2}(19|20)\d{2}$/.test(b) // US is MMDDYYYY, Canada is YYYYMMDD
    const sx = f('DBC')
    return {
      first: title(first.split(/[\s,$]/)[0]),
      last: title(last),
      dob: b.length !== 8 ? null : us ? { mo: b.slice(0, 2), day: b.slice(2, 4), yr: b.slice(4) } : { mo: b.slice(4, 6), day: b.slice(6), yr: b.slice(0, 4) },
      sex: /^(1|M)$/.test(sx) ? 'M' : /^(2|F)$/.test(sx) ? 'F' : '',
      street: title([f('DAG'), f('DAH')].filter(Boolean).join(' ')),
      city: title(f('DAI')),
      state: f('DAJ').slice(0, 2),
      zip: f('DAK').replace(/\D/g, '').slice(0, 5),
    }
  }

  // Medicare number (MBI): 11 characters, never the letters S L O I B Z. Positions 1, 4, 7, 10, 11 are always digits,
  // so a misread letter there (O for 0, I for 1) can be corrected; exact matches are tried first.
  const MBI = /^[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y]{2}[0-9]{2}$/
  const DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6' }
  function findMBI(text) {
    const lines = (text || '').toUpperCase().split('\n').map(l => l.replace(/[^A-Z0-9]/g, ''))
    for (const fix of [false, true]) for (const l of lines) for (let k = 0; k + 11 <= l.length; k++) {
      let c = l.slice(k, k + 11)
      if (fix) c = [...c].map((ch, n) => [0, 3, 6, 9, 10].includes(n) ? DIGIT[ch] || ch : ch).join('')
      if (MBI.test(c)) return `${c.slice(0, 4)}-${c.slice(4, 7)}-${c.slice(7)}`
    }
    return ''
  }

  // Carrier and member ID from a supplement or Medicare Advantage card. First carrier listed wins
  // (AARP cards also print UnitedHealthcare). shortcut: a fixed list of common carriers; add names as the store meets them.
  const CARRIERS = [['AARP', /\bAARP\b/], ['Mutual of Omaha', /MUTUAL\s+OF\s+OMAHA/], ['UnitedHealthcare', /UNITED\s?HEALTH\s?CARE/],
    ['Humana', /HUMANA/], ['Aetna', /AETNA/], ['Cigna', /CIGNA/], ['Regence', /REGENCE/], ['SelectHealth', /SELECT\s?HEALTH/],
    ['Blue Cross Blue Shield', /BLUE\s?CROSS|BLUE\s?SHIELD|BCBS/], ['Anthem', /ANTHEM/], ['Wellcare', /WELL\s?CARE/], ['Molina', /MOLINA/],
    ['Medicaid', /MEDICAID/], ['TRICARE', /TRICARE/], ['PEHP', /\bPEHP\b/], ['DMBA', /\bDMBA\b/], ['EMI Health', /EMI\s+HEALTH/],
    ['Kaiser Permanente', /KAISER/], ['Bankers Fidelity', /BANKERS\s+FIDELITY/], ['Colonial Penn', /COLONIAL\s+PENN/]]
  function readInsurance(text) {
    const t = (text || '').toUpperCase()
    const carrier = (CARRIERS.find(([, re]) => re.test(t)) || [''])[0]
    const ids = [...t.matchAll(/(?:MEMBER\s*(?:ID|#|NO\.?|NUMBER)|SUBSCRIBER\s*ID|ID\s*(?:#|NO\.?|NUMBER)|\bID\b)\s*[.:#]?\s*([A-Z0-9][A-Z0-9-]{5,19})/g)]
    const id = (ids.find(m => (m[1].match(/\d/g) || []).length >= 3) || [])[1] || ''
    return { carrier, id }
  }

  globalThis.CardRead = { parseLicense, findMBI, readInsurance, MBI }
})()
