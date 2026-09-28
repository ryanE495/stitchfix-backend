#!/usr/bin/env node
/**
 * One-time importer for the Facebook groups Google Sheet.
 *
 *   node scripts/import-fb-groups.mjs path/to/export.csv           # dry run
 *   node scripts/import-fb-groups.mjs path/to/export.csv --apply   # write
 *
 * Reads Supabase credentials from .env.local. Writing requires a signed-in
 * user because the tables are authenticated-only (migration 011/013), so set
 * STITCHWORKS_EMAIL and STITCHWORKS_PASSWORD in the environment, or pass
 * --email / --password.
 *
 * EXPECTED COLUMNS (header row, case-insensitive, order does not matter):
 *   Group             group name
 *   URL               the group's facebook.com URL   <- add this column
 *   Sunday..Saturday  NON-EMPTY = allowed that day   <- put an x in the
 *                     green cells before exporting; CSV drops cell colors
 *   Last Interaction  date of the most recent post (any parseable format)
 *   Script Test       template name used, free text (recorded in notes)
 *   Results?          free text (recorded in notes)
 *   Notes             free text -> rule_notes
 *
 * REGION comes from section header rows: a row whose Group cell is filled but
 * whose URL cell is empty is treated as a heading, and applies to every row
 * beneath it until the next heading.
 *
 * DEDUPE is on URL. Existing rows are never silently overwritten -- conflicts
 * are printed for you to resolve.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const apply = argv.includes('--apply');
// --offline: parse and report only, never contact the database. Lets you
// check an export before wiring up credentials.
const offline = argv.includes('--offline');
const argOf = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (!file) {
  console.error('Usage: node scripts/import-fb-groups.mjs <export.csv> [--offline|--apply]');
  process.exit(1);
}

// ── env ─────────────────────────────────────────────────────────────────
function readEnvLocal() {
  const out = {};
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* fall through to process.env */
  }
  return out;
}
const env = { ...readEnvLocal(), ...process.env };
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env.local).');
  process.exit(1);
}

// ── CSV parsing (RFC 4180: quoted fields, escaped quotes, embedded newlines)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM, which Google Sheets exports include and which would
  // otherwise become part of the first header name.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ── mapping helpers ─────────────────────────────────────────────────────
const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function regionFor(heading) {
  const h = (heading || '').toLowerCase();
  if (/ouray|montrose|san\s*miguel|ridgway|telluride|norwood/.test(h))
    return 'ouray_montrose_san_miguel';
  if (/grand\s*junction|gj|fruita|palisade|mesa/.test(h)) return 'grand_junction';
  return 'other';
}

/** Parse a spreadsheet-ish date into YYYY-MM-DD, or null. */
function parseDate(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  // Accept M/D/YY, M/D/YYYY, YYYY-MM-DD, "Sep 3, 2026", etc.
  // YYYY-MM-DD must be built from parts: new Date('2026-09-20') is parsed as
  // UTC midnight, and reading it back with local getters lands on the 19th
  // anywhere west of Greenwich.
  const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    const dt = new Date(Number(isoLike[1]), Number(isoLike[2]) - 1, Number(isoLike[3]));
    return Number.isNaN(dt.getTime()) ? null : iso(dt);
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let [, m, d, y] = slash;
    y = Number(y);
    if (y < 100) y += 2000;
    const dt = new Date(y, Number(m) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : iso(dt);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : iso(dt);
}
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function normalizeUrl(raw) {
  let u = (raw || '').trim();
  if (!u) return null;
  // Sheets sometimes exports =HYPERLINK("url","label")
  const hy = u.match(/HYPERLINK\(\s*"([^"]+)"/i);
  if (hy) u = hy[1];
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    parsed.hash = '';
    parsed.search = '';
    // Trailing slashes make otherwise-identical URLs look distinct.
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return null;
  }
}

// ── read + map ──────────────────────────────────────────────────────────
const rows = parseCsv(readFileSync(file, 'utf8'));
if (rows.length < 2) {
  console.error('That file has no data rows.');
  process.exit(1);
}

const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (...names) => {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
};

const iGroup = col('group', 'group name', 'name');
const iUrl = col('url', 'link', 'group url');
const iLast = col('last interaction', 'last interaction date', 'last posted');
const iScript = col('script test', 'script', 'template');
const iResults = col('results?', 'results', 'result');
const iNotes = col('notes', 'note');
const dayCols = DAY_NAMES.map((d) => col(d, d.slice(0, 3)));

if (iGroup < 0) {
  console.error(`No "Group" column found. Headers seen: ${header.join(', ')}`);
  process.exit(1);
}
if (iUrl < 0) {
  console.error(
    'No "URL" column found. Add one with each group\'s link — group-name\n' +
      'hyperlinks do not survive a CSV export, and URL is the dedupe key.',
  );
  process.exit(1);
}

const parsed = [];
const skipped = [];
let heading = '';
let sawAnyDayMark = false;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const cell = (i) => (i >= 0 && i < row.length ? row[i].trim() : '');
  const name = cell(iGroup);
  const rawUrl = cell(iUrl);

  if (!name) continue;

  // Section header: a name with no URL.
  if (!rawUrl) {
    heading = name;
    continue;
  }

  const url = normalizeUrl(rawUrl);
  if (!url) {
    skipped.push({ line: r + 1, name, reason: `unparseable URL "${rawUrl}"` });
    continue;
  }

  const marked = [];
  dayCols.forEach((ci, day) => {
    if (ci >= 0 && cell(ci) !== '') marked.push(day);
  });
  if (marked.length > 0) sawAnyDayMark = true;

  const noteBits = [];
  if (cell(iNotes)) noteBits.push(cell(iNotes));
  if (cell(iScript)) noteBits.push(`Script test: ${cell(iScript)}`);
  if (cell(iResults)) noteBits.push(`Results: ${cell(iResults)}`);

  parsed.push({
    name,
    url,
    region: regionFor(heading),
    heading,
    allowed_weekdays: marked.length > 0 ? marked : ALL_DAYS,
    rule_notes: noteBits.join(' | ') || null,
    lastInteraction: parseDate(cell(iLast)),
    line: r + 1,
  });
}

// ── in-file duplicates ──────────────────────────────────────────────────
const byUrl = new Map();
const dupesInFile = [];
for (const p of parsed) {
  if (byUrl.has(p.url)) dupesInFile.push({ first: byUrl.get(p.url), second: p });
  else byUrl.set(p.url, p);
}

// ── compare against the database ────────────────────────────────────────
let existingRows = [];
let supabase = null;

if (offline && apply) {
  console.error('--offline and --apply cannot be combined.');
  process.exit(1);
}

if (!offline) {
  supabase = createClient(url, anonKey);

  const email = argOf('--email') ?? env.STITCHWORKS_EMAIL;
  const password = argOf('--password') ?? env.STITCHWORKS_PASSWORD;
  if (email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(`Sign-in failed: ${error.message}`);
      process.exit(1);
    }
  } else if (apply) {
    console.error(
      'Writing needs a login (these tables are authenticated-only). ' +
        'Set STITCHWORKS_EMAIL and STITCHWORKS_PASSWORD, or pass --email / --password.',
    );
    process.exit(1);
  }

  const { data, error: readErr } = await supabase
    .from('stitchworks_fb_groups')
    .select('id, name, url, region, allowed_weekdays, rule_notes');
  if (readErr) {
    console.error(`Could not read existing groups: ${readErr.message}`);
    if (!email) {
      console.error(
        '(Reading also needs a login. Use --offline to check the file without ' +
          ' touching the database.)',
      );
    }
    process.exit(1);
  }
  existingRows = data ?? [];
}

const existingByUrl = new Map((existingRows ?? []).map((g) => [g.url, g]));

const toInsert = [];
const conflicts = [];
for (const p of byUrl.values()) {
  const hit = existingByUrl.get(p.url);
  if (!hit) {
    toInsert.push(p);
    continue;
  }
  const diffs = [];
  if (hit.name !== p.name) diffs.push(`name: "${hit.name}" -> "${p.name}"`);
  if (hit.region !== p.region) diffs.push(`region: ${hit.region} -> ${p.region}`);
  const a = [...(hit.allowed_weekdays ?? [])].sort().join(',');
  const b = [...p.allowed_weekdays].sort().join(',');
  if (a !== b) diffs.push(`allowed_weekdays: [${a}] -> [${b}]`);
  conflicts.push({ row: p, existing: hit, diffs });
}

// ── report ──────────────────────────────────────────────────────────────
const fmtDays = (d) =>
  d.length === 7 ? 'all days' : d.map((x) => DAY_NAMES[x].slice(0, 3)).join(',');

console.log(`\nParsed ${parsed.length} group rows from ${file}`);
console.log(`  new to import : ${toInsert.length}`);
if (!offline) console.log(`  already in DB : ${conflicts.length}`);
console.log(`  skipped       : ${skipped.length}`);
console.log(`  dupes in file : ${dupesInFile.length}`);

if (!sawAnyDayMark && dayCols.some((c) => c >= 0)) {
  console.log(
    '\n!! Every day column was empty across all rows.\n' +
      '   CSV exports drop cell colors, so green cells arrive blank. Put any\n' +
      '   character in the green cells and re-export, or every group will be\n' +
      '   imported as "all days allowed".',
  );
}

const byRegion = {};
for (const p of toInsert) byRegion[p.region] = (byRegion[p.region] ?? 0) + 1;
if (toInsert.length) {
  console.log('\nNew groups by region:');
  for (const [r, n] of Object.entries(byRegion)) console.log(`  ${r}: ${n}`);
  console.log('\nFirst 10 new groups:');
  for (const p of toInsert.slice(0, 10)) {
    console.log(
      `  L${p.line} ${p.name}\n      ${p.url}\n      region=${p.region} days=${fmtDays(p.allowed_weekdays)} last=${p.lastInteraction ?? 'none'}`,
    );
  }
}

if (dupesInFile.length) {
  console.log('\nDUPLICATE URLS INSIDE THE FILE (only the first is imported):');
  for (const d of dupesInFile)
    console.log(`  ${d.second.url}\n      L${d.first.line} "${d.first.name}" vs L${d.second.line} "${d.second.name}"`);
}

if (conflicts.length) {
  console.log('\nALREADY IN THE DATABASE — not touched. Resolve by hand if needed:');
  for (const c of conflicts) {
    console.log(`  ${c.row.url}`);
    if (c.diffs.length === 0) console.log('      identical, nothing to do');
    else for (const d of c.diffs) console.log(`      ${d}`);
  }
}

if (skipped.length) {
  console.log('\nSKIPPED ROWS:');
  for (const s of skipped) console.log(`  L${s.line} ${s.name} — ${s.reason}`);
}

// ── write ───────────────────────────────────────────────────────────────
if (offline) {
  console.log('');
  console.log('Offline parse only — the database was never contacted, so the');
  console.log(
    '"new to import" count does not account for groups already saved.',
  );
  process.exit(0);
}

if (!apply) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to insert.\n');
  process.exit(0);
}

if (toInsert.length === 0) {
  console.log('\nNothing new to insert.\n');
  process.exit(0);
}

const { data: inserted, error: insErr } = await supabase
  .from('stitchworks_fb_groups')
  .insert(
    toInsert.map((p) => ({
      name: p.name,
      url: p.url,
      region: p.region,
      allowed_weekdays: p.allowed_weekdays,
      rule_notes: p.rule_notes,
      rotation: 'A',
      status: 'active',
    })),
  )
  .select('id, url');
if (insErr) {
  console.error(`\nInsert failed: ${insErr.message}`);
  process.exit(1);
}

const idByUrl = new Map((inserted ?? []).map((g) => [g.url, g.id]));
const seedPosts = toInsert
  .filter((p) => p.lastInteraction && idByUrl.has(p.url))
  .map((p) => ({
    group_id: idByUrl.get(p.url),
    // Noon local avoids a midnight timestamp shifting to the previous day
    // once it is stored as UTC.
    posted_at: new Date(`${p.lastInteraction}T12:00:00`).toISOString(),
    notes: 'Seeded from sheet import (Last Interaction)',
  }));

let seeded = 0;
if (seedPosts.length) {
  const { error: postErr } = await supabase
    .from('stitchworks_fb_group_posts')
    .insert(seedPosts);
  if (postErr) console.error(`\nSeed posts failed: ${postErr.message}`);
  else seeded = seedPosts.length;
}

console.log(`\nInserted ${inserted?.length ?? 0} groups and ${seeded} seed posts.`);
console.log('Rotation defaults to A — use "Auto-balance A/B" on the Groups page.\n');
