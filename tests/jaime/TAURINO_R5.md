# El tendido de Jaime — R5

Producer: ChatGPT Work. Public frontend/content release; no native SUPRA result claimed.

## What is delivered

The existing Tauromaquia universe now opens `taurino.html`, with four Spanish views: Al día, Entender, Conversar and Mi afición. It contains eight dated corrida records, twelve learning cards, forty-eight glossary entries, ten explained quiz questions, six argument/objection/nuance dossiers and four documented ranch profiles. Forty-seven source records preserve attribution, source disagreements and access caveats.

Two original editorial episodes are published as real MP3 files, with full transcripts and explicit generated-voice labels. Their measured generation durations are 186.502676 and 205.078639 seconds. Audio does not start without a tap and is not included in service-worker precaching. Device speech for the text cards is a separately labelled capability dependent on the installed browser voices.

The first retrospective selection covers Madrid, Sevilla and Zafra from 25 September to 12 October 2026; it was reviewed on 30 October 2026. An event card distinguishes its attributed results, the conclusions those results support, the questions that require footage or criticism, and source discrepancies. No unwatched video is treated as eyewitness evidence.

## Actuality and coverage

`taurino_refresh.py` maintains an index of links from three fixed official RSS feeds: Clarín/RTVE, Real Maestranza de Sevilla and Ayuntamiento de Zafra. The workflow runs at 07:17 UTC daily and supports a manual dispatch. Titles, descriptions and publisher audio enclosures are not republished. Editorial labels and controlled topics accompany dated official links. Failure retains the last valid items and visibly changes freshness status.

The frontend reads one fixed public raw GitHub URL, validates its complete bounded schema and falls back to the locally published JSON. This matters because GITHUB_TOKEN pushes do not trigger a branch-based Pages rebuild. The workflow commits only the feed JSON, without a force push or extra secret.

This index does not create new corrida summaries. The request form prepares a real source search for another event; it does not claim to contact an AI backend or return a verified summary. The free-form question is never part of a search URL. Exhaustive worldwide coverage is not claimed.

## Personal material

Favorites and learning progress contain only known public content IDs in localStorage and are labelled as unencrypted browser preferences. Personal reflections and notes use the existing encrypted document vault, with an explicit save and phrase confirmation. The vault locks after saving. A successful save clears only the originating draft. Backgrounding hides personal fields immediately; one minute hidden or leaving the page clears unsaved private drafts. No sensitive profile seed is published.

The existing Matrix adapter, document vault and business calculation core are reused without modification. Production AI, Matrix accounts, VPN, reminders and physical iPhone validation remain outside this release's verified claims.

## Reproduce

From the repository root:

```sh
python3 tools/jaime-secure/taurino-content/build-content.py --output docs/jaime/data/taurino-content.json
cd tools/jaime-secure
npm ci --ignore-scripts
JAIME_DIST_DIR=../../docs/jaime npm run build
node --test --test-isolation=none tests/*.test.mjs
python3 -m unittest discover -s tests -p test_taurino_refresh.py -v
```

The content builder uses the checked-in editorial source JSON and audio transcripts. It does not generate or fabricate audio. MP3 checksums are recorded in `docs/jaime/DELIVERY.json`; the mutable feed has its own release snapshot metadata instead of a fixed-asset hash.

## Evidence

`QA_R5.json` records the local verification. `PUBLICATION_R5.json`, after publication, records the exact public commit, Pages build and feed workflow execution. A physical iPhone was not used; the mobile layout was exercised in Chrome at 390 × 844 CSS pixels.
