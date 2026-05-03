import { Container } from './Container';

const FEATURES = [
  {
    n: '01',
    title: 'Run a vote in 4 minutes.',
    body: 'Compose. Pick the wards. Choose the window. Hit publish. The dossier reaches every verified resident in those wards within seconds.',
  },
  {
    n: '02',
    title: 'Watch it land in real time.',
    body: 'Live tally by ward, by age, by verification method. Pulses on the map when activity surges. Your team always knows where things stand.',
  },
  {
    n: '03',
    title: 'Final reports, audited yearly.',
    body: "Every result is signed and time-stamped. Deloitte signs off annually. Nobody can credibly question whether the numbers add up — because they actually do.",
  },
];

const STATS = [
  { v: '208,743', l: 'Votes cast · April 2026', t: 'one city' },
  { v: '23.4%', l: 'Turnout', t: 'up from 18.6% prior' },
  { v: '4 min', l: 'Median time to publish', t: 'compose to live' },
  { v: '0', l: 'Material audit findings', t: 'last 12 months' },
];

export function ForCities() {
  return (
    <section id="cities" className="relative py-24 md:py-32">
      <Container>
        <div className="mb-14 grid grid-cols-1 items-end gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="max-w-[640px]">
            <div className="eyebrow mb-4">FOR CITIES & PUBLIC ORGS</div>
            <h2 className="font-serif text-4xl leading-[1.05] tracking-crunch md:text-[60px]">
              Stop guessing what
              <br />
              residents <em className="not-italic text-gold">actually want.</em>
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-bone-muted lg:max-w-[420px]">
            Civic Desk is the operating layer for verified consultation. Compose a proposal, scope it to the wards that matter, get a result the council can act on — with an audit trail that holds up.
          </p>
        </div>

        {/* Civic Desk preview frame — institutional dossier */}
        <CivicDeskPreview />

        {/* Feature row — zig-zag, not 3-up cards */}
        <div className="mt-20 grid gap-px overflow-hidden rounded-[20px] border border-bone/[0.08] bg-bone/[0.04] md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="bg-ink-850 p-7 md:p-8"
            >
              <div className="font-mono text-[10.5px] tracking-eyebrow text-gold">
                {f.n}
              </div>
              <h3 className="mt-3 font-serif text-[24px] leading-[1.15] tracking-tightish">
                {f.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-bone-muted">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* Stat strip */}
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-bone/[0.08] bg-bone/[0.04] md:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.l}
              className="flex flex-col gap-1.5 bg-ink-850 px-6 py-5"
            >
              <div className="font-serif text-[28px] leading-none tracking-tightish text-bone">
                {s.v}
              </div>
              <div className="text-[12.5px] text-bone-muted">{s.l}</div>
              <div className="font-mono text-[10px] tracking-wide text-bone-faint">
                {s.t.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-bone/[0.08] bg-bone/[0.02] p-7 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <div className="eyebrow-gold mb-2">PILOT PROGRAM · OPEN</div>
            <h3 className="font-serif text-[24px] leading-tight tracking-tightish">
              Bring verified voting to your jurisdiction.
            </h3>
            <p className="mt-2 max-w-[55ch] text-[14px] text-bone-muted">
              30-minute walkthrough with our team. We'll demo Civic Desk on your actual ward map, walk through audit posture, and quote a pilot.
            </p>
          </div>
          <a
            href="mailto:hello@representvote.com?subject=Civic%20Desk%20demo%20request"
            className="shrink-0 rounded-full bg-gold px-6 py-3 text-[14px] font-medium text-ink transition-transform active:translate-y-[1px]"
          >
            Book a demo
          </a>
        </div>
      </Container>
    </section>
  );
}

// Compressed Civic Desk preview — three columns of dossier surfaces.
function CivicDeskPreview() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-bone/[0.10] bg-ink-850 shadow-diffuse">
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-bone/[0.08] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-bone/[0.18]" />
          <span className="h-2.5 w-2.5 rounded-full bg-bone/[0.18]" />
          <span className="h-2.5 w-2.5 rounded-full bg-bone/[0.18]" />
          <span className="ml-3 font-mono text-[11px] tracking-eyebrow text-bone-faint">
            CIVIC DESK · CITY OF CALGARY · DASHBOARD
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-eyebrow text-bone-faint">
          SESSION XLVII
        </span>
      </div>

      {/* Body */}
      <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
        {/* Live proposal row */}
        <div className="rounded-xl border border-bone/[0.08] bg-bone/[0.02] p-5 md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-eyebrow text-support">
              <span className="h-1.5 w-1.5 rounded-full bg-support animate-pulse" />
              LIVE
            </span>
            <span className="font-mono text-[10px] tracking-eyebrow text-bone-faint">
              CG · 2061 · 26
            </span>
            <span className="font-mono text-[10px] tracking-eyebrow text-gold">
              · OFFICIAL
            </span>
          </div>
          <h4 className="mt-3 font-serif text-[22px] leading-[1.15] tracking-tightish">
            Bus rapid transit · 17 Avenue corridor
          </h4>
          <p className="mt-2 text-[12.5px] text-bone-faint">
            E. Nakamura · Wards 6, 7, 8
          </p>
          <div className="mt-4 flex justify-between font-mono text-[10px]">
            <span className="text-support">64% sup</span>
            <span className="text-oppose">36% opp</span>
          </div>
          <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-bone/[0.06]">
            <span className="block bg-support" style={{ width: '64%' }} />
            <span className="block bg-oppose" style={{ width: '36%' }} />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-[9px] tracking-eyebrow text-bone-faint">VOTES</div>
              <div className="font-serif text-[20px] leading-none">32,418</div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-eyebrow text-bone-faint">CLOSES IN</div>
              <div className="font-serif text-[20px] leading-none text-gold">2d 04h</div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-eyebrow text-bone-faint">ELIGIBLE</div>
              <div className="font-serif text-[20px] leading-none">121,050</div>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border border-bone/[0.08] bg-bone/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow">ACTIVITY</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-eyebrow text-support">
              <span className="h-1 w-1 rounded-full bg-support animate-pulse" />
              LIVE
            </span>
          </div>
          <ul className="mt-3 space-y-3 text-[12px]">
            <FeedItem text="128 new votes just came in" t="2m" />
            <FeedItem text="Hit 25,000 votes" t="38m" tone="gold" />
            <FeedItem text="12 new residents joined" t="1h" />
            <FeedItem text="Brief saved" t="2h" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function FeedItem({
  text,
  t,
  tone,
}: {
  text: string;
  t: string;
  tone?: 'gold';
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          tone === 'gold' ? 'bg-gold' : 'bg-bone/[0.3]'
        }`}
      />
      <span className="flex-1 text-bone">{text}</span>
      <span className="font-mono text-[10px] tracking-wide text-bone-faint">
        {t}
      </span>
    </li>
  );
}
