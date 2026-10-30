# Jaime — direct-entry app verification

Frontend source: `docs/jaime/`. First publication: 30 October 2026.

The entry page saves a browser-local name and opens the app directly. It requires no ChatGPT account. The old `nova_client_account_local` profile and `JAIME_APP_LOCAL_EXPORT` note/action schema are supported through explicit recovery previews. Original records are retained, and duplicate notes are not imported twice.

Audio capture is a new real implementation. It does not use voice cloning and does not transcribe, analyse or send recordings. Historical scripts called “voice” only displayed text. The shared FreightCore remains unchanged.

Run from repository root:

    node tests/jaime/legacy.test.cjs
    node tests/jaime/recorder.test.cjs
    node tests/jaime/economics.test.cjs

Expected: 6 legacy/profile cases, 25 audio cases (including nested cases), 8 financial cases. Audio events and permission flows are simulated; physical iPhone microphone validation remains pending.

Browser checks: first-entry name persistence, old export preview and recovery, repeated import without duplicate notes, published HTTPS entry without a ChatGPT sign-in wall, responsive 390×844 display. These checks do not prove a live AI service. `gateway.js` is disconnected; no server account, private context upload, notification or WhatsApp delivery is active.

Only app assets are published under `docs/jaime`. No private chat archive, personal profile or application credentials are included.
