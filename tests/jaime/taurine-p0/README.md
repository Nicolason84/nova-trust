# Jaime — factual grounding corpus candidate

This directory records the bounded public-content change prepared for the existing Jaime candidate. It contains no private conversation, account credential, personal contact data, runtime admission or deployment instruction.

## Source of truth and changes

Continue to edit the existing `tools/jaime-secure/taurino-content/research-learning.json` and build `docs/jaime/data/taurino-content.json` with the existing offline builder. The private conversational helper should project relevant records from that generated document. Do not make the recipe or this directory a second production corpus.

The change refines T02 (encaste), adds L13 (casta, encaste and ganadería), and adds R05 (Miura). S33–S36 identify the supporting MAPA, breeder-association and Cultura publications. The eight event records, existing lessons, source limitations, audio transcripts and coverage dates are preserved. The full-corpus `verifiedAt` remains 2026-10-30; the four new source records carry their own review date, 2026-10-31. Access notes distinguish full-text access from official search retrieval.

The existing builder and validator are unchanged. The existing core test changes only its expected lesson count from 12 to 13. The additional test file checks preservation, source references, adjacent event dates, factual anchors, provenance, reproducible assembly and the word budget. These are static content and contract checks.

## Reproduction

From the repository root:

```sh
python3 tools/jaime-secure/taurino-content/build-content.py
node tools/jaime-secure/tests/taurino-core.test.mjs
node tools/jaime-secure/tests/taurino-grounding-corpus.test.mjs
python3 tests/jaime/taurine-p0/audit_source_words.py
```

The direct Node test-file invocation reports individual assertions in this runtime. The two test files provide 11 existing and 8 targeted tests respectively. The generated content contains 51 sources, 13 lessons, 48 glossary entries, 5 ranches and 8 events. The learning-corpus audit covers 29 source records and retains its previous maximum, 192 attributed words against a limit of 200. Events and supplemental glossary remain byte-identical to their source preimages.

## Model and browser acceptance remain separate

`recipe.json` defines 18 synthetic question/follow-up cases. Every case is initially `NOT_RUN`; there is no model PASS in this package. Apply the recorded acceptance method to actual replies, with request/response hashes and the exact model/corpus versions, once authorized real inference is available. A static corpus assertion cannot prove the model uses the source correctly or that the browser received a reply.

`response-contract-es.txt` is the bounded Spanish epistemic policy for the existing helper. It is not wired to a runtime by this content-only change. The required capability remains `research:false`. A preparation-time public-source review is not live research performed by Jaime. The recipe includes unsupported current-event requests, date ambiguity, context continuity, invented-premise resistance and text-versus-audio disclosure.

`source-verification.json` records public-source access and limitations. One unresolved historical detail about Miura's founder is deliberately excluded from factual content; the recipe records the disagreement for review rather than giving the model a fabricated certainty.

## Preimages, admission and rollback

`preimages.json` hashes eight source files copied from the shared scratch mirror. Their exact bytes are preserved below `preimages/`. They establish the isolated editing baseline; they do not attest that the files match the admitted native installation. The integrator must compare the current PR head and native source closure before applying the change.

For a source rollback, restore `research-learning.json` and the previous core-test lesson count from those preimages, then use the same builder. The derived baseline output has not been represented as a saved copy of the previously deployed file. A deployment rollback must use the owner's actual admitted preimage and existing native succession procedure.

No service worker, active owner, source-closure admission, lease, Cloudflare setting, session duration or research capability is changed by this subtree. The real Ollama, authenticated-browser and physical-iPhone gates remain with the parent mission.
