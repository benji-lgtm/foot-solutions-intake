# Instructions for an AI working on this project

Read `README.md` first. It explains what the app does and how to run, test and deploy it.

## The app in short

- `index.html` is a single-page app with no build step and no framework. All state lives in the in-memory object `d`. `steps` is the list of screens, each with a `view()` that returns HTML and an optional `check()` that returns validation errors.
- Card reading runs entirely in the browser: `zxing-wasm` reads the license barcode (`readLicense`) and `tesseract.js` reads card text (`scanCard`). Both load from `vendor/`. `card-read.js` turns the raw text into fields.
- `api/doctors.js` and `api/photo.js` are Vercel functions using the standard `export async function POST(request)` signature. `server.mjs` runs the same functions locally.
- `sheet()` in `index.html` builds the printable intake form, laid out like the paper one. The same HTML is emailed as an attachment.
- `send()` posts the finished form to the store's Google Apps Script web app (`SEND_URL`), which emails it inside the store's Google Workspace.

## Hard rules (this app handles patient health information)

1. Never store patient information on the device: no `localStorage`, `sessionStorage`, IndexedDB or cookies for patient data.
2. Never send patient information anywhere except the store's Google Workspace through `google-apps-script.js`, and only once the Workspace admin has accepted Google's HIPAA BAA. Never send it to our own server functions, a free @gmail.com address, or any service without a signed BAA.
3. Never add analytics, tracking pixels, chat widgets, fonts or scripts from other sites. Keep the Content-Security-Policy in `index.html` strict.
4. The server functions may only receive a doctor's name and city. Never add patient fields to those requests.
5. Escape anything inserted into HTML with `esc()`.

## Before calling a change done

- Run `node test.mjs`. All checks must pass.
- Run `node server.mjs`, open http://localhost:5173, and click through every screen you changed at iPad and phone sizes.
- For card reading, test with real photos taken on the iPad, held at different angles.
