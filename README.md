# Foot Solutions patient intake

An iPad web app that walks a patient through the Foot Solutions intake form one question at a time, then emails the finished form to the store. It replaces the paper "Patient Information/Intake Form".

## What the patient sees

1. **Are you diabetic?** A "No" ends the form with a polite message, because the form is only for diabetic patients.
2. Pictures of the front and back of their driver's license. The barcode on the back fills in their name, birthday, sex and address, and they confirm it on an "Is this you?" screen.
3. Pictures of their Medicare card and any second insurance card. The Medicare number, insurance company and member ID are read from the pictures and filled in for them to check.
4. Phone, email, and whether they've been to the store before.
5. **Who is your podiatrist (foot doctor)?** and **Who is your primary care doctor?** They type a name and city. The app looks the doctor up in Medicare's public NPI Registry and asks "Is this your doctor?" A yes fills in the doctor's name, NPI, address, phone and fax. The podiatrist goes in the Referring Physician box and the primary care doctor goes in the Certifying Physician box.
6. A review page, then **Finish**. The form is emailed to the store (or printed, until email is set up).

## How patient information is protected (HIPAA)

- **Nothing is saved on the iPad.** Answers and pictures only exist in the open page. They're wiped when staff tap "Clear", after 10 minutes of no use, or when the page is closed.
- **Card pictures are read on the iPad itself.** The barcode and text reading run in the browser. The pictures are never uploaded anywhere for reading.
- **The only thing sent to the web server is a doctor's name and city**, for the doctor lookup. No patient information goes to the server.
- **The finished form goes straight from the iPad to the store's Google Workspace account.** It's sent by a small Google Apps Script running inside that account. Gmail and Apps Script are both covered by Google's HIPAA agreement (BAA), but **only once a Workspace admin has accepted the BAA**. Never point it at a free @gmail.com address, because Google won't sign a BAA for those.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app: screens, card reading, the printable form, and sending |
| `card-read.js` | Turns the license barcode and card text into form fields |
| `api/doctors.js` | Server function: searches the NPI Registry for a doctor |
| `api/photo.js` | Server function: optional doctor photo (needs a Brave Search key) |
| `google-apps-script.js` | Paste this into Google Apps Script to receive and email finished forms |
| `vendor/` | The barcode reader (zxing-wasm) and text reader (tesseract.js), stored here so nothing loads from outside sites |
| `server.mjs` | Runs the app on your own computer for testing |
| `test.mjs` | Automated checks |
| `vercel.json` | Settings for hosting on Vercel |

## Try it on your computer

You need [Node.js](https://nodejs.org) version 20 or newer.

```bash
node server.mjs
```

Then open http://localhost:5173. To run the automated checks:

```bash
node test.mjs
```

## Put it online

The free tier of [Vercel](https://vercel.com) works. Make a Vercel account, then run this in this folder:

```bash
npx vercel deploy --prod
```

It will ask you to log in and name the project, then give you a web address. Open that address on the store iPad in Safari, tap Share, and choose **Add to Home Screen**. Turn on **Guided Access** (Settings, then Accessibility) so patients can't leave the app.

## Turn on emailing

1. **Accept Google's HIPAA agreement.** A Google Workspace super admin goes to the Admin console, then Account settings, then Legal and compliance, then "HIPAA Business Associate Amendment", and accepts it. Google's guide: https://support.google.com/a/answer/3407054
2. **Install the script.** Signed in as the store's Workspace account, open https://script.new and paste in everything from `google-apps-script.js`, then save. Click Deploy, then New deployment, then choose "Web app". Set "Execute as" to **Me** and "Who has access" to **Anyone**, then click Deploy and copy the web app URL. Forms go to the account that installed the script, unless you put another address from the same Workspace in `SEND_TO` at the top of the script.
3. **Connect the app.** In `index.html`, find `const SEND_URL = ''` near the top, paste the web app URL between the quotes, and deploy again.

After that, **Finish** emails the form to the store automatically. The email has a short summary, the filled-in form as an attachment you can open and print, and the card pictures. If sending fails, staff see "Try again" and "Print it instead," so a form is never lost.

## Optional: doctor photos

The "Is this your doctor?" screen can show a photo of the doctor. Get an API key at https://api-dashboard.search.brave.com, then add it in Vercel (Project, Settings, Environment Variables) as `BRAVE_API_KEY` and deploy again. A photo only shows when the web page it came from names that exact doctor. Without a key, the screen shows the doctor's initials.

## Things to know

- Card reading was tested with sample cards. Real cards in store lighting may need a retake now and then. Patients can always type anything that doesn't read.
- The doctor search uses the public NPI Registry: https://npiregistry.cms.hhs.gov
- The store's address and phone on the printed form are in the `sheet()` function in `index.html`.
