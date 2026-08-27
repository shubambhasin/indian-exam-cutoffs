#!/usr/bin/env node
/**
 * Validates data/cutoffs.json.
 *
 * This exists so that updating the dataset a year from now cannot silently
 * break the site. Run `npm run validate` before committing; CI runs it on
 * every push and pull request.
 *
 * Exits 1 on any error. Warnings do not fail the build but are printed.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(here, '..', 'data', 'cutoffs.json');

const CONFIDENCE = new Set(['official', 'verified', 'single-source', 'none']);
const KNOWN_CATEGORIES = new Set(['gen', 'ews', 'obc', 'sc', 'st']);
const MAX_SERIES_COLORS = 5;

const errors = [];
const warnings = [];

const err = (path, msg) => errors.push(`${path}: ${msg}`);
const warn = (path, msg) => warnings.push(`${path}: ${msg}`);

function checkBlock(block, path, { requireSeries = true } = {}) {
  if (!Array.isArray(block.bands) || block.bands.length === 0) {
    err(path, 'missing "bands" array');
    return;
  }

  if (block.bands.length > MAX_SERIES_COLORS) {
    err(path, `${block.bands.length} bands, but only ${MAX_SERIES_COLORS} validated series colours exist. Merge bands or extend the palette (and re-run the dataviz validator).`);
  }

  const bandIds = new Set();
  const seenCategories = new Set();

  for (const [i, band] of block.bands.entries()) {
    const bp = `${path}.bands[${i}]`;
    if (!band.id) err(bp, 'missing "id"');
    if (!band.label) err(bp, 'missing "label"');
    if (bandIds.has(band.id)) err(bp, `duplicate band id "${band.id}"`);
    bandIds.add(band.id);

    if (!Array.isArray(band.categories) || band.categories.length === 0) {
      err(bp, 'missing "categories" — every band must declare which of gen/ews/obc/sc/st it covers');
    } else {
      for (const c of band.categories) {
        if (!KNOWN_CATEGORIES.has(c)) err(bp, `unknown category "${c}"`);
        if (seenCategories.has(c)) err(bp, `category "${c}" is claimed by more than one band`);
        seenCategories.add(c);
      }
    }
  }

  if (!requireSeries) return;

  if (!Array.isArray(block.series) || block.series.length === 0) {
    err(path, 'missing "series" array');
    return;
  }

  const years = new Set();
  for (const [i, row] of block.series.entries()) {
    const rp = `${path}.series[${i}]`;

    if (typeof row.year !== 'number' || !Number.isInteger(row.year)) {
      err(rp, 'year must be an integer');
    } else {
      if (years.has(row.year)) err(rp, `duplicate year ${row.year}`);
      years.add(row.year);
      if (row.year < 2019) warn(rp, `year ${row.year} predates the EWS category (introduced 2019)`);
      if (row.year > new Date().getFullYear() + 1) err(rp, `year ${row.year} is implausibly far in the future`);
    }

    if (!row.values || typeof row.values !== 'object') {
      err(rp, 'missing "values" object');
      continue;
    }

    for (const key of Object.keys(row.values)) {
      if (!bandIds.has(key)) err(rp, `value key "${key}" does not match any band id`);
    }
    for (const id of bandIds) {
      if (!(id in row.values)) err(rp, `missing a value for band "${id}" (use null for a genuine gap)`);
    }
    for (const [k, v] of Object.entries(row.values)) {
      if (v !== null && typeof v !== 'number') err(rp, `value "${k}" must be a number or null, got ${typeof v}`);
      if (typeof v === 'number' && v < 0) err(rp, `value "${k}" is negative`);
    }

    if (!CONFIDENCE.has(row.confidence)) {
      err(rp, `confidence must be one of ${[...CONFIDENCE].join(', ')} — got "${row.confidence}"`);
    }
    if (!row.source) err(rp, 'missing "source" (a key from the top-level sources map)');
  }
}

function checkAxis(block, path) {
  if (!block.series) return;
  const values = block.series.flatMap((r) => Object.values(r.values || {})).filter((v) => typeof v === 'number');
  if (values.length === 0) return;
  const max = Math.max(...values);
  if (typeof block.axisMax === 'number' && max > block.axisMax) {
    err(path, `axisMax is ${block.axisMax} but the data reaches ${max} — the chart would clip. Raise axisMax.`);
  }
}

async function main() {
  let raw;
  try {
    raw = await readFile(DATA_PATH, 'utf8');
  } catch (e) {
    console.error(`Could not read ${DATA_PATH}: ${e.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`data/cutoffs.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }

  if (!data.meta || !data.meta.lastUpdated) err('meta', 'missing "lastUpdated"');
  if (data.meta && data.meta.lastUpdated && !/^\d{4}-\d{2}-\d{2}$/.test(data.meta.lastUpdated)) {
    err('meta.lastUpdated', 'must be YYYY-MM-DD');
  }

  if (!data.sources || typeof data.sources !== 'object') {
    err('sources', 'missing top-level sources map');
  }
  const sourceIds = new Set(Object.keys(data.sources || {}));
  for (const [id, s] of Object.entries(data.sources || {})) {
    if (!s.label) err(`sources.${id}`, 'missing "label"');
    if (!s.url) err(`sources.${id}`, 'missing "url"');
    if (s.tier !== 'primary' && s.tier !== 'secondary') err(`sources.${id}`, 'tier must be "primary" or "secondary"');
  }

  if (!Array.isArray(data.exams) || data.exams.length === 0) {
    err('exams', 'missing exams array');
  }

  const examIds = new Set();
  const usedSources = new Set();

  for (const [i, exam] of (data.exams || []).entries()) {
    const p = `exams[${i}]${exam.id ? ` (${exam.id})` : ''}`;
    for (const field of ['id', 'name', 'stream', 'authority', 'leadsTo', 'status', 'summary']) {
      if (!exam[field]) err(p, `missing "${field}"`);
    }
    if (examIds.has(exam.id)) err(p, `duplicate exam id "${exam.id}"`);
    examIds.add(exam.id);

    for (const sid of exam.sources || []) {
      usedSources.add(sid);
      if (!sourceIds.has(sid)) err(p, `references unknown source "${sid}"`);
    }

    if (exam.qualifying) {
      checkBlock(exam.qualifying, `${p}.qualifying`);
      checkAxis(exam.qualifying, `${p}.qualifying`);
      if (!exam.qualifying.metric) err(`${p}.qualifying`, 'missing "metric"');
      if (!exam.qualifying.unit) err(`${p}.qualifying`, 'missing "unit"');
      for (const row of exam.qualifying.series || []) usedSources.add(row.source);
    }

    if (exam.closing) {
      checkBlock(exam.closing, `${p}.closing`);
      for (const row of exam.closing.series || []) usedSources.add(row.source);
    }

    if (exam.streamCutoffs) {
      usedSources.add(exam.streamCutoffs.source);
      if (!Array.isArray(exam.streamCutoffs.rows)) err(`${p}.streamCutoffs`, 'missing "rows"');
    }

    const hasData = Boolean(exam.qualifying || exam.closing || exam.streamCutoffs || exam.passMark);
    if (!hasData && exam.status !== 'none' && exam.status !== 'structural') {
      err(p, `status "${exam.status}" implies data, but no qualifying/closing/streamCutoffs/passMark block is present`);
    }
    if (hasData && exam.status === 'none') {
      err(p, 'status is "none" but the exam carries data');
    }
  }

  for (const [i, bm] of (data.benchmarks || []).entries()) {
    const p = `benchmarks[${i}]${bm.id ? ` (${bm.id})` : ''}`;
    for (const field of ['id', 'name', 'authority', 'unit', 'rankType', 'rankNote']) {
      if (!bm[field]) err(p, `missing "${field}"`);
    }
    if (bm.examId && !examIds.has(bm.examId)) err(p, `examId "${bm.examId}" does not match any exam`);
    checkBlock(bm, p);
    for (const row of bm.series || []) usedSources.add(row.source);
  }

  for (const sid of usedSources) {
    if (sid && !sourceIds.has(sid)) err('sources', `row references unknown source "${sid}"`);
  }
  for (const sid of sourceIds) {
    if (!usedSources.has(sid)) warn('sources', `"${sid}" is defined but never referenced`);
  }

  if (warnings.length) {
    console.log(`\n${warnings.length} warning${warnings.length > 1 ? 's' : ''}:`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }

  if (errors.length) {
    console.error(`\n${errors.length} error${errors.length > 1 ? 's' : ''}:`);
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    console.error('\nvalidate: FAILED');
    process.exit(1);
  }

  const examCount = (data.exams || []).length;
  const rowCount = (data.exams || []).reduce(
    (n, e) => n + (((e.qualifying && e.qualifying.series) || []).length),
    0
  );
  console.log(`\nvalidate: OK — ${examCount} exams, ${rowCount} qualifying rows, ${sourceIds.size} sources.`);
}

main();
