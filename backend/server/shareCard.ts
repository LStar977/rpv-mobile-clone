// ─────────────────────────────────────────────────────────────────────────────
// OG share cards (design handoff "Share Cards OG", states OG1–OG5).
// 1200×630 PNG rendered per proposal: gold hairline brand edge, scope +
// status chips, the ballot question in Newsreader serif (2 lines max),
// then the tally zone per state:
//   OG1 live ≥25 ballots  → 20px two-tone bar (green on red track, white
//                           midline) + exact mono counts
//   OG2 live <25 ballots  → 25-dot threshold row (gold filled) +
//                           "N OF 25 BALLOTS · TALLY VISIBLE AT 25"
//   OG3 zero ballots      → "BE THE FIRST VERIFIED BALLOT →" in gold
//   OG4 closed, passed    → green PASSED chip + final tally bar
//   OG5 closed, failed    → red DID NOT PASS chip + final tally bar
//
// Rendering: hand-built SVG rasterized with @resvg/resvg-js. The dependency
// is OPTIONAL — when it (or the fonts) can't load, shareCardsEnabled()
// reports false and /p/:id simply omits the og:image tag, exactly like
// before this feature existed. Install with:  npm i @resvg/resvg-js
// Fonts (Newsreader/Onest/JetBrains Mono TTFs) are fetched from Google
// Fonts once at first render and cached in the OS temp dir.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createRequire } from "module";

// tsx runs this file as ESM, where bare `require` is undefined — createRequire
// gives us a CJS require for optionally loading the native resvg module.
const cjsRequire = createRequire(import.meta.url);

const W = 1200;
const H = 630;
const PAD_X = 72;
const CONTENT_W = W - PAD_X * 2;

const C = {
  bg: "#040707",
  surfaceHi: "#202626",
  text: "#F4F5F6",
  text3: "#7A7D7E",
  gold: "#EABA58",
  goldLight: "#F0CB7A",
  goldDark: "#C99A38",
  support: "#34D399",
  oppose: "#F87171",
  border: "rgba(244,245,246,0.12)",
  hairline: "rgba(244,245,246,0.08)",
};

// The Represent mark (same path the /p/:id page uses).
const LOGO = (x: number, y: number, size: number) =>
  `<g transform="translate(${x},${y}) scale(${size / 100})">` +
  `<circle cx="50" cy="50" r="44" stroke="${C.gold}" stroke-width="5" fill="none"/>` +
  `<path d="M52 16c-3 0-5.5 2.4-5.5 5.5v22c0 1-1.5 1-1.5 0V31c0-3-2.4-5.5-5.5-5.5S34 28 34 31v25c-1-2-2.5-4-4.5-3.4-2 .6-2.4 2.8-1.3 4.8l7.2 13c2 3.5 5.5 6.4 11 6.4h2.5c7 0 12-5 12-12V27c0-3-2.5-5.5-5.5-5.5S50 24 50 27v15c0 1-1.5 1-1.5 0V21.5c0-3-2.5-5.5-5.5-5.5z" fill="${C.gold}"/></g>`;

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));

// Adaptive title sizing: the TTF Google serves is the text optical size
// (wider than the mock's display cut), measuring ~0.465em average advance
// at Newsreader 500. Long questions step down in size instead of
// truncating; only 140-char monsters get the ellipsis.
function layoutTitle(title: string): { lines: string[]; fontSize: number } {
  const t = title.trim();
  const fontSize = t.length <= 58 ? 76 : t.length <= 76 ? 62 : 54;
  const maxCharsPerLine = Math.floor(CONTENT_W / (fontSize * 0.465));
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === 2) break;
    }
  }
  if (line && lines.length < 2) lines.push(line);
  if (lines.length === 2) {
    const consumed = lines.join(" ").length;
    if (consumed < t.length) {
      lines[1] = lines[1].slice(0, maxCharsPerLine - 1).replace(/\s+\S*$/, "") + "…";
    }
  }
  return { lines, fontSize };
}

type CardState = "live" | "threshold" | "zero" | "passed" | "failed";

export interface ShareCardData {
  title: string;
  scopeLabel: string; // e.g. "CALGARY · MUNICIPAL" or "GLOBAL"
  supportVotes: number;
  opposeVotes: number;
  deadline?: string | null;
  ended: boolean;
}

const TALLY_THRESHOLD = 25;

function stateOf(d: ShareCardData): CardState {
  const total = d.supportVotes + d.opposeVotes;
  if (d.ended) {
    if (total < TALLY_THRESHOLD) return "threshold"; // closed below threshold: dots, count shown, split never
    return d.supportVotes > d.opposeVotes ? "passed" : "failed";
  }
  if (total === 0) return "zero";
  if (total < TALLY_THRESHOLD) return "threshold";
  return "live";
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  return dt
    .toLocaleDateString("en-CA", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase()
    .replace(/,/g, "");
}

function buildSVG(d: ShareCardData): string {
  const state = stateOf(d);
  const total = d.supportVotes + d.opposeVotes;
  const pct = total > 0 ? Math.round((d.supportVotes / total) * 100) : 0;
  const { lines: titleLines, fontSize: titleSize } = layoutTitle(d.title);
  const nf = (n: number) => n.toLocaleString("en-CA");

  // ── chips row ──
  const statusChip = (() => {
    switch (state) {
      case "passed":
        return { label: "PASSED", color: C.support, bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.3)", dot: false };
      case "failed":
        return { label: "DID NOT PASS", color: C.oppose, bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)", dot: false };
      case "zero":
        return { label: "JUST OPENED", color: C.gold, bg: "rgba(234,186,88,0.08)", border: "rgba(234,186,88,0.3)", dot: true };
      default:
        return { label: "LIVE", color: C.gold, bg: "rgba(234,186,88,0.08)", border: "rgba(234,186,88,0.3)", dot: true };
    }
  })();
  const dateLabel = d.ended
    ? (fmtDate(d.deadline) ? `CLOSED ${fmtDate(d.deadline)}` : "CLOSED")
    : (fmtDate(d.deadline) ? `CLOSES ${fmtDate(d.deadline)}` : "");

  const chipH = 46;
  const chipY = 64;
  const scopeLabel = esc(d.scopeLabel.toUpperCase());
  // Mono/sans chip width estimates (20px, wide tracking).
  const scopeW = scopeLabel.length * 15.5 + 44;
  const statusTextW = statusChip.label.length * 14.5;
  const statusW = statusTextW + 44 + (statusChip.dot ? 24 : 0);

  let svgChips = `
  <rect x="${PAD_X}" y="${chipY}" width="${scopeW}" height="${chipH}" rx="23" fill="${C.surfaceHi}"/>
  <text x="${PAD_X + scopeW / 2}" y="${chipY + 30}" text-anchor="middle" font-family="Onest" font-weight="600" font-size="20" letter-spacing="2.8" fill="${C.text3}">${scopeLabel}</text>
  <rect x="${PAD_X + scopeW + 14}" y="${chipY}" width="${statusW}" height="${chipH}" rx="23" fill="${statusChip.bg}" stroke="${statusChip.border}" stroke-width="1.5"/>`;
  let sx = PAD_X + scopeW + 14 + 22;
  if (statusChip.dot) {
    svgChips += `<circle cx="${sx + 6}" cy="${chipY + 23}" r="6" fill="${state === "zero" ? C.gold : C.support}"/>`;
    sx += 24;
  }
  svgChips += `<text x="${sx}" y="${chipY + 30}" font-family="JetBrains Mono" font-weight="600" font-size="20" letter-spacing="2.8" fill="${statusChip.color}">${statusChip.label}</text>`;
  if (dateLabel) {
    svgChips += `<text x="${W - PAD_X}" y="${chipY + 30}" text-anchor="end" font-family="JetBrains Mono" font-weight="500" font-size="22" letter-spacing="1.76" fill="${C.text3}">${esc(dateLabel)}</text>`;
  }

  // ── question ──
  const lineH = Math.round(titleSize * 1.22);
  // Vertically center the 1-2 line block in the zone between chips and tally.
  const titleY = titleLines.length === 1 ? 262 : 218 + (76 - titleSize);
  const svgTitle = titleLines
    .map(
      (line, i) =>
        `<text x="${PAD_X}" y="${titleY + i * lineH}" font-family="Newsreader" font-weight="500" font-size="${titleSize}" letter-spacing="${(-0.012 * titleSize).toFixed(2)}" fill="${C.text}">${esc(line)}</text>`,
    )
    .join("\n");

  // ── tally zone ──
  const tallyBarY = 442;
  const countsY = 512;
  let svgTally = "";
  if (state === "live" || state === "passed" || state === "failed") {
    const fillW = Math.round((CONTENT_W * pct) / 100);
    svgTally = `
  <clipPath id="bar"><rect x="${PAD_X}" y="${tallyBarY}" width="${CONTENT_W}" height="20" rx="10"/></clipPath>
  <rect x="${PAD_X}" y="${tallyBarY}" width="${CONTENT_W}" height="20" rx="10" fill="${C.oppose}"/>
  <rect x="${PAD_X}" y="${tallyBarY}" width="${fillW}" height="20" clip-path="url(#bar)" fill="${C.support}"/>
  <rect x="${PAD_X + CONTENT_W / 2 - 1.5}" y="${tallyBarY - 4}" width="3" height="28" fill="${C.text}" opacity="0.9"/>
  <text x="${PAD_X}" y="${countsY}" font-family="JetBrains Mono" font-weight="500" font-size="26" fill="${C.support}">SUPPORT ${nf(d.supportVotes)} · ${pct}%</text>
  <text x="${W / 2}" y="${countsY}" text-anchor="middle" font-family="JetBrains Mono" font-weight="500" font-size="26" fill="${C.text3}">${nf(total)} ${d.ended ? "BALLOTS · FINAL" : "VERIFIED BALLOTS"}</text>
  <text x="${W - PAD_X}" y="${countsY}" text-anchor="end" font-family="JetBrains Mono" font-weight="500" font-size="26" fill="${C.oppose}">OPPOSE ${nf(d.opposeVotes)} · ${100 - pct}%</text>`;
  } else if (state === "threshold") {
    // 25 dots, 34px, gap 8 → 1042 wide (fits the 1056 content column).
    const dotR = 17;
    const gap = 8;
    const dots = Array.from({ length: TALLY_THRESHOLD })
      .map((_, i) => {
        const cx = PAD_X + dotR + i * (dotR * 2 + gap);
        return `<circle cx="${cx}" cy="${tallyBarY + dotR}" r="${dotR}" fill="${i < total ? C.gold : C.surfaceHi}"/>`;
      })
      .join("");
    svgTally = `${dots}
  <text x="${PAD_X}" y="${countsY + 8}" font-family="JetBrains Mono" font-weight="600" font-size="26" letter-spacing="1.5" fill="${C.gold}">${total} OF ${TALLY_THRESHOLD} BALLOTS${d.ended ? " · CLOSED BELOW THRESHOLD" : ""}</text>
  <text x="${W - PAD_X}" y="${countsY + 8}" text-anchor="end" font-family="JetBrains Mono" font-weight="500" font-size="26" letter-spacing="1.5" fill="${C.text3}">${d.ended ? "SPLIT NEVER SHOWN" : "TALLY VISIBLE AT 25"}</text>`;
  } else {
    // zero
    svgTally = `<text x="${PAD_X}" y="${tallyBarY + 34}" font-family="JetBrains Mono" font-weight="600" font-size="30" letter-spacing="2.4" fill="${C.gold}">BE THE FIRST VERIFIED BALLOT →</text>`;
  }

  // ── footer ──
  const footY = 556;
  const footerRight = d.ended ? "ON THE PUBLIC LEDGER — REPRESENT.VOTE" : "ONE PERSON · ONE BALLOT — REPRESENT.VOTE";
  const svgFooter = `
  <rect x="${PAD_X}" y="${footY}" width="${CONTENT_W}" height="1" fill="${C.hairline}"/>
  ${LOGO(PAD_X, footY + 18, 38)}
  <text x="${PAD_X + 52}" y="${footY + 46}" font-family="Onest" font-weight="600" font-size="26" letter-spacing="1" fill="${C.text}">Represent</text>
  <text x="${W - PAD_X}" y="${footY + 45}" text-anchor="end" font-family="JetBrains Mono" font-weight="500" font-size="22" letter-spacing="3.5" fill="${C.text3}">${footerRight}</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldEdge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.goldLight}"/><stop offset="0.5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldDark}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="6" fill="url(#goldEdge)"/>
  ${svgChips}
  ${svgTitle}
  ${svgTally}
  ${svgFooter}
</svg>`;
}

// ── fonts + rasterizer (both optional) ───────────────────────────────────────

let resvgModule: any = null;
let resvgTried = false;
function getResvg(): any {
  if (!resvgTried) {
    resvgTried = true;
    try {
      resvgModule = cjsRequire("@resvg/resvg-js");
    } catch {
      console.warn("[shareCard] @resvg/resvg-js not installed — share cards disabled (npm i @resvg/resvg-js)");
    }
  }
  return resvgModule;
}

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=Onest:wght@500;600&family=JetBrains+Mono:wght@500;600";

let fontFiles: string[] | null = null;
let fontsTried = false;
async function getFontFiles(): Promise<string[] | null> {
  if (fontsTried) return fontFiles;
  fontsTried = true;
  try {
    const dir = path.join(tmpdir(), "represent-og-fonts");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // No modern UA header → Google serves TTF instead of woff2 (resvg needs TTF/OTF).
    const cssRes = await fetch(FONT_CSS_URL, { headers: { "User-Agent": "curl/8" } });
    if (!cssRes.ok) throw new Error(`font css ${cssRes.status}`);
    const css = await cssRes.text();
    const urls = Array.from(new Set(css.match(/https:[^)]+\.ttf/g) || []));
    if (urls.length === 0) throw new Error("no ttf urls in font css");
    const files: string[] = [];
    for (const url of urls) {
      const file = path.join(dir, path.basename(new URL(url).pathname));
      if (!existsSync(file)) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`font fetch ${r.status}`);
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      }
      files.push(file);
    }
    fontFiles = files;
  } catch (e: any) {
    console.warn(`[shareCard] font load failed — share cards disabled: ${e?.message || e}`);
    fontFiles = null;
  }
  return fontFiles;
}

// Tallies move, so cards are cached briefly, not forever.
const cache = new Map<string, { buf: Buffer; ts: number }>();
const CACHE_TTL_MS = 120_000;

export function shareCardsEnabled(): boolean {
  return !!getResvg();
}

export async function renderShareCardPNG(id: string, data: ShareCardData): Promise<Buffer | null> {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.buf;

  const resvg = getResvg();
  if (!resvg) return null;
  const fonts = await getFontFiles();
  if (!fonts) return null;

  const svg = buildSVG(data);
  const renderer = new resvg.Resvg(svg, {
    fitTo: { mode: "width" as const, value: W },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Onest" },
    background: C.bg,
  });
  const buf: Buffer = renderer.render().asPng();

  cache.set(id, { buf, ts: Date.now() });
  // Bound the cache — one viral proposal shouldn't grow it unbounded anyway,
  // but a sweep keeps long-tail ids from accumulating.
  if (cache.size > 500) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of cache) if (v.ts < cutoff) cache.delete(k);
  }
  return buf;
}
