// Foot Solutions intake: receives a finished intake form from the iPad and emails it to this Google Workspace account.
// Only use with a Workspace account whose admin has accepted Google's HIPAA BAA (Gmail and Apps Script are covered).
// Setup: open https://script.new signed in as the store's Workspace account, paste this in, Save, then
// Deploy > New deployment > Web app, Execute as "Me", Who has access "Anyone". Paste the web app URL into SEND_URL in index.html.
const SEND_TO = '' // leave empty to send to this account itself, or put another address in the same Workspace

function doPost(e) {
  try {
    const m = JSON.parse(e.postData.contents)
    if (typeof m.subject !== 'string' || typeof m.text !== 'string' || !Array.isArray(m.files) || m.files.length > 8) throw new Error('bad request')
    const attachments = m.files.map(f => Utilities.newBlob(Utilities.base64Decode(f.data), String(f.type), String(f.name)))
    MailApp.sendEmail({ to: SEND_TO || Session.getEffectiveUser().getEmail(), subject: m.subject.slice(0, 200), body: m.text, name: 'Foot Solutions Intake', attachments })
    return reply({ ok: true })
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message || err) })
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
