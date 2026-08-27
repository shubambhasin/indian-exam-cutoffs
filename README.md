# Indian Exam Cutoffs

Category-wise qualifying cutoffs for India's major engineering and medical entrance
exams, 2019 onwards — with the source and confidence level attached to every figure.

**Live site:** https://shubambhasin.github.io/indian-exam-cutoffs/

## What this is

A static reference site. Fourteen exams (JEE Main, JEE Advanced, NEET-UG, NEET-PG,
INI-CET, NEET-MDS, NEET-SS, INI-SS, FMGE, NExT, AIAPGET, NORCET, GPAT, NIPER JEE),
plus benchmark closing ranks for IIT Bombay CSE and AIIMS New Delhi MBBS.

Three things it tries to do that most cutoff pages don't:

- **Distinguish qualifying from admission.** A qualifying cutoff gets you into
  counselling; a closing rank gets you a seat. They are stored and displayed separately.
- **Show only the bands that genuinely differ.** NEET-UG has two distinct cutoff bands,
  not five — EWS sits inside the UR band, and OBC/SC/ST share the 40th percentile.
  Presenting five separate NEET-UG lines is a common error.
- **Leave gaps visible.** Where no data was found, the dataset records a gap and the
  page says so. Nothing is interpolated or estimated.

## Data provenance

Every row carries a `confidence` value:

| Level | Meaning |
|---|---|
| `official` | Read directly from the conducting authority's own published document |
| `verified` | Two or more independent sources state identical figures |
| `single-source` | Only one source found — indicative until confirmed |
| `none` | No published data exists |

All JEE Advanced figures (2019–2026) are `official`, extracted from the Joint
Implementation Committee reports and cutoff notices on `jeeadv.ac.in`. JEE Main 2019 is
`official` from the NTA press release. Most medical PG figures are `verified` or
`single-source`, because NBEMS and AIIMS do not archive category-wise cutoff tables in a
consistently reachable form.

## Repository layout

```
index.html            markup and static copy only
assets/styles.css     design tokens, light + dark
assets/app.js         renders the entire page from the JSON
data/cutoffs.json     the dataset — the single source of truth
scripts/validate.mjs  schema + sanity validator
vercel.json           runs the validator as the build step
```

The renderer hard-codes no year, exam, category or colour. Everything is derived from
`data/cutoffs.json`.

## Updating the data

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: append one object to a
`series` array, run `npm run validate`, commit. No code changes required.

```bash
npm run validate    # schema + sanity checks
npm run dev         # validate, then serve at http://localhost:4173
```

The validator gates both deployment paths — it is the Vercel build command, and it runs
as the first step of the GitHub Pages workflow — so a malformed dataset fails the deploy
instead of shipping a broken page.

## Deployment

The site is served from GitHub Pages via `.github/workflows/pages.yml`, which validates
the dataset and then publishes with `actions/deploy-pages`. Pushing to `main` redeploys.

`vercel.json` is retained so the repo can also be imported into Vercel (useful for preview
deployments on pull requests). The two are independent; neither requires the other. All
asset paths are relative, so the site works both at a domain root and under the
`/indian-exam-cutoffs/` subpath.

## Corrections

If a figure here disagrees with an official notification, the notification is right.
Open an issue or a pull request against `data/cutoffs.json` with a link to the source.

## Licence

MIT for the code. The cutoff figures are facts published by public examination
authorities and are not claimed as original work.

Not affiliated with NTA, the Joint Admission Board, NBEMS, AIIMS, MCC or JoSAA.
