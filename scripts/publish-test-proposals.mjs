#!/usr/bin/env node
// Publish the design-QA test slate to the real backend, following the same
// pattern as the June launch slate (content/civic-desk-2026-06-launch.json →
// .published.json). Proposals are created through the ordinary authenticated
// API, so they behave exactly like user-created proposals.
//
// Usage (email/password accounts):
//   REPRESENT_EMAIL=you@example.com REPRESENT_PASSWORD=yourpassword \
//     node scripts/publish-test-proposals.mjs
//
// Usage (Google/Apple accounts — no password exists, use the app token):
//   In a dev build: Identity tab → Account → "Copy API token", then:
//   REPRESENT_TOKEN=<paste> node scripts/publish-test-proposals.mjs
//
// Optional:
//   REPRESENT_API_URL=https://representportal.com   (default)
//
// The account must be identity-verified (the server requires it for
// proposal creation unless the platform setting disables that).
// Published IDs are recorded in content/civic-desk-test-proposals.published.json
// so the slate is easy to find and delete from the admin dashboard later.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLATE_PATH = path.join(__dirname, '..', 'content', 'civic-desk-test-proposals.json');
const PUBLISHED_PATH = path.join(__dirname, '..', 'content', 'civic-desk-test-proposals.published.json');

const API_URL = process.env.REPRESENT_API_URL || 'https://representportal.com';
const EMAIL = process.env.REPRESENT_EMAIL;
const PASSWORD = process.env.REPRESENT_PASSWORD;
const TOKEN = process.env.REPRESENT_TOKEN;
// REPRESENT_DEMO=1 publishes as the demo account (demo@represent.app), which
// bypasses the free-tier one-active-proposal limit. Credentials are the same
// ones already shipped in lib/auth.ts for App Store review.
const DEMO = process.env.REPRESENT_DEMO === '1';

if (!DEMO && !TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('Provide REPRESENT_DEMO=1, REPRESENT_TOKEN, or REPRESENT_EMAIL + REPRESENT_PASSWORD.');
  console.error('Free accounts are limited to one active proposal — for a full test slate use:');
  console.error('  REPRESENT_DEMO=1 node scripts/publish-test-proposals.mjs');
  process.exit(1);
}

// "+15m" / "+2h" / "+10d" → ISO timestamp relative to now
function resolveDeadline(rel) {
  const m = /^\+(\d+)([mhd])$/.exec(rel);
  if (!m) throw new Error(`Bad deadlineIn value: ${rel}`);
  const n = Number(m[1]);
  const ms = m[2] === 'm' ? n * 60_000 : m[2] === 'h' ? n * 3_600_000 : n * 86_400_000;
  return new Date(Date.now() + ms).toISOString();
}

async function main() {
  const slate = JSON.parse(readFileSync(SLATE_PATH, 'utf8'));

  let token = TOKEN;
  let accountLabel = 'token';
  if (DEMO) {
    console.log('Signing in as the demo account …');
    const demoRes = await fetch(`${API_URL}/api/auth/mobile/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@represent.app', password: 'RepresentDemo2024!' }),
    });
    if (!demoRes.ok) {
      const err = await demoRes.json().catch(() => ({}));
      throw new Error(`Demo login failed (${demoRes.status}): ${err.message || err.error || 'unknown'}`);
    }
    const data = await demoRes.json();
    token = data.token;
    accountLabel = 'demo@represent.app';
    console.log(`Signed in as ${data.user?.name || 'Demo'} (verified: ${data.user?.verified ? 'yes' : 'NO'})`);
  } else if (!token) {
    console.log(`Signing in as ${EMAIL} …`);
    const loginRes = await fetch(`${API_URL}/api/auth/mobile/email/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!loginRes.ok) {
      const err = await loginRes.json().catch(() => ({}));
      throw new Error(`Login failed (${loginRes.status}): ${err.message || err.error || 'unknown'}`);
    }
    const data = await loginRes.json();
    token = data.token;
    accountLabel = EMAIL;
    console.log(`Signed in as ${data.user?.name || data.user?.email} (verified: ${data.user?.verified ? 'yes' : 'NO'})`);
    if (!data.user?.verified) {
      console.warn('Warning: this account is not verified — the server may reject proposal creation.');
    }
  } else {
    // Validate the pasted token before publishing anything (same endpoint
    // the app's checkAuth uses).
    const meRes = await fetch(`${API_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = meRes.ok ? await meRes.json().catch(() => null) : null;
    if (me?.valid && me?.user) {
      accountLabel = me.user.email || 'token';
      console.log(`Token OK — acting as ${me.user.name || me.user.email} (verified: ${me.user.verified ? 'yes' : 'NO'})`);
      if (!me.user.verified) {
        console.warn('Warning: this account is not verified — the server may reject proposal creation.');
      }
    } else {
      throw new Error(`Token invalid or expired (${meRes.status}). Copy a fresh one from the app and retry.`);
    }
  }

  const published = [];
  for (const p of slate.proposals) {
    const body = {
      title: p.title,
      description: p.description,
      category: p.category,
      geoRestrictions: p.geoRestrictions,
      voteType: p.voteType,
      deadline: resolveDeadline(p.deadlineIn),
    };
    if (p.options) body.options = p.options;

    process.stdout.write(`Publishing: ${p.title.slice(0, 60)} … `);
    const res = await fetch(`${API_URL}/api/proposals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log(`FAILED (${res.status}): ${err.message || err.error || 'unknown'}`);
      published.push({ title: p.title, error: err.message || err.error || String(res.status) });
      continue;
    }
    const created = await res.json();
    const id = created?.id ?? created?.proposal?.id;
    console.log(`ok → id ${id}`);
    published.push({ id, title: p.title, deadline: body.deadline });
  }

  writeFileSync(
    PUBLISHED_PATH,
    JSON.stringify({ publishedAt: new Date().toISOString(), account: accountLabel, proposals: published }, null, 2) + '\n',
  );
  const okCount = published.filter((p) => p.id != null).length;
  console.log(`\nDone: ${okCount}/${slate.proposals.length} published. Record: content/civic-desk-test-proposals.published.json`);
  if (okCount < slate.proposals.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
