'use client';

import { useState } from 'react';
import { Container } from './Container';

const QUESTIONS = [
  {
    q: 'Is this binding? Do cities have to listen?',
    a: 'A vote on Represent is binding when the city decides it is — most run them as the official record for the motion they were attached to. Either way, the result is signed, public, and citable. Council can act on it the same day.',
  },
  {
    q: 'How do you stop people from voting twice?',
    a: 'Identity verification once, geo-restricted forever. We check your ID against government APIs, biometric-match it to a face capture, and tie the verified residence to your account. The same person cannot register twice — and cannot vote on something they don\'t live inside.',
  },
  {
    q: 'What happens to my ID document?',
    a: 'It is processed on-device by our verification partner (Veriff) and discarded. Only the proof of residence — country, province, city — stays on our servers. We do not store the document image, the biometric template, or the OCR contents.',
  },
  {
    q: 'Is the app free?',
    a: 'Yes, for citizens. Always. Free to download, free to vote, no ads, no in-app purchases required. We make money from cities and organizations, not from your data. There is an optional Premium tier ($7.99/mo) that adds the Sentinel AI governance analyzer and a few power-user features.',
  },
  {
    q: 'How do you handle audits?',
    a: 'Every vote is signed and time-stamped on Base. Records become public the moment a vote closes. Deloitte LLP audits the platform yearly and signs an opinion letter that ships with the report. Last year: zero material findings, identity verification chain integrity at 100%.',
  },
  {
    q: 'What about people without smartphones?',
    a: 'Cities that run on Represent commit to a paper-and-kiosk fallback for every vote. The Civic Desk dashboard merges in-person turnout with mobile turnout into a single signed result. We do not believe digital democracy means leaving anyone behind.',
  },
  {
    q: 'Are you partisan? Do you take political positions?',
    a: 'No. Represent is infrastructure. We do not author proposals, take editorial stances on outcomes, or accept advertising from political parties or PACs. The platform is neutral. The wins and losses on it are yours.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
          <div>
            <div className="eyebrow mb-4">QUESTIONS</div>
            <h2 className="font-serif text-4xl leading-[1.05] tracking-crunch md:text-[52px]">
              The ones we
              <br />
              <em className="not-italic text-gold">actually get asked.</em>
            </h2>
            <p className="mt-6 max-w-[42ch] text-[14.5px] leading-relaxed text-bone-muted">
              If something else is on your mind, write us at{' '}
              <a
                href="mailto:hello@representvote.com"
                className="text-bone underline decoration-gold/40 underline-offset-4 transition-colors hover:decoration-gold"
              >
                hello@representvote.com
              </a>
              . A human reads them.
            </p>
          </div>

          <div className="divide-y divide-bone/[0.08] border-y border-bone/[0.08]">
            {QUESTIONS.map((q, i) => (
              <FAQRow key={i} q={q.q} a={q.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function FAQRow({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-6 py-5 text-left transition-colors hover:bg-bone/[0.015]"
      >
        <span className="font-serif text-[20px] leading-[1.25] tracking-tightish text-bone md:text-[22px]">
          {q}
        </span>
        <span
          aria-hidden
          className={`mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-bone/[0.15] text-bone-muted transition-transform duration-300 ${
            open ? 'rotate-45' : ''
          }`}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-[60ch] text-[14.5px] leading-relaxed text-bone-muted">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}
