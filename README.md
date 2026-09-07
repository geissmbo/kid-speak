# KidSpeak Dictionary

KidSpeak is a kid-friendly dictionary app for looking up words by typing, hearing definitions aloud, and using speech search where the browser supports it.

## Features

- Typed dictionary lookup using the free Dictionary API.
- Text-to-speech playback for words and definitions.
- Speech search after a short typed-word warm-up.
- Search history stored in the browser.
- Pronunciation choices for words with multiple dictionary entries.
- Touch-friendly layout for tablets and phones.
- PWA metadata so the app can be added to an iPad Home Screen.

## iPad Notes

The app works well as a typed dictionary on iPad. Speech recognition support depends on the browser. If the iPad browser does not expose the Web Speech API, the app will keep typed search and read-aloud features available and show that speech search is unavailable.

To use it like an app on iPad:

1. Deploy the production build to a HTTPS web host.
2. Open the hosted URL in Safari.
3. Tap Share.
4. Choose Add to Home Screen.

## Run Locally

Install dependencies once:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Build

Create a production build:

```bash
npm run build
```

Serve the production build locally for a quick check:

```bash
node scripts/serve-build.cjs
```

Then open:

```text
http://localhost:3000
```

## Dictionary Service Failures

Lookups use `api.dictionaryapi.dev` directly. A service timeout (for example,
Cloudflare HTTP 522) can lack CORS headers, so browsers may report a CORS error
instead of the underlying timeout. This cannot be corrected with a frontend
CORS setting.

The app allows eight seconds per request and retries once with a fresh URL for
network or service failures. A genuine HTTP 404 is reported as a missing word;
other failures show a service-unavailable message. Previously saved words remain
readable from history. The service worker handles only this app's same-origin
files and never substitutes offline HTML for dictionary API responses.

Run the regression checks with `npm test -- --watchAll=false --runInBand`.
Changes reach the live GitHub Pages site after a push to `main` successfully
completes the deployment workflow.

## Project Structure

```text
public/              Static app shell, manifest, icon, service worker
src/components/      React components
src/css/             App styling
src/images/          KidSpeak artwork
scripts/             Local utility scripts
```
