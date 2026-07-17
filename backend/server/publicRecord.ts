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

// ── Web voting overlay (ported from the pre-Record /p/:id page) ─────────────
// Same four-step flow and identical API wiring as the old handler (auth →
// Didit verify → vote → success), restyled to the Record tokens. The JS is
// kept behaviorally verbatim — endpoints, payloads, and fallbacks unchanged.
const WEBVOTE_CSS = `
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;z-index:1000}
@media(min-width:560px){.overlay{align-items:center;padding:24px}}
.ov-card{width:100%;max-width:480px;background:var(--sf);border:1px solid var(--bd);border-radius:24px 24px 0 0;padding:24px;max-height:93vh;overflow-y:auto}
@media(min-width:560px){.ov-card{border-radius:20px}}
.ov-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.ov-title{font-family:'Newsreader',Georgia,serif;font-size:20px;font-weight:500;color:var(--tx)}
.ov-close{background:var(--sfh);border:none;color:var(--tx);width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center}
.ov-sub{font-size:13px;color:var(--tx2);line-height:1.55;margin-bottom:20px}
.step-label{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--gdt);margin-bottom:12px}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em}
.field input{width:100%;background:var(--sfh);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;color:var(--tx);font-size:15px;outline:none;box-sizing:border-box;font-family:inherit}
.field input:focus{border-color:rgba(234,186,88,.5)}
.tabs{display:flex;gap:0;background:var(--sfh);border-radius:10px;padding:3px;margin-bottom:20px}
.tab-btn{flex:1;padding:8px;border:none;background:transparent;color:var(--tx3);font-family:inherit;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s}
.tab-btn.active{background:var(--gd);color:#040707}
.action-btn{display:block;width:100%;background:var(--gd);color:#040707;border:none;border-radius:12px;padding:14px;font-family:inherit;font-weight:600;font-size:15px;cursor:pointer;margin-top:6px;text-align:center;box-sizing:border-box}
.action-btn:disabled{opacity:.5;cursor:default}
.secondary-btn{display:block;width:100%;background:transparent;border:1px solid var(--bd);color:var(--tx2);border-radius:12px;padding:12px;font-family:inherit;font-size:14px;cursor:pointer;margin-top:10px;box-sizing:border-box}
.secondary-btn:disabled{opacity:.4;cursor:default}
.social-wrap{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.social-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:#fff;color:#1f1f1f;border:1px solid var(--bd);border-radius:12px;padding:12px;font-family:inherit;font-weight:600;font-size:14px;cursor:pointer;box-sizing:border-box;transition:opacity .15s}
.social-btn:disabled{opacity:.5;cursor:default}
.social-btn svg{width:18px;height:18px;flex-shrink:0}
.social-btn.apple-btn{background:#000;color:#fff;border-color:#000}
.social-divider{display:flex;align-items:center;gap:10px;margin-bottom:16px;color:var(--tx3);font-size:12px}
.social-divider::before,.social-divider::after{content:'';flex:1;height:1px;background:var(--bds)}
.err-msg{font-size:13px;color:var(--opp);margin-top:10px;padding:10px 12px;background:rgba(248,113,113,.08);border-radius:8px;border:1px solid rgba(248,113,113,.2);display:none}
.vote-btn{width:100%;padding:16px;border-radius:12px;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;border:1.5px solid transparent;margin-bottom:10px;transition:opacity .15s;box-sizing:border-box}
.vote-btn:disabled{opacity:.45;cursor:default}
.vote-support{background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.35);color:var(--sup)}
.vote-oppose{background:rgba(248,113,113,.07);border-color:rgba(248,113,113,.3);color:var(--opp)}
.vote-opt{background:rgba(234,186,88,.1);color:var(--gdt);border-color:rgba(234,186,88,.3)}
.success-icon{width:56px;height:56px;border-radius:50%;background:rgba(234,186,88,.12);border:1px solid rgba(234,186,88,.4);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--gdt);margin:0 auto 14px}
.success-title{font-family:'Newsreader',Georgia,serif;font-size:22px;font-weight:500;text-align:center;margin-bottom:8px;color:var(--tx)}
.success-sub{font-size:14px;color:var(--tx2);text-align:center;margin-bottom:20px}
.live-tally{background:var(--sfh);border:1px solid var(--bds);border-radius:12px;padding:16px;margin-bottom:20px}
.live-tally .tally-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:13px}
.live-tally .tally-label{color:var(--tx2)}
.live-tally .tally-val{font-family:'JetBrains Mono',monospace;font-weight:500}
.live-tally .support{color:var(--sup)}
.live-tally .oppose{color:var(--opp)}
.live-tally .bar2{height:6px;border-radius:3px;background:var(--bds);overflow:hidden;margin-bottom:10px}
.live-tally .bar-inner-s{height:100%;border-radius:3px;background:var(--sup)}
.live-tally .bar-inner-o{height:100%;border-radius:3px;background:var(--opp)}
.live-total{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);text-align:center;margin-top:8px}
.verify-icon{width:48px;height:48px;border-radius:50%;background:rgba(234,186,88,.1);border:1px solid rgba(234,186,88,.3);display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 14px}
.app-handoff{background:linear-gradient(135deg,rgba(234,186,88,.07) 0%,rgba(234,186,88,.03) 100%);border:1px solid rgba(234,186,88,.25);border-radius:14px;padding:16px;margin-bottom:14px;text-align:center}
.app-handoff-title{font-size:13px;font-weight:600;color:var(--gdt);margin-bottom:4px}
.app-handoff-sub{font-size:12px;color:var(--tx3);margin-bottom:12px;line-height:1.4}
.app-btn{display:block;background:var(--gd);color:#040707;border:none;border-radius:11px;padding:13px 16px;font-family:inherit;font-weight:600;font-size:14px;cursor:pointer;width:100%;text-align:center;box-sizing:border-box}
.web-continue{display:block;font-size:12px;color:var(--tx3);text-align:center;margin-top:10px;cursor:pointer;background:none;border:none;width:100%;padding:4px;font-family:inherit}
.vote-now-btn{display:block;width:100%;border:none;cursor:pointer;font-family:inherit}
.applink{display:block;text-align:center;font-size:12.5px;color:var(--tx3);text-decoration:underline;text-underline-offset:3px;margin-top:2px}
.terms-line{font-size:11.5px;line-height:1.5;color:var(--tx3);text-align:center;margin-top:12px}
.terms-line a{color:var(--tx2);text-decoration:underline;text-underline-offset:2px}
.confirm-line{font-size:14.5px;line-height:1.55;color:var(--tx);margin-bottom:16px}
.verify-opt{display:block;width:100%;text-align:left;background:var(--sfh);border:1.5px solid var(--bd);border-radius:12px;padding:13px 15px;margin-bottom:10px;cursor:pointer;box-sizing:border-box;font-family:inherit}
.verify-opt.selected{border-color:rgba(234,186,88,.55);background:rgba(234,186,88,.07)}
.verify-opt .vo-title{display:block;font-size:14px;font-weight:600;color:var(--tx);margin-bottom:3px}
.verify-opt .vo-sub{display:block;font-size:12px;line-height:1.45;color:var(--tx3)}
.pr-reveal{font-size:12px;font-weight:500;color:var(--tx2);text-decoration:underline;text-underline-offset:3px;cursor:pointer;background:none;border:none;padding:0;font-family:inherit;text-align:left}
`;

// Overlay markup + client JS. `b` drives the labels; `proposal` supplies the
// raw voteType/options; `host` builds the Apple redirect URI.
function webVoteHtml(b: BallotVM, proposal: any, host: string): string {
  const voteType = proposal.voteType && proposal.voteType !== "yes-no" ? proposal.voteType : "binary";
  const options: string[] = (() => {
    try {
      const o = proposal.options;
      if (!o) return [];
      const a = typeof o === "string" ? JSON.parse(o) : o;
      return Array.isArray(a) ? a.map(String) : [];
    } catch { return []; }
  })();
  const pdata = JSON.stringify({
    id: b.id,
    voteType,
    options,
    geoLabel: b.geo.length > 0 ? b.geo.join(" · ") : "",
    isClosed: b.ended,
    requiresCitizenship: !!proposal.requiresCitizenship,
  });
  const authConfig = JSON.stringify({
    googleClientId: process.env.GOOGLE_WEB_CLIENT_ID || "",
    appleServicesId: process.env.APPLE_SERVICES_ID || "",
    redirectUri: `https://${host}/p/${b.id}`,
  });

  return `
  <!-- ── Web voting overlay ─────────────────────────────────────────────── -->
  <div class="overlay" id="vote-overlay" style="display:none" onclick="if(event.target===this)window.closeOverlay()">
    <div class="ov-card">
      <div class="ov-header">
        <span class="ov-title" id="ov-title">Cast your ballot</span>
        <button class="ov-close" onclick="window.closeOverlay()" aria-label="Close">&#215;</button>
      </div>
      <!-- Step: auth -->
      <div id="step-auth">
        <p class="step-label">Step 1 — Identify yourself</p>
        <div class="social-wrap">
          <button class="social-btn" id="google-signin-btn" onclick="window.signInWithGoogle()">
            <svg viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
            <span>Continue with Google</span>
          </button>
          <button class="social-btn apple-btn" id="apple-signin-btn" onclick="window.signInWithApple()">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.536c-.02-2.11 1.73-3.13 1.81-3.18-.99-1.44-2.53-1.64-3.08-1.66-1.31-.13-2.56.77-3.23.77-.66 0-1.69-.75-2.78-.73-1.43.02-2.75.83-3.48 2.11-1.49 2.58-.38 6.4 1.06 8.49.71 1.03 1.55 2.18 2.66 2.14 1.07-.04 1.47-.69 2.76-.69 1.28 0 1.65.69 2.78.66 1.15-.02 1.87-1.04 2.57-2.08.81-1.19 1.15-2.35 1.16-2.41-.02-.01-2.22-.85-2.24-3.42zM14.9 6.29c.58-.71.98-1.68.87-2.66-.84.04-1.87.57-2.47 1.27-.54.63-1.02 1.63-.89 2.59.94.07 1.9-.48 2.49-1.2z"/></svg>
            <span>Continue with Apple</span>
          </button>
        </div>
        <div class="social-divider">or use email</div>
        <div class="tabs">
          <button class="tab-btn active" data-tab="login" onclick="window.switchAuthTab('login')">Log in</button>
          <button class="tab-btn" data-tab="signup" onclick="window.switchAuthTab('signup')">Sign up</button>
        </div>
        <div id="tab-login">
          <div class="field"><label>Email</label><input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email"/></div>
          <div class="field"><label>Password</label><input type="password" id="auth-password" placeholder="••••••••" autocomplete="current-password"/></div>
          <button class="action-btn" id="auth-submit-btn" onclick="window.submitLogin()">Continue →</button>
        </div>
        <div id="tab-signup" style="display:none">
          <div class="field"><label>Full name</label><input type="text" id="auth-name" placeholder="Jane Doe" autocomplete="name"/></div>
          <div class="field"><label>Email</label><input type="email" id="auth-email-2" placeholder="you@example.com" autocomplete="email"/></div>
          <div class="field"><label>Password (min 8 chars)</label><input type="password" id="auth-password-2" placeholder="••••••••" autocomplete="new-password"/></div>
          <button class="action-btn" id="auth-signup-btn" onclick="window.submitSignup()">Create account →</button>
          <p class="terms-line">By creating an account you agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>
        </div>
        <div class="err-msg" id="auth-error"></div>
      </div>
      <!-- Step: verify -->
      <div id="step-verify" style="display:none">
        <div class="verify-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EABA58" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg></div>
        <p class="step-label" style="text-align:center">Step 2 — Verify your identity</p>
        <p class="ov-sub" id="verify-note">Represent requires a one-time identity check to ensure one person, one ballot. Takes about 2 minutes and is reusable for all future questions.</p>
        <button type="button" class="verify-opt selected" id="opt-standard" onclick="window.selectFlow('standard')">
          <span class="vo-title">Standard — government ID</span>
          <span class="vo-sub">Driver's licence, provincial ID, or passport. Unlocks voting in your verified region.</span>
        </button>
        <button type="button" class="verify-opt" id="opt-citizen" onclick="window.selectFlow('citizen')">
          <span class="vo-title">Citizen — passport + proof of address</span>
          <span class="vo-sub">Everything in standard, plus ballots open to verified citizens only.</span>
        </button>
        <button class="action-btn" id="start-verify-btn" onclick="window.startVerification()">Verify my identity</button>
        <a class="secondary-btn" id="verify-link" target="_blank" rel="noopener" style="display:none;text-align:center;text-decoration:none">Verification didn't open? Tap here</a>
        <button class="secondary-btn" id="check-verify-btn" style="display:none" onclick="window.checkVerification()">I've completed verification →</button>
        <div class="err-msg" id="verify-error"></div>
      </div>
      <!-- Step: vote -->
      <div id="step-vote" style="display:none">
        <p class="step-label">Step 3 — Cast your ballot</p>
        <p class="ov-sub" style="margin-bottom:16px">${esc(b.title)}</p>
        <div id="vote-buttons"></div>
        <div id="vote-confirm" style="display:none">
          <p class="confirm-line" id="confirm-line"></p>
          <button class="vote-btn" id="confirm-cast-btn">Confirm — cast my ballot</button>
          <button class="secondary-btn" id="confirm-back-btn">Back</button>
        </div>
        <div class="err-msg" id="vote-error"></div>
      </div>
      <!-- Step: success -->
      <div id="step-success" style="display:none">
        <div class="success-icon">&#10003;</div>
        <p class="success-title">Ballot recorded!</p>
        <p class="success-sub">Your verified vote is on the public ledger. Live results below.</p>
        <div class="live-tally">
          <div class="tally-row">
            <span class="tally-label">Support</span>
            <span class="tally-val support" id="success-support">${b.pct}%</span>
          </div>
          <div class="bar2"><div class="bar-inner-s" id="success-bar-s" style="width:${b.pct}%"></div></div>
          <div class="tally-row">
            <span class="tally-label">Oppose</span>
            <span class="tally-val oppose" id="success-oppose">${100 - b.pct}%</span>
          </div>
          <div class="bar2"><div class="bar-inner-o" id="success-bar-o" style="width:${100 - b.pct}%"></div></div>
          <p class="live-total" id="success-total">${fmt(b.total)} verified vote${b.total !== 1 ? "s" : ""}</p>
        </div>
        <div class="app-handoff">
          <p class="app-handoff-title">Your Represent account is ready</p>
          <p class="app-handoff-sub">Vote on every question, follow results in real time, and keep your civic record — all in the app.</p>
          <button class="app-btn" onclick="window.openAppOrStore()">Keep voting in the app ↗</button>
        </div>
        <button class="web-continue" onclick="window.closeOverlay()">Continue on web</button>
      </div>
    </div>
  </div>
  <script id="pdata" type="application/json">${pdata}</script>
  <script id="auth-config" type="application/json">${authConfig}</script>
  <script>
  (function(){
    var JWT_KEY='rp_web_jwt';
    var jwt=null;
    var authMode='login';
    var PID,VOTE_TYPE,OPTIONS,GEO_LABEL,IS_CLOSED;
    var _vId=null;
    var _pollTimer=null,_pollCount=0;
    var _pendingPos=null,_pendingIdx=null;
    var _flow='standard';
    var REQ_CITIZEN=false;
    var AUTH_CFG={};
    var _googleCodeClient=null;
    var _appleInited=false;
    try {
      var _acEl=document.getElementById('auth-config');
      AUTH_CFG=_acEl?JSON.parse(_acEl.textContent):{};
    } catch(e) { AUTH_CFG={}; }
    function socialErr(msg){
      var g=document.getElementById('google-signin-btn'),a=document.getElementById('apple-signin-btn');
      if(g)g.disabled=false;if(a)a.disabled=false;
      setErr('auth',msg);
    }
    function finishSocialLogin(res){
      var g=document.getElementById('google-signin-btn'),a=document.getElementById('apple-signin-btn');
      if(g)g.disabled=false;if(a)a.disabled=false;
      if(!res.ok){socialErr(res.d.error||'Sign-in failed.');return;}
      jwt=res.d.token;localStorage.setItem(JWT_KEY,jwt);
      /* The google/apple web login responses omit the verified flag — never
         assume unverified from absence. Ask the canonical endpoint instead. */
      if(res.d.user&&res.d.user.verified&&!REQ_CITIZEN){showStep('vote');}else{checkAuthAndAdvance();}
    }
    window.signInWithGoogle=function(){
      if(!AUTH_CFG.googleClientId){socialErr('Google sign-in is not configured.');return;}
      if(typeof google==='undefined'||!google.accounts||!google.accounts.oauth2){
        socialErr('Google sign-in is still loading. Please try again in a moment.');return;
      }
      var g=document.getElementById('google-signin-btn'),a=document.getElementById('apple-signin-btn');
      if(g)g.disabled=true;if(a)a.disabled=true;
      setErr('auth','');
      if(!_googleCodeClient){
        _googleCodeClient=google.accounts.oauth2.initCodeClient({
          client_id:AUTH_CFG.googleClientId,
          scope:'openid email profile',
          ux_mode:'popup',
          callback:function(response){
            if(!response||response.error||!response.code){
              socialErr('Google sign-in was cancelled or failed.');return;
            }
            fetch('/api/auth/google/web',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:response.code})})
            .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
            .then(finishSocialLogin)
            .catch(function(){socialErr('Network error. Please try again.');});
          },
        });
      }
      _googleCodeClient.requestCode();
    };
    window.signInWithApple=function(){
      if(!AUTH_CFG.appleServicesId){socialErr('Apple sign-in is not configured.');return;}
      if(typeof AppleID==='undefined'||!AppleID.auth){
        socialErr('Apple sign-in is still loading. Please try again in a moment.');return;
      }
      var g=document.getElementById('google-signin-btn'),a=document.getElementById('apple-signin-btn');
      if(g)g.disabled=true;if(a)a.disabled=true;
      setErr('auth','');
      if(!_appleInited){
        AppleID.auth.init({
          clientId:AUTH_CFG.appleServicesId,
          scope:'name email',
          redirectURI:AUTH_CFG.redirectUri,
          usePopup:true,
        });
        _appleInited=true;
      }
      AppleID.auth.signIn().then(function(resp){
        var idToken=resp&&resp.authorization&&resp.authorization.id_token;
        if(!idToken){socialErr('Apple sign-in did not return a valid token.');return;}
        var name=resp.user&&resp.user.name?resp.user.name:undefined;
        var email=resp.user&&resp.user.email?resp.user.email:undefined;
        fetch('/api/auth/apple/web',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_token:idToken,name:name,email:email})})
        .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
        .then(finishSocialLogin)
        .catch(function(){socialErr('Network error. Please try again.');});
      }).catch(function(err){
        if(err&&err.error==='popup_closed_by_user'){socialErr('Sign-in was cancelled.');return;}
        socialErr('Apple sign-in was cancelled or failed.');
      });
    };
    function he(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    window.openVoteOverlay=function(){
      var el=document.getElementById('vote-overlay');if(!el)return;
      el.style.display='flex';
      jwt=localStorage.getItem(JWT_KEY);
      if(jwt){checkAuthAndAdvance();}else{showStep('auth');}
    };
    window.selectFlow=function(f){
      _flow=f==='citizen'?'citizen':'standard';
      var so=document.getElementById('opt-standard'),co=document.getElementById('opt-citizen');
      if(so)so.classList.toggle('selected',_flow==='standard');
      if(co)co.classList.toggle('selected',_flow==='citizen');
    };
    function setVerifyNote(msg){
      var el=document.getElementById('verify-note');if(el&&msg)el.textContent=msg;
    }
    function requireCitizenVerify(){
      selectFlowSafe('citizen');
      setVerifyNote('This ballot is open to verified citizens. Verify citizenship (passport + proof of address) to cast it — it also covers standard verification.');
      showStep('verify');
    }
    function selectFlowSafe(f){if(window.selectFlow)window.selectFlow(f);}
    window.closeOverlay=function(){
      stopPoll();
      var el=document.getElementById('vote-overlay');if(el)el.style.display='none';
    };
    window.switchAuthTab=function(mode){
      authMode=mode;
      var l=document.getElementById('tab-login'),s=document.getElementById('tab-signup');
      if(l)l.style.display=mode==='login'?'':'none';
      if(s)s.style.display=mode==='signup'?'':'none';
      var tabs=document.querySelectorAll('.tab-btn');
      for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle('active',tabs[i].dataset.tab===mode);
      setErr('auth','');
    };
    window.submitLogin=function(){
      var email=document.getElementById('auth-email').value.trim();
      var pw=document.getElementById('auth-password').value;
      if(!email||!pw){setErr('auth','Email and password are required.');return;}
      var btn=document.getElementById('auth-submit-btn');
      btn.disabled=true;btn.textContent='Please wait…';
      fetch('/api/auth/mobile/email/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pw})})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
      .then(function(res){
        if(!res.ok){setErr('auth',res.d.error||'Login failed.');btn.disabled=false;btn.textContent='Continue →';return;}
        jwt=res.d.token;localStorage.setItem(JWT_KEY,jwt);
        if(res.d.user&&res.d.user.verified&&!REQ_CITIZEN){showStep('vote');}else{checkAuthAndAdvance();}
      }).catch(function(){setErr('auth','Network error. Please try again.');btn.disabled=false;btn.textContent='Continue →';});
    };
    window.submitSignup=function(){
      var name=document.getElementById('auth-name').value.trim();
      var email=document.getElementById('auth-email-2').value.trim();
      var pw=document.getElementById('auth-password-2').value;
      if(!name||!email||!pw){setErr('auth','All fields are required.');return;}
      if(pw.length<8){setErr('auth','Password must be at least 8 characters.');return;}
      var btn=document.getElementById('auth-signup-btn');
      btn.disabled=true;btn.textContent='Creating account…';
      fetch('/api/auth/mobile/email/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pw,name:name})})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
      .then(function(res){
        if(!res.ok){setErr('auth',res.d.error||'Sign-up failed.');btn.disabled=false;btn.textContent='Create account →';return;}
        jwt=res.d.token;localStorage.setItem(JWT_KEY,jwt);
        if(REQ_CITIZEN){requireCitizenVerify();}else{showStep('verify');}
      }).catch(function(){setErr('auth','Network error.');btn.disabled=false;btn.textContent='Create account →';});
    };
    window.startVerification=function(){
      var btn=document.getElementById('start-verify-btn');
      btn.disabled=true;btn.textContent='Opening…';
      apiFetch('/api/didit/create-session',{method:'POST',body:JSON.stringify({flow:_flow})})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
      .then(function(res){
        if(!res.ok){
          var em=(res.d&&res.d.error?String(res.d.error):'').toLowerCase();
          if(em.indexOf('already verified')!==-1){showStep('vote');return;}
          /* However the server phrased it — check the canonical status
             before showing an error. An already-verified account belongs
             on the vote step, not in a dead end. */
          apiFetch('/api/auth/verify',{})
          .then(function(r2){return r2.json().then(function(d2){return{ok:r2.ok,d:d2};});})
          .then(function(res2){
            if(res2.ok&&res2.d.user&&res2.d.user.verified===true){showStep('vote');return;}
            setErr('verify',(res.d&&res.d.error)||'Could not start verification. Please try again.');
            btn.disabled=false;btn.textContent='Verify my identity';
          }).catch(function(){
            setErr('verify',(res.d&&res.d.error)||'Could not start verification. Please try again.');
            btn.disabled=false;btn.textContent='Verify my identity';
          });
          return;
        }
        _vId=res.d.verificationId||res.d.sessionToken||null;
        var vlink=document.getElementById('verify-link');
        if(vlink){vlink.href=res.d.sessionUrl;}
        var w=window.open(res.d.sessionUrl,'_blank');
        if(!w&&vlink){
          /* Pop-up blocked (common on iOS Safari) — surface a direct link. */
          vlink.style.display='';
        }
        var cb=document.getElementById('check-verify-btn');if(cb)cb.style.display='';
        btn.textContent='Waiting for verification…';
        startPoll();
      }).catch(function(){setErr('verify','Network error.');btn.disabled=false;btn.textContent='Verify my identity';});
    };
    window.checkVerification=function(){
      var btn=document.getElementById('check-verify-btn');
      btn.disabled=true;btn.textContent='Checking…';
      setErr('verify','');
      var cdUrl='/api/didit/check-decision'+(_vId?'?verificationId='+encodeURIComponent(_vId):'');
      apiFetch(cdUrl,{})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,status:r.status,d:d};});})
      .then(function(res){
        if(!res.ok){
          var msg=(res.d&&res.d.error)||('Verification check failed (HTTP '+res.status+').');
          setErr('verify',msg);
          btn.disabled=false;btn.textContent="I've completed verification →";
          return;
        }
        if(res.d.reason==='duplicate_identity'){
          setErr('verify',res.d.message||'This ID has already been used to verify another Represent account. One person, one account.');
          btn.disabled=false;btn.textContent="I've completed verification →";
          return;
        }
        var status=res.d.status?res.d.status.toLowerCase():'unknown';
        if(status==='approved'&&_flow!=='citizen'&&!REQ_CITIZEN){
          showStep('vote');
          return;
        }
        apiFetch('/api/auth/verify',{})
        .then(function(r2){return r2.json().then(function(d2){return{ok:r2.ok,d:d2};});})
        .then(function(res2){
          var u2=res2.ok&&res2.d.user?res2.d.user:null;
          if(u2&&(REQ_CITIZEN?u2.citizenshipVerified===true:u2.verified===true)){
            showStep('vote');
          }else{
            setErr('verify','Verification not complete yet. Please finish in the new tab, then try again. Status: '+status+'.');
            btn.disabled=false;btn.textContent="I've completed verification →";
          }
        }).catch(function(){
          setErr('verify','Network error while confirming verification. Please try again.');
          btn.disabled=false;btn.textContent="I've completed verification →";
        });
      }).catch(function(){
        setErr('verify','Network error. Please check your connection and try again.');
        btn.disabled=false;btn.textContent="I've completed verification →";
      });
    };
    window.openAppOrStore=function(){
      var STORE='${APP_STORE_URL}';
      var DEEP='represent://open';
      var fallback=setTimeout(function(){window.location.href=STORE;},1500);
      window.addEventListener('visibilitychange',function onVis(){
        if(document.hidden){clearTimeout(fallback);}
        window.removeEventListener('visibilitychange',onVis);
      },{once:true});
      window.location.href=DEEP;
    };
    window.submitVote=function(position,optionIndex){
      var btns=document.querySelectorAll('.vote-btn');
      for(var i=0;i<btns.length;i++)btns[i].disabled=true;
      var selectedOption=(optionIndex!=null&&OPTIONS)?OPTIONS[optionIndex]:undefined;
      var body={proposalId:PID,position:position};
      if(selectedOption!=null)body.selectedOption=selectedOption;
      apiFetch('/api/voting/submit',{method:'POST',body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,status:r.status,d:d};});})
      .then(function(res){
        if(!res.ok){
          var msg=(res.d&&res.d.error)||'Could not submit your vote.';
          if(res.status===403&&msg.toLowerCase().indexOf('geographic')!==-1){
            msg=GEO_LABEL?'This question is open to verified '+GEO_LABEL+' residents. Your verified location does not match.':'You do not meet the geographic requirements for this question.';
          }else if(msg.toLowerCase().indexOf('citizens only')!==-1||msg.toLowerCase().indexOf('verified citizens')!==-1){requireCitizenVerify();return;}
          else if(msg.indexOf('already voted')!==-1){msg='You have already cast a ballot on this question.';}
          else if(msg.indexOf('deadline')!==-1||msg.indexOf('ended')!==-1){msg='Voting on this question has ended.';}
          else if(msg.indexOf('verification')!==-1||msg.indexOf('identity')!==-1){showStep('verify');return;}
          setErr('vote',msg);
          for(var i=0;i<btns.length;i++)btns[i].disabled=false;return;
        }
        var ps=document.getElementById('pr-split');if(ps)ps.style.display='flex';
        var rl=document.getElementById('pr-reveal');if(rl)rl.style.display='none';
        showStep('success');loadLiveTally();
      }).catch(function(){setErr('vote','Network error.');for(var i=0;i<btns.length;i++)btns[i].disabled=false;});
    };
    function showStep(n){
      if(n!=='verify')stopPoll();
      if(n==='vote')backToChoices();
      var all=['auth','verify','vote','success'];
      for(var i=0;i<all.length;i++){var el=document.getElementById('step-'+all[i]);if(el)el.style.display=(all[i]===n?'':'none');}
      var titles={auth:'Identify yourself',verify:'Verify identity',vote:'Cast your ballot',success:'Ballot recorded'};
      var t=document.getElementById('ov-title');if(t&&titles[n])t.textContent=titles[n];
    }
    function apiFetch(url,opts){
      var headers={'Content-Type':'application/json'};
      if(jwt)headers['Authorization']='Bearer '+jwt;
      return fetch(url,{method:opts.method||'GET',headers:headers,body:opts.body||undefined});
    }
    function checkAuthAndAdvance(){
      apiFetch('/api/auth/verify',{}).then(function(r){
        if(!r.ok){localStorage.removeItem(JWT_KEY);jwt=null;showStep('auth');return;}
        r.json().then(function(d){
          if(!d.user){showStep('auth');return;}
          if(REQ_CITIZEN&&d.user.citizenshipVerified!==true){requireCitizenVerify();return;}
          if(d.user.verified){showStep('vote');}else{showStep('verify');}
        });
      }).catch(function(){showStep('auth');});
    }
    function loadLiveTally(){
      if(!PID)return;
      fetch('/api/p/'+PID+'/tally').then(function(r){return r.json();}).then(function(d){
        var tot=d.totalVotes||0;
        var el=document.getElementById('success-total');if(el)el.textContent=tot.toLocaleString()+' verified ballot'+(tot!==1?'s':'')+' cast';
        if(tot>0){
          var sp=Math.round(d.supportVotes/tot*100),op=100-sp;
          var se=document.getElementById('success-support'),oe=document.getElementById('success-oppose');
          var sb=document.getElementById('success-bar-s'),ob=document.getElementById('success-bar-o');
          if(se)se.textContent=sp+'% Support';if(oe)oe.textContent=op+'% Oppose';
          if(sb)sb.style.width=sp+'%';if(ob)ob.style.width=op+'%';
        }
      }).catch(function(){});
    }
    function setErr(step,msg){
      var el=document.getElementById(step+'-error');if(!el)return;
      el.textContent=msg;el.style.display=msg?'':'none';
    }
    function buildVoteButtons(){
      var c=document.getElementById('vote-buttons');if(!c)return;
      if(VOTE_TYPE==='multiple-choice'&&OPTIONS&&OPTIONS.length>0){
        var html='';
        for(var i=0;i<OPTIONS.length;i++){
          html+='<button class="vote-btn vote-opt" data-idx="'+i+'">'+he(OPTIONS[i])+'</button>';
        }
        c.innerHTML=html;
        var optBtns=c.querySelectorAll('.vote-opt');
        for(var j=0;j<optBtns.length;j++){
          (function(b){
            b.addEventListener('click',function(){askConfirm('multiple-choice',+b.dataset.idx);});
          })(optBtns[j]);
        }
      }else{
        c.innerHTML='<button class="vote-btn vote-support">✓ Support</button>'
          +'<button class="vote-btn vote-oppose">✗ Oppose</button>';
        var sb=c.querySelector('.vote-support'),ob=c.querySelector('.vote-oppose');
        if(sb)sb.addEventListener('click',function(){askConfirm('support',null);});
        if(ob)ob.addEventListener('click',function(){askConfirm('oppose',null);});
      }
    }
    /* Confirm-before-cast — a ballot is permanent, so no single tap may
       submit one. Mirrors the app's mandatory X1 confirm sheet. */
    function askConfirm(pos,idx){
      _pendingPos=pos;_pendingIdx=idx;
      var line=document.getElementById('confirm-line');
      var cbtn=document.getElementById('confirm-cast-btn');
      if(line){
        var what=pos==='support'?'Support':pos==='oppose'?'Oppose':'"'+(OPTIONS&&OPTIONS[idx]!=null?OPTIONS[idx]:'this option')+'"';
        line.textContent='You are casting '+what+'. A ballot is recorded permanently and cannot be changed.';
      }
      if(cbtn){
        cbtn.className='vote-btn '+(pos==='support'?'vote-support':pos==='oppose'?'vote-oppose':'vote-opt');
        cbtn.disabled=false;
      }
      var vb=document.getElementById('vote-buttons'),vc=document.getElementById('vote-confirm');
      if(vb)vb.style.display='none';if(vc)vc.style.display='';
      setErr('vote','');
    }
    function backToChoices(){
      var vb=document.getElementById('vote-buttons'),vc=document.getElementById('vote-confirm');
      if(vc)vc.style.display='none';if(vb)vb.style.display='';
      var btns=document.querySelectorAll('.vote-btn');
      for(var i=0;i<btns.length;i++)btns[i].disabled=false;
      _pendingPos=null;_pendingIdx=null;
      setErr('vote','');
    }
    /* Verification auto-poll — the manual button stays as a fallback. */
    function startPoll(){
      stopPoll();_pollCount=0;
      _pollTimer=setInterval(function(){
        _pollCount++;
        if(_pollCount>75){stopPoll();return;}
        pollVerify();
      },4000);
    }
    function stopPoll(){if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}}
    function pollVerify(){
      var cdUrl='/api/didit/check-decision'+(_vId?'?verificationId='+encodeURIComponent(_vId):'');
      apiFetch(cdUrl,{})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
      .then(function(res){
        if(!res.ok)return;
        if(res.d.reason==='duplicate_identity'){
          stopPoll();
          setErr('verify',res.d.message||'This ID has already been used to verify another Represent account. One person, one account.');
          return;
        }
        var st=res.d.status?res.d.status.toLowerCase():'';
        if(st==='approved'&&_flow!=='citizen'&&!REQ_CITIZEN){stopPoll();showStep('vote');return;}
        if(st==='declined'){
          stopPoll();
          setErr('verify','Verification was declined. You can try again.');
          var b2=document.getElementById('start-verify-btn');
          if(b2){b2.disabled=false;b2.textContent='Try again';}
          return;
        }
        /* Citizen flow (or citizens-only ballot): the citizenship stamp is
           written by the server webhook, so advance only once the canonical
           endpoint confirms it. Standard flow checks every third poll. */
        if(st==='approved'||_pollCount%3===0){
          apiFetch('/api/auth/verify',{})
          .then(function(r2){return r2.json();})
          .then(function(d2){
            if(!d2.user)return;
            if(REQ_CITIZEN){
              if(d2.user.citizenshipVerified===true){stopPoll();showStep('vote');}
            }else if(d2.user.verified===true){stopPoll();showStep('vote');}
          })
          .catch(function(){});
        }
      }).catch(function(){});
    }
    try {
      var _el=document.getElementById('pdata');
      var _pd=_el?JSON.parse(_el.textContent):{};
      PID=_pd.id;
      VOTE_TYPE=_pd.voteType||'binary';
      OPTIONS=_pd.options||[];
      GEO_LABEL=_pd.geoLabel||'';
      IS_CLOSED=_pd.isClosed||false;
      REQ_CITIZEN=!!_pd.requiresCitizenship;
      if(REQ_CITIZEN)selectFlowSafe('citizen');
    } catch(e) {
      console.error('[Represent] pdata parse error:',e);
      OPTIONS=[];VOTE_TYPE='binary';
    }
    buildVoteButtons();
    var _cc=document.getElementById('confirm-cast-btn');
    if(_cc)_cc.addEventListener('click',function(){window.submitVote(_pendingPos,_pendingIdx);});
    var _cb=document.getElementById('confirm-back-btn');
    if(_cb)_cb.addEventListener('click',backToChoices);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')window.closeOverlay();});
  })();
  </script>`;
}

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

function convertCardHtml(b: BallotVM | null, canWebVote = false): string {
  const line = b && !b.ended && b.region
    ? `Live in ${esc(b.region)}? Add yours before it closes.`
    : b && !b.ended
      ? `This ballot is open now. Add yours before it closes.`
      : `Open ballots are being counted right now. Add your voice.`;
  const cta = canWebVote
    ? `<button class="gold-btn vote-now-btn" onclick="window.openVoteOverlay()">Vote now — no app needed</button>
      <span class="under-cta mono" style="letter-spacing:.1em">VERIFY ONCE · CHECKED, NEVER KEPT</span>
      <a class="applink" href="${APP_STORE_URL}">Or get Represent for iPhone →</a>`
    : `<a class="gold-btn" href="${APP_STORE_URL}">Get Represent — it&#39;s free</a>
      <span class="under-cta mono" style="letter-spacing:.1em">VERIFY ONCE · CHECKED, NEVER KEPT</span>`;
  return `<div class="convert">
    <div style="flex:1">
      <div class="big">This count is one verified person, one ballot.</div>
      <div class="sub">${line}</div>
    </div>
    <div class="convert-cta">
      ${cta}
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
      // In-browser voting supports yes/no and multiple-choice (the overlay
      // has no ranked-choice UI — those ballots vote in the app).
      const canWebVote = !b.ended && (!proposal.voteType || proposal.voteType === "yes-no" || proposal.voteType === "multiple-choice");

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
        if (canWebVote) {
          // PD2 on the web: a reader here is a potential voter, so the split
          // stays hidden until they cast (or explicitly opt in) — same
          // anti-bandwagon default as the app's detail sheet.
          tallyModule = `<div class="module">
            <div class="head"><span class="label">LIVE COUNT</span><span class="count">${fmt(b.total)} BALLOTS CAST</span></div>
            <div id="pr-split" style="display:none;flex-direction:column;gap:14px">
              ${tallyBarHtml(b.pct, "big")}
              <div class="splitrow" style="font-size:13px"><span class="s">SUPPORT ${b.pct}% · ${fmt(b.support)}</span><span class="o">OPPOSE ${100 - b.pct}% · ${fmt(b.oppose)}</span></div>
            </div>
            <div class="foot">The split is hidden until you vote — decide on the question, not the crowd.</div>
            <button class="pr-reveal" id="pr-reveal" onclick="document.getElementById('pr-split').style.display='flex';this.style.display='none'">Show current split anyway</button>
          </div>`;
        } else {
          tallyModule = `<div class="module">
            <div class="head"><span class="label">LIVE TALLY</span><span class="count">${fmt(b.total)} VERIFIED BALLOTS</span></div>
            ${tallyBarHtml(b.pct, "big")}
            <div class="splitrow" style="font-size:13px"><span class="s">SUPPORT ${b.pct}% · ${fmt(b.support)}</span><span class="o">OPPOSE ${100 - b.pct}% · ${fmt(b.oppose)}</span></div>
            <div class="foot">Live count — updates as verified ${b.region ? `residents of ${esc(b.region)}` : "citizens"} cast their ballots.</div>
          </div>`;
        }
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
<meta name="twitter:description" content="${esc(ogDesc)}">
${canWebVote ? `<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js" async defer></script>
<style>${WEBVOTE_CSS}</style>` : ""}`;

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
          ${convertCardHtml(b, canWebVote)}
          <div class="ledgerline">
            <span>EVERY BALLOT RECORDED ON A PUBLIC, TAMPER-EVIDENT LEDGER</span>
            <a href="/record#how">How counting works</a>
          </div>
        </main>
        ${canWebVote ? webVoteHtml(b, proposal, String(req.get?.("host") || "representportal.com")) : ""}`;

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
