// `node test.mjs`: checks the doctor lookup logic, then one live search against the CMS NPI Registry.
import assert from 'node:assert/strict'
import { parseName, rank, POST } from './api/doctors.js'
import { pickPhoto } from './api/photo.js'
import './card-read.js'
const { parseLicense, findMBI, readInsurance } = globalThis.CardRead

// License barcode text, as a real AAMVA PDF417 decodes (header, then one field per line).
const aamva = '@\n\x1e\rANSI 636045090002DL00410278ZU03190008DLDAQ123456789\nDCSJENSEN\nDDEN\nDACMARGARET\nDDFN\nDADANN\nDBB04091951\nDBC2\nDAG123 N MAIN ST\nDAIOREM\nDAJUT\nDAK840570000  \nDCF0000\nDCGUSA\n'
assert.deepEqual(parseLicense(aamva), { first: 'Margaret', last: 'Jensen', dob: { mo: '04', day: '09', yr: '1951' }, sex: 'F', street: '123 N Main St', city: 'Orem', state: 'UT', zip: '84057' })
assert.equal(parseLicense('ANSI 636000010001DL00290170DLDAAJONES,BOB,Q\nDBB19500102\nDBC1').first, 'Bob') // oldest format, Canadian-style date
assert.deepEqual(parseLicense('ANSI 636000010001DL00290170DLDAAJONES,BOB,Q\nDBB19500102\nDBC1').dob, { mo: '01', day: '02', yr: '1950' })
assert.equal(parseLicense('just a photo of a cat'), null)

// Medicare number: exact, misread O/I in digit positions corrected, nothing invented from label text.
assert.equal(findMBI('MEDICARE HEALTH INSURANCE\nMedicare Number/Número de Medicare\n1EG4-TE5-MK73'), '1EG4-TE5-MK73')
assert.equal(findMBI('Medicare Number IEG4-TE5-MK7O'), '1EG4-TE5-MK70')
assert.equal(findMBI('JOHN L SMITH\nHOSPITAL (PART A) 03-01-2016'), '')

assert.deepEqual(readInsurance('AARP Medicare Supplement Plans\nUnitedHealthcare Insurance Company\nMember ID: 123456789-11\nGroup 12345'), { carrier: 'AARP', id: '123456789-11' })
assert.deepEqual(readInsurance('Humana Gold Plus HMO\nMember ID H12345678\nRxBIN 610649'), { carrier: 'Humana', id: 'H12345678' })

assert.deepEqual(parseName('Dr. John A. Smith, MD'), { first: 'john', last: 'smith' })
assert.deepEqual(parseName('Smith, John'), { first: 'john', last: 'smith' })
assert.deepEqual(parseName('smith'), { first: '', last: 'smith' })
assert.deepEqual(parseName('Doctor Garcia-Lopez'), { first: '', last: 'garcia-lopez' })

// Office city beats mailing city, trainees are dropped, fields come out clean.
const row = (npi, office, desc = 'Family Medicine', code = '207Q00000X') => ({ number: npi, basic: { status: 'A', first_name: 'JANE', last_name: 'DOE', credential: 'M.D.' },
  taxonomies: [{ primary: true, desc, code }], addresses: [{ address_purpose: 'MAILING', city: 'OREM' },
  { address_purpose: 'LOCATION', city: office, state: 'UT', address_1: '1 MAIN ST', postal_code: '840571234', telephone_number: '801-555-0100', fax_number: '801-555-0101' }] })
const out = rank([row('4', 'OREM', 'Social Worker', '1041C0700X'), row('1', 'PROVO'), row('2', 'OREM'), row('3', 'OREM', 'Student in an Organized Health Care Education/Training Program', '390200000X')], 'Orem')
assert.deepEqual(out.map(x => x.npi), ['2', '1', '4'])
assert.deepEqual(out[0], { npi: '2', first: 'Jane', last: 'Doe', credential: 'MD', specialty: 'Family Medicine', address: '1 Main St', city: 'Orem', state: 'UT', zip: '84057-1234', phone: '801-555-0100', fax: '801-555-0101' })

// Never show a face whose page doesn't name the doctor.
assert.equal(pickPhoto([{ title: 'Dr. Bob Jones', url: 'https://x.com/jones' }], { first: 'Jane', last: 'Doe' }), undefined)
assert.ok(pickPhoto([{ title: 'Jane Doe, MD | Revere Health', url: 'https://x.com' }], { first: 'Jane', last: 'Doe' }))

const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'smith', city: 'Orem', state: 'UT' }) }))
const { doctors } = await res.json()
assert.ok(doctors?.length, 'live NPI search returned nothing')
assert.ok(doctors.every(x => x.npi && x.address && x.city), 'every live result has an NPI and an office address')
console.log('all checks pass;', doctors.length, 'live results, first:', doctors[0])

// The store's Google Apps Script: sends one email with the attachments, and rejects anything that isn't an intake.
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const mail = []
const gas = { Utilities: { newBlob: (bytes, type, name) => ({ bytes, type, name }), base64Decode: s => [...Buffer.from(s, 'base64')] },
  MailApp: { sendEmail: o => mail.push(o) }, Session: { getEffectiveUser: () => ({ getEmail: () => 'orem@store.test' }) },
  ContentService: { createTextOutput: t => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } } }
vm.runInNewContext(readFileSync(new URL('./google-apps-script.js', import.meta.url), 'utf8'), gas)
const post = body => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify(body) } }))
assert.deepEqual(post({ subject: 'New intake: A B', text: 'hi', files: [{ name: 'a.jpg', type: 'image/jpeg', data: Buffer.from('xyz').toString('base64') }] }), { ok: true })
assert.equal(mail[0].to, 'orem@store.test'); assert.equal(mail[0].attachments[0].name, 'a.jpg'); assert.equal(Buffer.from(mail[0].attachments[0].bytes).toString(), 'xyz')
assert.equal(post({ subject: 1 }).ok, false)
assert.equal(mail.length, 1)
console.log('apps script checks pass')
