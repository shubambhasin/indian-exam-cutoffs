/* =========================================================================
   Indian Exam Cutoffs — renderer
   Everything on the page is derived from data/cutoffs.json. No year, exam,
   category or colour is hard-coded here. Adding a year means appending one
   object to that file; adding an exam means appending one exam block.
   ========================================================================= */

const SERIES_VARS = ['--s1', '--s2', '--s3', '--s4', '--s5'];

const FLAG_CLASS = {
  official: 'flag-official',
  verified: 'flag-verified',
  'single-source': 'flag-single',
  none: 'flag-none'
};

const FLAG_LABEL = {
  official: 'Official',
  verified: 'Verified',
  'single-source': 'Single source',
  none: 'No data'
};

/* ---------- small helpers ------------------------------------------------ */

const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v);
  }
  return node;
};

const fmt = (value, decimals) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(decimals ?? 0);
};

const colorFor = (index) => `var(${SERIES_VARS[index % SERIES_VARS.length]})`;

const flagChip = (confidence) =>
  el('span', { class: `flag ${FLAG_CLASS[confidence] || 'flag-verified'}` }, FLAG_LABEL[confidence] || confidence);

/* ---------- line chart ---------------------------------------------------
   One axis only. Gaps in a series break the line rather than interpolating,
   so a missing year reads as missing.
   ----------------------------------------------------------------------- */

function buildChart(block, opts = {}) {
  const { bands, series, decimals = 0, unit = '' } = block;
  const rows = [...series].sort((a, b) => a.year - b.year);
  if (rows.length === 0) return null;

  const years = rows.map((r) => r.year);
  const allValues = rows.flatMap((r) => bands.map((b) => r.values[b.id])).filter((v) => typeof v === 'number');
  if (allValues.length === 0) return null;

  const dataMax = Math.max(...allValues);
  const dataMin = Math.min(...allValues);
  const yMax = opts.axisMax ?? block.axisMax ?? dataMax * 1.12;
  const yMin = opts.axisMin ?? block.axisMin ?? 0;
  const span = yMax - yMin || 1;

  const W = 720;
  const H = 300;
  const pad = { t: 18, r: 68, b: 34, l: 50 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xAt = (i) => pad.l + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const yAt = (v) => pad.t + plotH - ((v - yMin) / span) * plotH;

  const svg = svgEl('svg', {
    class: 'chart-svg',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': `${block.metric || 'Cutoff'} by category, ${years[0]} to ${years[years.length - 1]}. The same figures are listed in the table below.`
  });

  /* recessive grid */
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + (span * i) / ticks;
    const y = yAt(v);
    svg.append(svgEl('line', { class: 'grid-line', x1: pad.l, x2: pad.l + plotW, y1: y, y2: y }));
    const label = svgEl('text', { class: 'axis-text', x: pad.l - 9, y: y + 3.5, 'text-anchor': 'end' });
    label.textContent = fmt(v, v % 1 === 0 ? 0 : Math.min(decimals, 1));
    svg.append(label);
  }

  /* x labels */
  rows.forEach((r, i) => {
    const label = svgEl('text', { class: 'axis-text', x: xAt(i), y: H - 12, 'text-anchor': 'middle' });
    label.textContent = r.year;
    svg.append(label);
  });

  /* series */
  bands.forEach((band, bi) => {
    const stroke = colorFor(bi);
    let path = '';
    let open = false;
    rows.forEach((r, i) => {
      const v = r.values[band.id];
      if (typeof v !== 'number') { open = false; return; }
      path += `${open ? 'L' : 'M'}${xAt(i).toFixed(2)},${yAt(v).toFixed(2)} `;
      open = true;
    });
    if (path) svg.append(svgEl('path', { class: 'series-line', d: path.trim(), stroke }));

    rows.forEach((r, i) => {
      const v = r.values[band.id];
      if (typeof v !== 'number') return;
      svg.append(svgEl('circle', { class: 'series-dot', cx: xAt(i), cy: yAt(v), r: 4, fill: stroke }));
    });

    /* direct label at the last present point — identity never by colour alone */
    if (bands.length <= 5) {
      for (let i = rows.length - 1; i >= 0; i--) {
        const v = rows[i].values[band.id];
        if (typeof v !== 'number') continue;
        const t = svgEl('text', {
          class: 'direct-label',
          x: xAt(i) + 9,
          y: yAt(v) + 3.5,
          fill: stroke,
          'text-anchor': 'start'
        });
        t.textContent = fmt(v, decimals);
        svg.append(t);
        break;
      }
    }
  });

  const crosshair = svgEl('line', { class: 'crosshair', y1: pad.t, y2: pad.t + plotH, opacity: 0 });
  svg.append(crosshair);

  /* legend — always present for 2+ series */
  const legend = el('div', { class: 'chart-legend' },
    bands.map((b, i) =>
      el('span', { class: 'legend-item' },
        el('span', { class: 'legend-swatch', style: `background:${colorFor(i)}` }),
        b.label
      )
    )
  );

  const tip = el('div', { class: 'chart-tip', role: 'status', 'aria-live': 'off' });
  const shell = el('div', { class: 'chart-shell' }, legend, svg, tip);

  /* hover layer */
  const showAt = (index, clientX) => {
    const r = rows[index];
    if (!r) return;
    const x = xAt(index);
    crosshair.setAttribute('x1', x);
    crosshair.setAttribute('x2', x);
    crosshair.setAttribute('opacity', 1);

    tip.replaceChildren(
      el('span', { class: 'tip-year' }, `${r.year}${r.revised ? ' · revised later' : ''}`),
      ...bands.map((b, i) =>
        el('div', { class: 'tip-row' },
          el('span', { class: 'k' },
            el('span', { class: 'legend-swatch', style: `background:${colorFor(i)}` }),
            b.label
          ),
          el('span', { class: 'v' }, `${fmt(r.values[b.id], decimals)}${typeof r.values[b.id] === 'number' && unit === 'percentile' ? '' : ''}`)
        )
      )
    );
    tip.dataset.show = '1';

    const box = shell.getBoundingClientRect();
    const relX = clientX !== undefined ? clientX - box.left : (x / W) * box.width;
    const tipW = tip.offsetWidth || 150;
    let left = relX + 14;
    if (left + tipW > box.width) left = relX - tipW - 14;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `28px`;
  };

  const hide = () => {
    crosshair.setAttribute('opacity', 0);
    tip.dataset.show = '0';
  };

  const nearest = (clientX) => {
    const box = svg.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    let best = 0;
    let bestD = Infinity;
    rows.forEach((_, i) => {
      const d = Math.abs(xAt(i) - px);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  svg.addEventListener('pointermove', (e) => showAt(nearest(e.clientX), e.clientX));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointerdown', (e) => showAt(nearest(e.clientX), e.clientX));

  return shell;
}

/* ---------- table -------------------------------------------------------- */

function buildTable(block, extraCols = []) {
  const { bands, series, decimals = 0 } = block;
  const rows = [...series].sort((a, b) => a.year - b.year);

  const head = el('tr', {},
    el('th', { scope: 'col' }, 'Year'),
    bands.map((b, i) =>
      el('th', { scope: 'col' },
        el('span', { class: 'cat-head' },
          el('span', { class: 'legend-swatch', style: `background:${colorFor(i)}` }),
          b.label
        )
      )
    ),
    extraCols.map((c) => el('th', { scope: 'col' }, c.label)),
    el('th', { scope: 'col' }, 'Source')
  );

  const body = rows.map((r) =>
    el('tr', {},
      el('th', { scope: 'row', style: 'text-align:left;font-family:var(--font-mono);font-weight:500;padding:.55rem .75rem;border-bottom:1px solid var(--rule-soft);' }, String(r.year)),
      bands.map((b) => {
        const v = r.values[b.id];
        return el('td', { class: typeof v === 'number' ? null : 'empty' }, fmt(v, decimals));
      }),
      extraCols.map((c) => el('td', { class: c.get(r) ? null : 'empty' }, c.get(r) || '—')),
      el('td', {}, flagChip(r.confidence))
    )
  );

  return el('div', { class: 'table-scroll' },
    el('table', {},
      el('thead', {}, head),
      el('tbody', {}, body)
    )
  );
}

/* ---------- exam record -------------------------------------------------- */

function buildRecord(exam, sources) {
  const section = el('section', { class: 'record', id: exam.id });

  const head = el('div', { class: 'record-head' },
    el('div', { class: 'record-title-row' },
      el('h2', {}, exam.name),
      el('span', { class: 'record-stream' }, exam.stream)
    ),
    el('p', { class: 'record-summary' }, exam.summary)
  );

  const meta = el('dl', { class: 'meta-strip' },
    el('div', {}, el('dt', {}, 'Conducted by'), el('dd', {}, exam.authority)),
    el('div', {}, el('dt', {}, 'Leads to'), el('dd', {}, exam.leadsTo)),
    el('div', {}, el('dt', {}, 'Data coverage'), el('dd', {}, coverageLabel(exam)))
  );

  const body = el('div', { class: 'record-body' });

  if (exam.qualifying && exam.qualifying.series && exam.qualifying.series.length) {
    const q = exam.qualifying;
    const panel = el('div', {});
    panel.append(
      el('div', { class: 'panel-label' },
        el('h3', {}, q.metric),
        el('span', { class: 'unit' }, q.unit)
      )
    );

    const chart = buildChart(q);
    const extraCols = [];
    if (q.series.some((r) => r.absolute)) {
      extraCols.push({
        label: 'Absolute marks',
        get: (r) => r.absolute ? Object.values(r.absolute).join(' / ') + (r.total ? ` of ${r.total}` : '') : null
      });
    }
    if (q.series.some((r) => r.range)) {
      extraCols.push({ label: 'Published band', get: (r) => r.range ? Object.values(r.range).join('  ·  ') : null });
    }
    const table = buildTable(q, extraCols);

    if (chart && q.series.length > 1) {
      panel.append(el('div', { class: 'split' }, chart, table));
    } else {
      panel.append(table);
    }

    if (q.scaleChange) {
      panel.append(el('p', { class: 'callout', style: 'margin-top:1rem' },
        el('strong', {}, 'Scale change. '), q.scaleChange.note));
    }

    const revisions = q.series.filter((r) => r.revised);
    if (revisions.length) {
      panel.append(
        el('div', { class: 'callout', style: 'margin-top:1rem' },
          el('strong', {}, 'Revised after announcement. '),
          'The bar below is what was first published; these years were cut later to fill vacant seats — ',
          revisions.map((r, i) => el('span', {}, `${i ? '; ' : ''}${r.year}: ${r.revised.replace(/\.$/, '')}`)),
          '.'
        )
      );
    }

    body.append(panel);
  }

  if (exam.streamCutoffs) {
    body.append(buildStreamTable(exam.streamCutoffs));
  }

  if (exam.passMark) {
    body.append(buildPassMark(exam));
  }

  if (exam.closing && exam.closing.series && exam.closing.series.length) {
    const c = exam.closing;
    const panel = el('div', {});
    panel.append(
      el('div', { class: 'panel-label' },
        el('h3', {}, c.metric),
        el('span', { class: 'unit' }, c.unit)
      ),
      buildTable(c, [])
    );
    body.append(panel);
  }

  if (!exam.qualifying && !exam.streamCutoffs && !exam.passMark) {
    body.append(
      el('div', { class: 'structural-only' },
        el('p', {},
          el('strong', {}, exam.status === 'none' ? 'No cutoff series exists. ' : 'No category-wise series exists. '),
          exam.status === 'none'
            ? 'Nothing is charted here because nothing has been published.'
            : 'The qualifying rule does not vary by category, so a General/EWS/OBC/SC/ST breakdown would be fabricated.'
        )
      )
    );
  }

  if (exam.notes && exam.notes.length) {
    body.append(
      el('div', {},
        el('div', { class: 'panel-label' }, el('h3', {}, 'What the numbers do and do not say')),
        el('ul', { class: 'notes' }, exam.notes.map((n) => el('li', {}, n)))
      )
    );
  }

  if (exam.sources && exam.sources.length) {
    body.append(
      el('p', { style: 'margin:0;font-size:var(--step--1);color:var(--ink-3)' },
        'Sources: ',
        exam.sources.map((id, i) => {
          const s = sources[id];
          if (!s) return null;
          return el('span', {}, i ? ' · ' : '', el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label));
        })
      )
    );
  }

  section.append(head, meta, body);
  return section;
}

function coverageLabel(exam) {
  const q = exam.qualifying;
  if (q && q.series && q.series.length) {
    const ys = q.series.map((r) => r.year).sort((a, b) => a - b);
    const expected = ys[ys.length - 1] - ys[0] + 1;
    const gaps = expected - ys.length;
    return `${ys[0]}–${ys[ys.length - 1]}${gaps > 0 ? ` · ${gaps} year${gaps > 1 ? 's' : ''} missing` : ' · complete'}`;
  }
  if (exam.passMark) return 'Fixed pass mark · no category split';
  if (exam.streamCutoffs) return `${exam.streamCutoffs.year} only · by stream`;
  if (exam.status === 'none') return 'No published data';
  return 'Rule documented · no series';
}

function buildStreamTable(sc) {
  const head = el('tr', {},
    el('th', { scope: 'col' }, 'Stream'),
    el('th', { scope: 'col' }, 'UR / EWS'),
    el('th', { scope: 'col' }, 'OBC / SC / ST'),
    el('th', { scope: 'col' }, 'UR-PwD')
  );
  const body = sc.rows.map((r) =>
    el('tr', {},
      el('th', { scope: 'row', style: 'text-align:left;padding:.55rem .75rem;border-bottom:1px solid var(--rule-soft);font-weight:500;' }, r.stream),
      el('td', { class: r.ur == null ? 'empty' : null }, r.ur ?? '—'),
      el('td', { class: r.res == null ? 'empty' : null }, r.res ?? '—'),
      el('td', { class: r.urPwd == null ? 'empty' : null }, r.urPwd ?? '—')
    )
  );
  return el('div', {},
    el('div', { class: 'panel-label' },
      el('h3', {}, `Stream-wise qualifying marks, ${sc.year}`),
      el('span', { class: 'unit' }, sc.unit)
    ),
    el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, head), el('tbody', {}, body))),
    el('p', { style: 'margin:.7rem 0 0;font-size:var(--step--1);color:var(--ink-3)' }, flagChip(sc.confidence))
  );
}

function buildPassMark(exam) {
  const pm = exam.passMark;
  const head = el('tr', {},
    el('th', { scope: 'col' }, 'Session'),
    el('th', { scope: 'col' }, 'Pass rate'),
    el('th', { scope: 'col' }, 'Appeared'),
    el('th', { scope: 'col' }, 'Passed')
  );
  const body = (exam.passRates || []).map((r) =>
    el('tr', {},
      el('th', { scope: 'row', style: 'text-align:left;padding:.55rem .75rem;border-bottom:1px solid var(--rule-soft);font-weight:500;' }, r.session),
      el('td', {}, `${r.rate}%`),
      el('td', { class: r.appeared ? null : 'empty' }, r.appeared ? r.appeared.toLocaleString('en-IN') : '—'),
      el('td', { class: r.passed ? null : 'empty' }, r.passed ? r.passed.toLocaleString('en-IN') : '—')
    )
  );

  return el('div', {},
    el('div', { class: 'panel-label' },
      el('h3', {}, 'A fixed bar, a moving pass rate'),
      el('span', { class: 'unit' }, `${pm.marks} of ${pm.total} · ${pm.percent}%`)
    ),
    el('p', { class: 'callout', style: 'margin-bottom:1rem' },
      el('strong', {}, 'No category relaxation. '),
      `Every candidate needs ${pm.marks} of ${pm.total}, regardless of category. There is no General/EWS/OBC/SC/ST cutoff to chart.`
    ),
    el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, head), el('tbody', {}, body)))
  );
}

/* ---------- benchmarks --------------------------------------------------- */

function buildBenchmark(bm) {
  const block = { bands: bm.bands, series: bm.series, decimals: 0, unit: bm.unit, metric: bm.unit };
  const section = el('section', { class: 'record', id: bm.id },
    el('div', { class: 'record-head' },
      el('div', { class: 'record-title-row' },
        el('h2', {}, bm.name),
        el('span', { class: 'record-stream' }, bm.authority)
      ),
      el('p', { class: 'record-summary' }, bm.rankNote)
    ),
    el('div', { class: 'record-body' },
      el('div', {},
        el('div', { class: 'panel-label' },
          el('h3', {}, 'Closing ranks by category'),
          el('span', { class: 'unit' }, bm.unit)
        ),
        buildTable(block, [])
      ),
      bm.notes && bm.notes.length
        ? el('ul', { class: 'notes' }, bm.notes.map((n) => el('li', {}, n)))
        : null
    )
  );
  return section;
}

/* ---------- page assembly ------------------------------------------------ */

function renderIndex(data) {
  const bar = document.getElementById('index-links');
  data.exams.forEach((e) => bar.append(el('a', { href: `#${e.id}` }, e.name)));
  data.benchmarks.forEach((b) => bar.append(el('a', { href: `#${b.id}` }, b.name.split('—')[0].trim())));
}

function renderSources(data) {
  const list = document.getElementById('source-list');
  const entries = Object.entries(data.sources).sort((a, b) => {
    if (a[1].tier !== b[1].tier) return a[1].tier === 'primary' ? -1 : 1;
    return a[1].label.localeCompare(b[1].label);
  });
  entries.forEach(([, s]) => {
    list.append(
      el('div', { class: 'source-row' },
        el('span', { class: 'tier', 'data-tier': s.tier }, s.tier),
        el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label)
      )
    );
  });
}

function renderStamps(data) {
  const primary = Object.values(data.sources).filter((s) => s.tier === 'primary').length;
  const officialRows = data.exams.reduce((n, e) => {
    const rows = (e.qualifying && e.qualifying.series) || [];
    return n + rows.filter((r) => r.confidence === 'official').length;
  }, 0);
  const totalRows = data.exams.reduce((n, e) => n + (((e.qualifying && e.qualifying.series) || []).length), 0);

  document.getElementById('stamp-updated').textContent = data.meta.lastUpdated;
  document.getElementById('stamp-exams').textContent = String(data.exams.length);
  document.getElementById('stamp-rows').textContent = `${officialRows} of ${totalRows} from primary documents`;
  document.getElementById('stamp-sources').textContent = `${primary} primary`;
}

function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const stored = (() => { try { return localStorage.getItem('iec-theme'); } catch { return null; } })();
  if (stored === 'dark' || stored === 'light') document.documentElement.dataset.theme = stored;

  const label = () => {
    const explicit = document.documentElement.dataset.theme;
    const dark = explicit ? explicit === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    btn.textContent = dark ? 'Light' : 'Dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };

  btn.addEventListener('click', () => {
    const explicit = document.documentElement.dataset.theme;
    const dark = explicit ? explicit === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('iec-theme', next); } catch { /* private mode */ }
    label();
  });

  label();
}

async function main() {
  initTheme();
  let data;
  try {
    const res = await fetch('data/cutoffs.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    document.getElementById('records').append(
      el('div', { class: 'callout' },
        el('strong', {}, 'The dataset did not load. '),
        'data/cutoffs.json could not be read. If you are opening index.html directly from disk, run a local server instead — browsers block fetch on file:// URLs.'
      )
    );
    return;
  }

  document.title = `${data.meta.title}`;
  renderStamps(data);
  renderIndex(data);

  const records = document.getElementById('records');
  data.exams.forEach((e) => records.append(buildRecord(e, data.sources)));

  const benchWrap = document.getElementById('benchmarks');
  data.benchmarks.forEach((b) => benchWrap.append(buildBenchmark(b)));

  renderSources(data);
}

main();
