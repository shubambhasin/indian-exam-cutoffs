# Updating the dataset

Everything lives in `data/cutoffs.json`. The renderer derives years, categories, axis
ranges, charts, tables and the source list from that file, so adding data never requires
touching `app.js` or `styles.css`.

Run this before every commit:

```bash
npm run validate
```

## Adding next year's figures to an existing exam

Find the exam's `qualifying.series` array and append one object. Example — adding 2027 to
JEE Main:

```json
{
  "year": 2027,
  "values": { "gen": 93.5, "ews": 82.9, "obc": 81.4, "sc": 64.2, "st": 52.6 },
  "confidence": "official",
  "source": "nta-2027"
}
```

Rules the validator enforces:

- Every band declared in `bands` must have a key in `values`. Use `null` for a genuine
  gap — a missing key is an error, because a silent omission and a real gap look
  identical once rendered.
- `confidence` must be one of `official`, `verified`, `single-source`, `none`.
- `source` must match a key in the top-level `sources` map. Add the source first.
- Years must be unique within a series.
- If the new value exceeds `axisMax`, the validator fails and tells you to raise it —
  otherwise the chart would silently clip the line.

Then bump `meta.lastUpdated` to today's date.

## Adding a new source

```json
"nta-2027": {
  "label": "NTA press release, JEE (Main) 2027 result",
  "url": "https://nta.ac.in/...",
  "tier": "primary"
}
```

`tier` is `primary` (the conducting authority's own document, read directly) or
`secondary` (an aggregator). Prefer primary. If you can only find an aggregator, mark the
row `single-source` unless two independent aggregators agree, in which case `verified`.

## Adding a whole new exam

Append an object to `exams`. The minimum:

```json
{
  "id": "gate",
  "name": "GATE",
  "stream": "Engineering — Postgraduate",
  "authority": "IIT / IISc",
  "leadsTo": "M.Tech admissions and PSU recruitment",
  "status": "partial",
  "summary": "One or two sentences on how the cutoff is actually set.",
  "qualifying": {
    "metric": "Qualifying marks",
    "unit": "marks out of 100",
    "axisMax": 60,
    "axisMin": 0,
    "decimals": 1,
    "bands": [
      { "id": "gen", "label": "General", "categories": ["gen"] },
      { "id": "obc", "label": "OBC-NCL", "categories": ["obc"] },
      { "id": "sc_st", "label": "SC / ST", "categories": ["sc", "st"] }
    ],
    "series": [],
    "notes": []
  },
  "sources": []
}
```

### Choosing bands

**Declare a band only where the cutoff genuinely differs.** Each of `gen`, `ews`, `obc`,
`sc`, `st` may be claimed by exactly one band — the validator rejects duplicates, which is
what stops the common error of drawing five NEET-UG lines when only two distinct bars
exist.

A maximum of five bands is allowed, because exactly five series colours have been
validated for colourblind separation and contrast in both themes. If you need more, merge
bands or extend the palette in `styles.css` and re-run the dataviz palette validator
against both the light and dark surfaces.

### `status` values

| Value | Use when |
|---|---|
| `complete` | Continuous series with no gaps |
| `partial` | Series exists but has missing years |
| `structural` | The rule is documented but no category-wise series exists (e.g. NEET-SS, FMGE) |
| `none` | Nothing has ever been published (e.g. NExT) |

An exam with `status: "none"` must carry no data blocks, and an exam with data must not be
`none`. The validator enforces both directions.

## Adding a benchmark institute

Append to `benchmarks`. `rankType` matters and is not cosmetic:

- `"category"` — JoSAA-style, where a reserved rank is a rank *within that category*.
- `"air"` — NEET-style All India Ranks, comparable across categories.

`rankNote` is displayed as the section's explanatory line, so write it for a reader who
might otherwise compare an ST category rank against an OPEN All India Rank.
