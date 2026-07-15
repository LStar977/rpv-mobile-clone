// ─────────────────────────────────────────────────────────────────────────────
// THE PUBLIC RECORD — representportal.com/record
//
// Server-rendered, SEO-facing archive of every public ballot, per the
// "Public Record Website" design handoff (R1 index / R2 permalink / R2b
// verdict modules / R3 region pages / R4 light variant).
//
// Routes registered here (must be registered BEFORE the SPA catch-all):
//   GET /record                 — the archive index (filters via query params)
//   GET /record/sitemap.xml     — sitemap for search engines
//   GET /record/:regionSlug     — regional record ("The Ontario Record")
//   GET /p/:proposalId          — ballot permalink (replaces the old handler;
//                                 keeps og:/twitter: meta + /og/p/:id card)
//
// Standing product rules enforced here exactly as in the app:
//   · two-tone tallies, support/oppose always labeled with exact counts
//   · below TALLY_THRESHOLD verified ballots the split is NEVER shown —
//     count + gold threshold dots only, open or closed
//   · closed below threshold: "no result is declared"
//   · one gold moment per page: the path into casting
//   · no invented numbers, no fake ledger ids
// ─────────────────────────────────────────────────────────────────────────────

const TALLY_THRESHOLD = 25;
const PAGE_SIZE = 20;
const APP_STORE_URL = "https://apps.apple.com/ca/app/id6756912022";
const SITE = "https://representportal.com";

// ── tiny helpers ─────────────────────────────────────────────────────────────

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const fmt = (n: number) => (Number(n) || 0).toLocaleString("en-CA");

const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const monthDay = (d: string | Date | null) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
};

// ── ballot view-model ────────────────────────────────────────────────────────

interface BallotVM {
  id: string;
  title: string;
  description: string;
  category: string;
  support: number;
  oppose: number;
  total: number;
  pct: number; // support %
  aboveThreshold: boolean;
  ended: boolean;
  passed: boolean;
  deadline: Date | null;
  createdAt: Date | null;
  geo: string[];
  tier: string; // GLOBAL | FEDERAL | PROVINCIAL | MUNICIPAL
  region: string; // most specific region name, '' when global
  province: string; // geo[1] when present
  proposer: string | null;
  requiresCitizenship: boolean;
}

function toVM(p: any): BallotVM {
  const support = Number(p.supportVotes) || 0;
  const oppose = Number(p.opposeVotes) || 0;
  const total = support + oppose;
  const geo: string[] = Array.isArray(p.geoRestrictions) ? p.geoRestrictions.filter(Boolean) : [];
  const tier =
    geo.length === 0 ? "GLOBAL" : geo.length === 1 ? "FEDERAL" : geo.length === 2 ? "PROVINCIAL" : "MUNICIPAL";
  const deadline = p.deadline ? new Date(p.deadline) : null;
  const ended = !!(deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now());
  return {
    id: String(p.id),
    title: String(p.title || "Untitled ballot"),
    description: String(p.description || ""),
    category: String(p.category || "General"),
    support,
    oppose,
    total,
    pct: total > 0 ? Math.round((support / total) * 100) : 0,
    aboveThreshold: total >= TALLY_THRESHOLD,
    ended,
    passed: support > oppose,
    deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    createdAt: p.createdAt ? new Date(p.createdAt) : null,
    geo,
    tier,
    region: geo.length === 0 ? "" : String(geo[geo.length - 1]),
    province: geo.length >= 2 ? String(geo[1]) : "",
    proposer: p.creatorName ? String(p.creatorName) : null,
    requiresCitizenship: !!p.requiresCitizenship,
  };
}

// Public ballots only: not hidden, not org-scoped, yes/no tallies (MC/RCV
// ballots have no support/oppose split to publish — they stay app-only for
// now rather than being shown with misleading zeros).
function isPublicYesNo(p: any): boolean {
  if (p.hiddenAt) return false;
  if (p.organizationId || p.orgId || p.organization_id) return false;
  const vt = p.voteType;
  if (vt && vt !== "yes-no") return false;
  return true;
}

// Deadline label per design: "CLOSES 10 PM" (today), "CLOSES JUL 21",
// "9D LEFT" fallback, "CLOSED JUL 2".
function deadlineLabel(b: BallotVM): string {
  if (!b.deadline) return b.ended ? "CLOSED" : "OPEN";
  if (b.ended) {
    const md = monthDay(b.deadline);
    return md ? `CLOSED ${md}` : "CLOSED";
  }
  const ms = b.deadline.getTime() - Date.now();
  const days = Math.floor(ms / 86400000);
  if (days < 1) {
    const time = b.deadline
      .toLocaleTimeString("en-US", { hour: "numeric", minute: undefined, hour12: true })
      .replace(/\s/g, " ")
      .toUpperCase();
    return `CLOSES ${time}`;
  }
  if (days <= 13) return `${days}D LEFT`;
  const md = monthDay(b.deadline);
  return md ? `CLOSES ${md}` : `${days}D LEFT`;
}

// ── shared page chrome ───────────────────────────────────────────────────────

const BASE_CSS = `
:root{
  --bg:#040707;--sf:#141818;--sfh:#202626;
  --bd:rgba(244,245,246,.08);--bds:rgba(244,245,246,.05);
  --tx:#F4F5F6;--tx2:#B8BABB;--tx3:#7A7D7E;
  --gd:#EABA58;--gdt:#EABA58;--sup:#34D399;--opp:#F87171;
  color-scheme:dark;
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#FAF8F5;--sf:#FFFDF9;--sfh:#F0EBE2;
    --bd:rgba(24,21,16,.10);--bds:rgba(24,21,16,.07);
    --tx:#181510;--tx2:#57534A;--tx3:#8B8578;
    --gd:#EABA58;--gdt:#C99A38;--sup:#0E9F6E;--opp:#DC2626;
    color-scheme:light;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font-family:'Onest',-apple-system,system-ui,sans-serif;line-height:1.5}
a{color:inherit;text-decoration:none}
.serif{font-family:'Newsreader',Georgia,serif}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-feature-settings:'tnum' 1}
.container{max-width:1440px;margin:0 auto}
.pad{padding-left:72px;padding-right:72px}
@media (max-width:760px){.pad{padding-left:20px;padding-right:20px}}

/* header */
.hdr{display:flex;align-items:center;justify-content:space-between;padding-top:22px;padding-bottom:22px;border-bottom:1px solid var(--bds);gap:14px;flex-wrap:wrap}
.hdr-brand{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}
.hdr-brand .wm{font-weight:600;font-size:15px;letter-spacing:.22em;color:var(--gdt)}
.hdr-brand .sub{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;letter-spacing:.16em;color:var(--tx3)}
.hdr-nav{display:flex;align-items:center;gap:28px}
.hdr-nav a{font-weight:500;font-size:14px;color:var(--tx3)}
.hdr-nav a.on{font-weight:600;color:var(--tx)}
.hdr-nav a.cta{font-weight:600;font-size:13.5px;color:var(--tx);border:1px solid var(--bd);padding:11px 22px;border-radius:100px}
@media (max-width:760px){.hdr-nav a:not(.cta){display:none}}

/* hero */
.hero{padding-top:56px;padding-bottom:38px;border-bottom:1px solid var(--bds);display:flex;flex-direction:column;gap:18px}
.hero h1{margin:0;font-weight:500;font-size:clamp(34px,5.4vw,54px);line-height:1.1;letter-spacing:-.014em}
.hero .lede{font-size:17px;line-height:1.6;color:var(--tx2);max-width:760px}
.stats{display:flex;gap:44px;margin-top:8px;flex-wrap:wrap}
.stat{display:flex;flex-direction:column;gap:3px}
.stat .n{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:26px;font-feature-settings:'tnum' 1}
.stat .l{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:10.5px;letter-spacing:.14em;color:var(--tx3)}
.stat .l.gold{color:var(--gdt)}
.crumb{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;letter-spacing:.12em;color:var(--tx3)}
.crumb a{color:var(--tx2)}
.crumb .open{color:var(--gdt)}

/* marquee (top open ballot) */
.marquee-label{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px;letter-spacing:.2em;color:var(--tx3);margin:36px 0 16px}
.marquee{display:flex;gap:48px;align-items:center;background:linear-gradient(160deg,var(--sf),var(--bg) 90%);border:1px solid rgba(234,186,88,.35);border-radius:22px;padding:34px 38px}
@media (max-width:900px){.marquee{flex-direction:column;align-items:stretch;gap:22px;padding:24px 22px}}
.marquee .q{font-weight:500;font-size:clamp(22px,3vw,32px);line-height:1.25;text-wrap:balance}
.marquee .meta{display:flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;letter-spacing:.12em;color:var(--gdt)}
.marquee .meta .dot{width:8px;height:8px;border-radius:4px;background:var(--gd)}
.marquee-cta{flex:none;display:flex;flex-direction:column;gap:10px;align-items:center}
.gold-btn{display:inline-block;padding:17px 32px;border-radius:15px;background:var(--gd);font-weight:600;font-size:16px;color:#040707;text-align:center}
.under-cta{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:10px;letter-spacing:.1em;color:var(--tx3)}

/* tally bars */
.bar{height:10px;border-radius:5px;background:var(--opp);overflow:hidden;position:relative}
.bar .fill{height:100%;background:var(--sup)}
.bar .mid{position:absolute;left:50%;top:0;bottom:0;width:1.5px;background:var(--tx);opacity:.4}
.bar.slim{height:7px;border-radius:4px}
.bar.big{height:14px;border-radius:7px}
.splitrow{display:flex;justify-content:space-between;gap:10px;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;font-feature-settings:'tnum' 1}
.splitrow .s{color:var(--sup)}.splitrow .o{color:var(--opp)}.splitrow .t{color:var(--tx3)}
.dots{display:flex;gap:4px;flex-wrap:wrap}
.dots i{width:8px;height:8px;border-radius:4px;background:var(--sfh)}
.dots i.on{background:var(--gd)}

/* filters */
.filters{display:flex;gap:10px;margin-top:20px;align-items:center;flex-wrap:wrap}
.filters select{appearance:none;-webkit-appearance:none;padding:11px 20px;border-radius:100px;background:var(--sf);border:1px solid var(--bd);font:500 13px 'Onest',sans-serif;color:var(--tx2);cursor:pointer}
.fchip{padding:11px 20px;border-radius:100px;background:var(--sf);border:1px solid var(--bd);font-weight:500;font-size:13px;color:var(--tx2)}
.fchip.on{background:var(--tx);border-color:var(--tx);color:var(--bg);font-weight:600}
.fcount{margin-left:auto;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;color:var(--tx3);font-feature-settings:'tnum' 1}

/* ledger rows */
.rows{display:flex;flex-direction:column;margin-top:8px}
.row{display:flex;align-items:center;gap:28px;padding:24px 8px;border-bottom:1px solid var(--bds)}
.row .qcol{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.row .meta{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;letter-spacing:.1em;color:var(--tx3)}
.row .q{font-weight:500;font-size:20px;line-height:1.3}
.row .q:hover{text-decoration:underline;text-underline-offset:3px}
.row .tcol{flex:none;width:250px;display:flex;flex-direction:column;gap:6px}
.row .tcol .pcts{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:10px;font-feature-settings:'tnum' 1}
.row .tcol .note{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:10px;color:var(--tx3)}
.row .scol{flex:none;width:118px;display:flex;align-items:center;gap:7px;font-weight:600;font-size:10.5px;letter-spacing:.12em}
.row .scol .livedot{width:7px;height:7px;border-radius:4px;background:var(--gd)}
.row .compact{display:none;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;color:var(--tx3);font-feature-settings:'tnum' 1}
.row .compact .s{color:var(--sup)}.row .compact .o{color:var(--opp)}
@media (max-width:760px){
  .row{gap:14px;padding:18px 2px}
  .row .tcol{display:none}
  .row .scol{display:none}
  .row .compact{display:block}
  .row .q{font-size:17px}
}
.loadmore{display:block;text-align:center;padding:26px 0;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;letter-spacing:.14em;color:var(--tx3)}
.loadmore:hover{color:var(--tx2)}
.empty{padding:48px 8px;text-align:center;color:var(--tx3);font-size:14px}

/* region chips */
.rchips{display:flex;gap:10px;padding:22px 0 4px;flex-wrap:wrap}
.rchip{padding:10px 18px;border-radius:100px;background:var(--sf);border:1px solid var(--bd);font-weight:500;font-size:12.5px;color:var(--tx2)}
.rchip.on{background:var(--tx);border-color:var(--tx);color:var(--bg);font-weight:600}

/* permalink */
.perma{max-width:980px;margin:0 auto;padding-top:52px;padding-bottom:60px;display:flex;flex-direction:column;gap:24px}
.perma h1{margin:0;font-weight:500;font-size:clamp(30px,4.6vw,46px);line-height:1.18;letter-spacing:-.014em;text-wrap:balance}
.chips{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.chip{font-weight:600;font-size:10.5px;letter-spacing:.12em;color:var(--tx3);background:var(--sfh);padding:7px 14px;border-radius:100px}
.chip.cat-blue{color:#60A5FA;background:rgba(96,165,250,.09);border:1px solid rgba(96,165,250,.25)}
.chip.cat-amber{color:#FBBF24;background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.25)}
.chip-note{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;color:var(--tx3);margin-left:6px}
.perma .desc{font-size:16.5px;line-height:1.7;color:var(--tx2);max-width:820px;white-space:pre-line}
.module{background:var(--sf);border:1px solid var(--bds);border-radius:20px;padding:28px 32px;display:flex;flex-direction:column;gap:14px}
@media (max-width:760px){.module{padding:20px 18px}}
.module.passed{border-color:rgba(52,211,153,.3)}
.module.failed{border-color:rgba(248,113,113,.3)}
.module .head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.module .label{font-weight:600;font-size:11px;letter-spacing:.14em;color:var(--tx3)}
.module .label.v-sup{color:var(--sup);display:flex;align-items:center;gap:7px}
.module .label.v-opp{color:var(--opp);display:flex;align-items:center;gap:7px}
.module .count{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:13px;color:var(--tx3);font-feature-settings:'tnum' 1}
.module .foot{font-size:12.5px;color:var(--tx3)}
.convert{display:flex;align-items:center;gap:36px;background:linear-gradient(160deg,var(--sf),var(--bg) 90%);border:1px solid rgba(234,186,88,.35);border-radius:20px;padding:28px 32px}
@media (max-width:760px){.convert{flex-direction:column;align-items:stretch;text-align:center;padding:22px 18px}}
.convert .big{font-family:'Newsreader',Georgia,serif;font-weight:500;font-size:22px}
.convert .sub{font-size:14px;color:var(--tx2);margin-top:4px}
.convert-cta{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px}
.ledgerline{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;color:var(--tx3);font-feature-settings:'tnum' 1}
.ledgerline a{color:var(--tx2);text-decoration:underline;text-underline-offset:3px;font-family:'Onest',sans-serif;font-size:12px}

/* how it works */
.how{padding-top:44px;padding-bottom:8px;display:flex;flex-direction:column;gap:16px}
.how h2{margin:0;font-weight:500;font-size:26px}
.how-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.how-card{background:var(--sf);border:1px solid var(--bds);border-radius:16px;padding:20px}
.how-card .t{font-weight:600;font-size:14px;margin-bottom:6px}
.how-card .b{font-size:13px;line-height:1.6;color:var(--tx2)}

/* footer */
.ftr{margin-top:40px;padding-top:26px;padding-bottom:34px;border-top:1px solid var(--bds);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.ftr .note{font-size:12.5px;color:var(--tx3)}
.ftr .note a{color:var(--tx2);text-decoration:underline;text-underline-offset:2px}
.ftr .mark{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;letter-spacing:.14em;color:var(--tx3)}
.ftr .legal{display:flex;gap:16px;font-size:12px;color:var(--tx3)}
`;

const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`;
const X_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

// Category tags use the info-blue / warning-amber family — never the
// support/oppose pair (same rule as the app's detail sheet).
const AMBER_CATEGORIES = new Set(["housing", "economy", "taxes", "budget", "finance", "agriculture", "other", "general"]);
const catClass = (c: string) => (AMBER_CATEGORIES.has(String(c || "").toLowerCase()) ? "cat-amber" : "cat-blue");

function pageShell(opts: {
  title: string;
  description: string;
  canonical: string;
  activeNav?: "record";
  extraHead?: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(opts.canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet">
${opts.extraHead || ""}
<style>${BASE_CSS}</style>
</head>
<body>
<div class="container">
  <header class="hdr pad">
    <a class="hdr-brand" href="/record"><span class="wm">REPRESENT</span><span class="sub">THE PUBLIC RECORD</span></a>
    <nav class="hdr-nav">
      <a href="/record" class="${opts.activeNav === "record" ? "on" : ""}">Record</a>
      <a href="/record#how">How counting works</a>
      <a class="cta" href="${APP_STORE_URL}">Get the app</a>
    </nav>
  </header>
  ${opts.body}
  <footer class="ftr pad">
    <span class="note">Every count on this site is recorded on a public, tamper-evident ledger — <a href="/record#how">audit it yourself</a>.</span>
    <span class="legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span>
    <span class="mark">REPRESENT · ${new Date().getFullYear()}</span>
  </footer>
</div>
</body>
</html>`;
}

// ── shared fragments ─────────────────────────────────────────────────────────

function tallyBarHtml(pct: number, size: "slim" | "" | "big" = ""): string {
  return `<div class="bar ${size}"><div class="fill" style="width:${pct}%"></div><div class="mid"></div></div>`;
}

function thresholdDotsHtml(total: number): string {
  let dots = "";
  for (let i = 0; i < TALLY_THRESHOLD; i++) dots += `<i class="${i < total ? "on" : ""}"></i>`;
  return `<div class="dots">${dots}</div>`;
}

function rowMeta(b: BallotVM): string {
  const parts: string[] = [];
  if (b.region) parts.push(b.region.toUpperCase());
  parts.push(b.tier);
  if (b.ended) {
    parts.push(deadlineLabel(b));
  } else {
    parts.push("OPEN");
    parts.push(deadlineLabel(b));
  }
  return parts.join(" · ");
}

function ledgerRowHtml(b: BallotVM): string {
  const href = `/p/${esc(b.id)}`;

  let tcol: string;
  let compact: string;
  if (b.aboveThreshold) {
    tcol = `<div class="tcol">${tallyBarHtml(b.pct, "slim")}
      <div class="pcts"><span style="color:var(--sup)">${b.pct}%</span><span style="color:var(--tx3)">${fmt(b.total)}</span><span style="color:var(--opp)">${100 - b.pct}%</span></div></div>`;
    compact = `<span class="compact"><span class="s">${b.pct}</span>–<span class="o">${100 - b.pct}</span> · ${fmt(b.total)}</span>`;
  } else {
    tcol = `<div class="tcol">${thresholdDotsHtml(b.total)}
      <span class="note">${fmt(b.total)} OF ${TALLY_THRESHOLD} · TALLY AT ${TALLY_THRESHOLD}</span></div>`;
    compact = `<span class="compact">${fmt(b.total)} OF ${TALLY_THRESHOLD} BALLOTS · TALLY AT ${TALLY_THRESHOLD}</span>`;
  }

  let scol: string;
  if (!b.ended) {
    scol = `<span class="scol" style="color:var(--gdt)"><span class="livedot"></span>LIVE</span>`;
  } else if (!b.aboveThreshold) {
    scol = `<span class="scol" style="color:var(--tx3)">NO RESULT</span>`;
  } else if (b.passed) {
    scol = `<span class="scol" style="color:var(--sup)">${CHECK_SVG}PASSED</span>`;
  } else {
    scol = `<span class="scol" style="color:var(--opp)">${X_SVG}DID NOT PASS</span>`;
  }

  return `<a class="row" href="${href}">
    <div class="qcol">
      <span class="meta">${esc(rowMeta(b))}</span>
      <span class="q serif">${esc(b.title)}</span>
      ${compact}
    </div>
    ${tcol}
    ${scol}
  </a>`;
}

function howSectionHtml(): string {
  return `<section class="how pad" id="how">
    <h2 class="serif">How counting works</h2>
    <div class="how-grid">
      <div class="how-card"><div class="t">Verified identity</div><div class="b">Every voter verifies once with government ID. Checked, never kept. No bots, no duplicates, no estimates.</div></div>
      <div class="how-card"><div class="t">One person, one ballot</div><div class="b">Every number on this site is one verified person. Ballots are recorded on a public, tamper-evident ledger anyone can audit.</div></div>
      <div class="how-card"><div class="t">The ${TALLY_THRESHOLD}-ballot threshold</div><div class="b">A split is only published once ${TALLY_THRESHOLD} verified ballots are cast — early votes stay uninfluenced. Below the threshold, only the count is shown. Ever.</div></div>
    </div>
  </section>`;
}

function convertCardHtml(b: BallotVM | null): string {
  const line = b && !b.ended && b.region
    ? `Live in ${esc(b.region)}? Add yours before it closes.`
    : b && !b.ended
      ? `This ballot is open now. Add yours before it closes.`
      : `Open ballots are being counted right now. Add your voice.`;
  return `<div class="convert">
    <div style="flex:1">
      <div class="big">This count is one verified person, one ballot.</div>
      <div class="sub">${line}</div>
    </div>
    <div class="convert-cta">
      <a class="gold-btn" href="${APP_STORE_URL}">Get Represent — it&#39;s free</a>
      <span class="under-cta mono" style="letter-spacing:.1em">VERIFY ONCE · CHECKED, NEVER KEPT</span>
    </div>
  </div>`;
}

// ── data access ──────────────────────────────────────────────────────────────

async function loadPublicBallots(storage: any): Promise<BallotVM[]> {
  const all = await storage.getAllProposals();
  return (Array.isArray(all) ? all : [])
    .filter(isPublicYesNo)
    .map(toVM)
    .sort((a, b) => {
      // Open first (soonest deadline first), then closed (most recent first).
      if (a.ended !== b.ended) return a.ended ? 1 : -1;
      if (!a.ended) {
        const at = a.deadline ? a.deadline.getTime() : Infinity;
        const bt = b.deadline ? b.deadline.getTime() : Infinity;
        return at - bt;
      }
      const at = a.deadline ? a.deadline.getTime() : 0;
      const bt = b.deadline ? b.deadline.getTime() : 0;
      return bt - at;
    });
}

// ── route registration ───────────────────────────────────────────────────────

export function registerPublicRecordRoutes(app: any, storage: any) {
  const send = (res: any, html: string, status = 200) => {
    res.status(status).setHeader("Cache-Control", "public, max-age=120");
    res.type("html").send(html);
  };

  // ── /record — the archive index ────────────────────────────────────────────
  app.get("/record", async (req: any, res: any) => {
    try {
      const ballots = await loadPublicBallots(storage);

      const regionQ = String(req.query.region || "").trim();
      const topicQ = String(req.query.topic || "").trim();
      const statusQ = String(req.query.status || "").trim(); // '', 'open', 'closed'
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);

      const regions = [...new Set(ballots.map((b) => b.region).filter(Boolean))].sort();
      const topics = [...new Set(ballots.map((b) => b.category).filter(Boolean))].sort();

      let list = ballots;
      if (regionQ) list = list.filter((b) => b.region.toLowerCase() === regionQ.toLowerCase() || b.province.toLowerCase() === regionQ.toLowerCase() || (b.geo[0] || "").toLowerCase() === regionQ.toLowerCase());
      if (topicQ) list = list.filter((b) => b.category.toLowerCase() === topicQ.toLowerCase());
      if (statusQ === "open") list = list.filter((b) => !b.ended);
      if (statusQ === "closed") list = list.filter((b) => b.ended);

      const shown = list.slice(0, page * PAGE_SIZE);
      const hasMore = list.length > shown.length;

      const totalCast = ballots.reduce((s, b) => s + b.total, 0);

      // Marquee: the open ballot with the largest verified count (prefer
      // above-threshold so the marquee always has a real split to show).
      const open = ballots.filter((b) => !b.ended);
      const marqueeB =
        open.filter((b) => b.aboveThreshold).sort((a, b) => b.total - a.total)[0] ||
        open.sort((a, b) => b.total - a.total)[0] ||
        null;

      const qs = (over: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams();
        const merged: Record<string, any> = { region: regionQ, topic: topicQ, status: statusQ, ...over };
        for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
        const s = params.toString();
        return s ? `/record?${s}` : "/record";
      };

      const marqueeHtml = marqueeB
        ? `<div class="marquee-label pad">OPEN NOW${marqueeB.geo[0] ? ` · ${esc(String(marqueeB.geo[0]).toUpperCase())}` : ""}</div>
          <div class="pad"><div class="marquee">
            <div style="flex:1;display:flex;flex-direction:column;gap:14px;min-width:0">
              <div class="meta"><span class="dot"></span><span>${esc(marqueeB.tier)} · ${esc(deadlineLabel(marqueeB))}</span></div>
              <a class="q serif" href="/p/${esc(marqueeB.id)}">${esc(marqueeB.title)}</a>
              ${marqueeB.aboveThreshold
                ? `<div style="display:flex;flex-direction:column;gap:8px;max-width:640px">${tallyBarHtml(marqueeB.pct)}
                    <div class="splitrow"><span class="s">SUPPORT ${marqueeB.pct}% · ${fmt(marqueeB.support)}</span><span class="t">${fmt(marqueeB.total)} VERIFIED · LIVE</span><span class="o">OPPOSE ${100 - marqueeB.pct}% · ${fmt(marqueeB.oppose)}</span></div></div>`
                : `<div style="display:flex;flex-direction:column;gap:8px;max-width:640px">${thresholdDotsHtml(marqueeB.total)}
                    <div class="splitrow"><span class="t">${fmt(marqueeB.total)} OF ${TALLY_THRESHOLD} BALLOTS · TALLY AT ${TALLY_THRESHOLD}</span></div></div>`}
            </div>
            <div class="marquee-cta">
              <a class="gold-btn" href="${APP_STORE_URL}">Cast your ballot in the app</a>
              <span class="under-cta">ONE PERSON · ONE BALLOT</span>
            </div>
          </div></div>`
        : "";

      const optionsHtml = (items: string[], selected: string, all: string) =>
        `<option value="">${esc(all)}</option>` +
        items.map((r) => `<option value="${esc(r)}" ${r.toLowerCase() === selected.toLowerCase() ? "selected" : ""}>${esc(r)}</option>`).join("");

      const body = `
        <section class="hero pad">
          <h1 class="serif">Every ballot. Every count. Verified.</h1>
          <p class="lede">The permanent record of what verified Canadians decided — every question ever put to a Represent ballot, with counts anyone can audit.</p>
          <div class="stats">
            <div class="stat"><span class="n">${fmt(ballots.length)}</span><span class="l">BALLOTS RUN</span></div>
            <div class="stat"><span class="n">${fmt(totalCast)}</span><span class="l">BALLOTS CAST</span></div>
            <div class="stat"><span class="n">${fmt(open.length)}</span><span class="l gold">OPEN NOW</span></div>
          </div>
        </section>
        ${marqueeHtml}
        <section class="pad">
          <form class="filters" method="get" action="/record">
            <select name="region" onchange="this.form.submit()">${optionsHtml(regions, regionQ, "All regions")}</select>
            <select name="topic" onchange="this.form.submit()">${optionsHtml(topics, topicQ, "All topics")}</select>
            <a class="fchip ${statusQ === "open" ? "on" : ""}" href="${qs({ status: statusQ === "open" ? "" : "open", page: undefined })}">Open</a>
            <a class="fchip ${statusQ === "closed" ? "on" : ""}" href="${qs({ status: statusQ === "closed" ? "" : "closed", page: undefined })}">Closed</a>
            ${statusQ ? `<input type="hidden" name="status" value="${esc(statusQ)}">` : ""}
            <span class="fcount">${fmt(list.length)} BALLOTS</span>
          </form>
          <div class="rows">
            ${shown.length ? shown.map(ledgerRowHtml).join("\n") : `<div class="empty">No ballots match these filters yet.</div>`}
            ${hasMore ? `<a class="loadmore" href="${qs({ page: page + 1 })}">LOAD ${Math.min(PAGE_SIZE, list.length - shown.length)} MORE ↓</a>` : ""}
          </div>
        </section>
        ${howSectionHtml()}`;

      send(res, pageShell({
        title: "The Public Record — Represent",
        description: "Every ballot ever run on Represent, with verified counts anyone can audit. One person, one ballot, on a public record.",
        canonical: `${SITE}/record`,
        activeNav: "record",
        body,
      }));
    } catch (e: any) {
      send(res, pageShell({ title: "The Public Record — Represent", description: "The public record of verified ballots.", canonical: `${SITE}/record`, body: `<div class="pad" style="padding-top:64px;padding-bottom:64px"><h1 class="serif">The record is briefly unavailable.</h1><p style="color:var(--tx3)">Try again in a moment.</p></div>` }), 500);
    }
  });

  // ── /record/sitemap.xml ─────────────────────────────────────────────────────
  app.get("/record/sitemap.xml", async (_req: any, res: any) => {
    try {
      const ballots = await loadPublicBallots(storage);
      const provinces = [...new Set(ballots.map((b) => b.province).filter(Boolean))];
      const urls = [
        `${SITE}/record`,
        ...provinces.map((p) => `${SITE}/record/${slugify(p)}`),
        ...ballots.map((b) => `${SITE}/p/${encodeURIComponent(b.id)}`),
      ];
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.type("application/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") +
        `\n</urlset>`,
      );
    } catch {
      res.status(500).end();
    }
  });

  // ── /record/:regionSlug — "The Ontario Record" ─────────────────────────────
  app.get("/record/:regionSlug", async (req: any, res: any) => {
    try {
      const slug = slugify(req.params.regionSlug);
      const ballots = await loadPublicBallots(storage);

      // Match a province or a city present in the data.
      const names = new Map<string, string>(); // slug -> display name
      for (const b of ballots) {
        for (const g of b.geo) {
          const s = slugify(g);
          if (s && !names.has(s)) names.set(s, g);
        }
      }
      const regionName = names.get(slug);
      if (!regionName) {
        return send(res, pageShell({
          title: "Region not found — The Public Record",
          description: "This region has no ballots on the public record yet.",
          canonical: `${SITE}/record`,
          body: `<div class="pad" style="padding-top:64px;padding-bottom:64px"><h1 class="serif">No record here yet.</h1><p style="color:var(--tx3)">No ballots have been run for this region. <a href="/record" style="color:var(--tx2);text-decoration:underline">Browse the full record →</a></p></div>`,
        }), 404);
      }

      const list = ballots.filter((b) => b.geo.some((g) => slugify(g) === slug));
      const open = list.filter((b) => !b.ended);
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const shown = list.slice(0, page * PAGE_SIZE);
      const hasMore = list.length > shown.length;

      // Sub-region chips: cities that appear under this region in the data.
      const subs = [...new Set(
        list
          .map((b) => {
            const idx = b.geo.findIndex((g) => slugify(g) === slug);
            return idx >= 0 && idx < b.geo.length - 1 ? b.geo[b.geo.length - 1] : "";
          })
          .filter(Boolean),
      )].sort();

      const body = `
        <section class="hero pad" style="padding-top:52px">
          <span class="crumb"><a href="/record">RECORD</a> / ${esc(regionName.toUpperCase())}</span>
          <h1 class="serif">The ${esc(regionName)} Record</h1>
          <div class="stats">
            <div class="stat"><span class="n">${fmt(list.length)}</span><span class="l">BALLOTS</span></div>
            <div class="stat"><span class="n">${fmt(list.reduce((s, b) => s + b.total, 0))}</span><span class="l">BALLOTS CAST</span></div>
            <div class="stat"><span class="n">${fmt(open.length)}</span><span class="l gold">OPEN NOW</span></div>
          </div>
        </section>
        <section class="pad">
          <div class="rchips">
            <a class="rchip on" href="/record/${esc(slug)}">All ${esc(regionName)}</a>
            ${subs.map((c) => `<a class="rchip" href="/record/${slugify(c)}">${esc(c)}</a>`).join("")}
          </div>
          <div class="rows">
            ${shown.length ? shown.map(ledgerRowHtml).join("\n") : `<div class="empty">No ballots on this record yet.</div>`}
            ${hasMore ? `<a class="loadmore" href="/record/${esc(slug)}?page=${page + 1}">LOAD ${Math.min(PAGE_SIZE, list.length - shown.length)} MORE ↓</a>` : ""}
          </div>
        </section>
        ${howSectionHtml()}`;

      send(res, pageShell({
        title: `The ${regionName} Record — Represent`,
        description: `Every ballot verified ${regionName} residents have voted on — with counts anyone can audit. One person, one ballot.`,
        canonical: `${SITE}/record/${slug}`,
        activeNav: "record",
        body,
      }));
    } catch {
      res.status(500).type("html").send("<!doctype html><title>Error</title>Something went wrong.");
    }
  });

  // ── /p/:proposalId — ballot permalink (R2) ─────────────────────────────────
  app.get("/p/:proposalId", async (req: any, res: any) => {
    try {
      const proposal = await storage.getProposal(req.params.proposalId);
      if (!proposal || proposal.hiddenAt || proposal.organizationId) {
        return send(res, pageShell({
          title: "Ballot not found — The Public Record",
          description: "This ballot may have been removed.",
          canonical: `${SITE}/record`,
          body: `<div class="pad" style="padding-top:64px;padding-bottom:64px"><h1 class="serif">Ballot not found.</h1><p style="color:var(--tx3)">It may have been removed. <a href="/record" style="color:var(--tx2);text-decoration:underline">Browse the public record →</a></p></div>`,
        }), 404);
      }

      const b = toVM(proposal);
      const pageUrl = `${SITE}/p/${encodeURIComponent(b.id)}`;
      const isMC = proposal.voteType && proposal.voteType !== "yes-no";

      // Status line for crumb
      const statusCrumb = b.ended
        ? `<span>● ${esc(deadlineLabel(b))}</span>`
        : `<span class="open">● OPEN · ${esc(deadlineLabel(b))}</span>`;
      const crumbRegion = b.province || b.region || (b.geo[0] ? String(b.geo[0]) : "");

      // Tally module by state (yes/no only; MC/RCV ballots vote in the app)
      let tallyModule: string;
      if (isMC) {
        tallyModule = `<div class="module"><div class="head"><span class="label">BALLOT TYPE</span><span class="count">${esc(String(proposal.voteType).replace("-", " ").toUpperCase())}</span></div>
          <div class="foot">This ballot uses ${proposal.voteType === "ranked-choice" ? "ranked-choice" : "multiple-choice"} voting. Results are tallied in the app.</div></div>`;
      } else if (!b.aboveThreshold) {
        tallyModule = `<div class="module">
          <div class="head"><span class="label">${b.ended ? "CLOSED · BELOW THRESHOLD" : "EARLY VOTING"}</span><span class="count">${fmt(b.total)} BALLOT${b.total === 1 ? "" : "S"}${b.ended && b.deadline ? ` · CLOSED ${monthDay(b.deadline)}` : ""}</span></div>
          ${thresholdDotsHtml(b.total)}
          <div class="foot">${b.ended
            ? `This ballot closed with ${fmt(b.total)} of the ${TALLY_THRESHOLD} verified ballots needed to publish a split. Individual votes remain on the ledger; no result is declared.`
            : `The split appears once ${TALLY_THRESHOLD} verified ballots are cast — early votes stay uninfluenced.`}</div>
        </div>`;
      } else if (!b.ended) {
        tallyModule = `<div class="module">
          <div class="head"><span class="label">LIVE TALLY</span><span class="count">${fmt(b.total)} VERIFIED BALLOTS</span></div>
          ${tallyBarHtml(b.pct, "big")}
          <div class="splitrow" style="font-size:13px"><span class="s">SUPPORT ${b.pct}% · ${fmt(b.support)}</span><span class="o">OPPOSE ${100 - b.pct}% · ${fmt(b.oppose)}</span></div>
          <div class="foot">Live count — updates as verified ${b.region ? `residents of ${esc(b.region)}` : "citizens"} cast their ballots.</div>
        </div>`;
      } else {
        tallyModule = `<div class="module ${b.passed ? "passed" : "failed"}">
          <div class="head">
            <span class="label ${b.passed ? "v-sup" : "v-opp"}">${b.passed ? CHECK_SVG + "PASSED" : X_SVG + "DID NOT PASS"}</span>
            <span class="count">${fmt(b.total)} VERIFIED · FINAL${b.deadline ? ` · CLOSED ${monthDay(b.deadline)}` : ""}</span>
          </div>
          ${tallyBarHtml(b.pct)}
          <div class="splitrow"><span class="s">SUPPORT ${b.pct}% · ${fmt(b.support)}</span><span class="o">OPPOSE ${100 - b.pct}% · ${fmt(b.oppose)}</span></div>
          <div class="foot">Result recorded permanently. Anyone can audit the count on the public ledger.</div>
        </div>`;
      }

      const openedMeta = [
        b.createdAt ? `OPENED ${monthDay(b.createdAt)}` : "",
        b.proposer ? `PROPOSED BY ${esc(b.proposer.toUpperCase())}` : "",
      ].filter(Boolean).join(" · ");

      const ogDesc = b.aboveThreshold
        ? `${fmt(b.total)} verified ballots · ${b.pct}% support — one person, one ballot, on the public record.`
        : `${fmt(b.total)} verified ballot${b.total === 1 ? "" : "s"} cast — the split publishes at ${TALLY_THRESHOLD}. One person, one ballot.`;

      const extraHead = `
<meta property="og:title" content="${esc(b.title)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:site_name" content="Represent">
<meta property="og:image" content="${SITE}/og/p/${encodeURIComponent(b.id)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og/p/${encodeURIComponent(b.id)}">
<meta name="twitter:title" content="${esc(b.title)}">
<meta name="twitter:description" content="${esc(ogDesc)}">`;

      const body = `
        <main class="perma pad">
          <span class="crumb"><a href="/record">RECORD</a>${crumbRegion ? ` / <a href="/record/${slugify(crumbRegion)}">${esc(crumbRegion.toUpperCase())}</a>` : ""} / ${statusCrumb}</span>
          <h1 class="serif">${esc(b.title)}</h1>
          <div class="chips">
            <span class="chip">${esc([b.tier, b.region.toUpperCase()].filter(Boolean).join(" · "))}</span>
            <span class="chip ${catClass(b.category)}">${esc(b.category.toUpperCase())}</span>
            ${b.requiresCitizenship ? `<span class="chip" style="color:var(--gdt)">CITIZENS ONLY</span>` : ""}
            ${openedMeta ? `<span class="chip-note mono">${openedMeta}</span>` : ""}
          </div>
          ${b.description ? `<p class="desc">${esc(b.description)}</p>` : ""}
          ${tallyModule}
          ${convertCardHtml(b)}
          <div class="ledgerline">
            <span>EVERY BALLOT RECORDED ON A PUBLIC, TAMPER-EVIDENT LEDGER</span>
            <a href="/record#how">How counting works</a>
          </div>
        </main>`;

      send(res, pageShell({
        title: `${b.title} — The Public Record`,
        description: (b.description || ogDesc).slice(0, 200),
        canonical: pageUrl,
        extraHead,
        body,
      }));
    } catch (e: any) {
      res.status(500).type("html").send("<!doctype html><title>Error</title>Something went wrong.");
    }
  });
}
