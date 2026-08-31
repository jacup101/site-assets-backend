#!/usr/bin/env node
// Canary smoke test — run manually (`npm run canary`, or the "Canary"
// GitHub Actions workflow) after deploying, before flipping brandon-site's
// prod auto-deploy back on. Hits the live public API and checks it's not
// just responding, but actually serving the content it should be — a
// misconfigured deploy, an empty D1 table, or a broken migration can all
// return a healthy 200 with nothing (or the wrong thing) in it.
//
// Configurable via env vars (all optional):
//   BASE_URL       - defaults to the deployed Worker's workers.dev URL
//   SITE_ID        - defaults to 'brandon-site' (prod); pass
//                     'brandon-site-beta' to check beta instead
//   EXPECTED_SLUGS - comma-separated post-sound slugs that must be present;
//                     defaults to a handful of real, long-standing credits
//   MIN_ENTRIES    - sanity floor on total entry count; defaults to 20

const BASE_URL = process.env.BASE_URL || 'https://site-assets-backend.jacup105.workers.dev';
const SITE_ID = process.env.SITE_ID || 'brandon-site';
const MIN_ENTRIES = Number(process.env.MIN_ENTRIES || 20);
const EXPECTED_SLUGS = (
  process.env.EXPECTED_SLUGS ||
  'the-hum,still-in-love,no-place-for-football,the-kingdom-of-rexmonte,molokai-bound'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let failures = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failures++;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function checkHealth() {
  console.log(`Checking ${BASE_URL}/health ...`);
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) return fail('Worker responded', `status ${res.status}`);
    pass('Worker responded 200');
    const body = await res.json().catch(() => null);
    if (body?.ok === true) pass('Health body looks right');
    else fail('Health body looks right', `got ${JSON.stringify(body)}`);
  } catch (err) {
    fail('Worker reachable', String(err));
  }
}

async function checkEntries() {
  const url = `${BASE_URL}/public/sites/${SITE_ID}/collections/post-sound/entries`;
  console.log(`\nChecking ${url} ...`);

  let entries;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      fail('Public entries endpoint responded', `status ${res.status}`);
      return null;
    }
    pass('Public entries endpoint responded 200');
    entries = await res.json();
  } catch (err) {
    fail('Public entries endpoint reachable', String(err));
    return null;
  }

  if (!Array.isArray(entries)) {
    fail('Response is an array', `got ${typeof entries}`);
    return null;
  }
  pass('Response is an array');

  if (entries.length >= MIN_ENTRIES) pass(`At least ${MIN_ENTRIES} entries (found ${entries.length})`);
  else fail(`At least ${MIN_ENTRIES} entries`, `found ${entries.length}`);

  const foundSlugs = new Set(entries.map((e) => e.slug));
  for (const slug of EXPECTED_SLUGS) {
    if (foundSlugs.has(slug)) pass(`"${slug}" is present`);
    else fail(`"${slug}" is present`, 'missing from response');
  }

  const malformed = entries.filter((e) => !e.data?.title || !e.data?.imgPath);
  if (malformed.length === 0) pass('Every entry has a title and image');
  else fail('Every entry has a title and image', `${malformed.length} missing one`);

  return entries;
}

async function checkOneImage(entries) {
  const sample = entries?.find((e) => e.data?.imgPath);
  if (!sample) {
    fail('Sample image asset loads', 'no entry with an imgPath to test');
    return;
  }

  const raw = sample.data.imgPath;
  const slashIndex = raw.indexOf('/');
  const assetSiteId = slashIndex === -1 ? SITE_ID : raw.slice(0, slashIndex);
  const filename = slashIndex === -1 ? raw : raw.slice(slashIndex + 1);
  const url = `${BASE_URL}/public/sites/${assetSiteId}/assets/${filename}`;

  console.log(`\nChecking sample image ${url} ...`);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) pass(`Image asset for "${sample.slug}" loads`);
    else fail(`Image asset for "${sample.slug}" loads`, `status ${res.status}`);
  } catch (err) {
    fail('Sample image asset reachable', String(err));
  }
}

console.log(`Canary: site-assets-backend (${SITE_ID})\n`);
await checkHealth();
const entries = await checkEntries();
await checkOneImage(entries);

console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
