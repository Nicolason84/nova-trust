# Jaime private navigation — bounded correction

## Candidate

`docs/jaime/sw.js` leaves navigation requests under `/ojo/jaime/` and `/ojo/jaime-owner-test/` to the browser. The service worker no longer wraps those requests in `fetch(event.request)`. The server authority guard is unchanged. The public GitHub Pages offline shell, static asset allowlist, cache filtering, and API exclusion remain unchanged. The cache version changes to r11. No `skipWaiting()` or `clients.claim()` is introduced.

## Demonstrated mechanism

The official Web Platform Test ran in Chrome cloud and completed with 83 passing tests. Its cross-site GET navigation through a passthrough service worker produced `Sec-Fetch-Site: cross-site`, `Sec-Fetch-Mode: navigate`, and `Sec-Fetch-Dest: empty`. The same metadata combination is rejected by Jaime's reviewed authority predicate; a native top-level document navigation is permitted by that predicate, after the separate authentication gates.

The reviewed original worker intercepts private document navigation. The candidate does not. This is a demonstrated compatibility defect and a bounded fix. The headers of the historical first Cloudflare reload were not captured; this evidence does not prove that no other condition contributed to that historical refusal.

Primary references:

- https://wpt.live/service-workers/service-worker/navigation-headers.https.html
- https://fetch.spec.whatwg.org/#dom-request
- https://fetch.spec.whatwg.org/#dom-global-fetch
- https://w3c.github.io/webappsec-fetch-metadata/

The Fetch Request constructor preserves relevant request origin/mode/history when passed an existing request without additional initialization, while the destination defaults to empty. The public WPT verifies the resulting browser headers independently of Jaime.

## Validation performed

- 9 candidate source/VM tests passed. They exercise the real candidate worker and the exact reviewed owner predicate, with synthetic requests. The optional `JAIME_OWNER_SOURCE` input was supplied during the recorded run, confirming that the copied predicate remains identical to the reviewed owner source.
- The previous worker is retained as `sw.preimage.js`; the test confirms its interception and the candidate's different behavior.
- 83 official public WPT browser tests passed. These are browser mechanism tests, not 83 Jaime acceptance tests.
- No Cloudflare administration, live authentication, private conversation, Mac filesystem, owner guard, session duration, production deployment, or physical iPhone was modified or tested by this correction.

Run the local candidate tests from the repository root:

```sh
node tests/jaime/service-worker-navigation.test.cjs
```

If the current owner source is available, set `JAIME_OWNER_SOURCE` to its reviewed path before running the same command. The test fails if its authority predicate differs from the fixture.

## Remaining acceptance

The complete loopback browser reproduction in `reproduce-service-worker-return.cjs` is prepared and syntax checked, but has not been executed. No local browser binary was available, and the Mac storage guard prevented using it there. It requires an existing Playwright installation and browser, not a download. Set `JAIME_PLAYWRIGHT_MODULE`, `JAIME_OWNER_SOURCE`, and `JAIME_WORKER_SOURCE` explicitly; the worker source for this comparison must be the original `sw.preimage.js`. It contacts loopback fixtures only and compares the original worker with navigation passthrough. It does not test genuine Cloudflare credentials.

After admission, verify the real first Access return and first reload, a fresh tab and subsequent reload, then personal iPhone behavior. Normal service-worker lifecycle applies: an already installed previous worker may remain in control until its clients close. This candidate does not force a client takeover. Confirm the active worker version during the admitted validation.

## Rollback and provenance

`candidate-evidence.json` records the original and candidate SHA-256 hashes. `sw.patch` contains the minimal worker change. Restore the original worker through the same admitted deployment and normal worker lifecycle. All other native package and source-closure rollback controls remain the responsibility of the existing admission procedure.

Work in this folder was performed by GPT in the isolated scratch environment. It is not attributed to SUPRA. Status: tested in isolation, not admitted, not deployed.
