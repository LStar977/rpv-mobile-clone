import { Container } from './Container';

export function Footer() {
  return (
    <footer className="relative border-t border-bone/[0.08] bg-ink-900/60 py-14">
      <Container>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gold-tintStrong text-gold font-serif text-[15px] leading-none">
                R
              </span>
              <span className="font-serif text-[18px] tracking-tightish">
                Represent<span className="text-gold">.</span>
              </span>
            </div>
            <p className="mt-4 max-w-[36ch] text-[12.5px] leading-relaxed text-bone-muted">
              The infrastructure layer for verified public consensus. Built in Calgary, available where cities are ready.
            </p>
          </div>

          <FooterCol
            label="Product"
            items={[
              { l: 'How it works', h: '#how' },
              { l: 'For citizens', h: '#citizens' },
              { l: 'For cities', h: '#cities' },
              { l: 'Calgary case study', h: '#calgary' },
            ]}
          />
          <FooterCol
            label="Company"
            items={[
              { l: 'Contact', h: 'mailto:hello@representvote.com' },
              { l: 'Support', h: 'mailto:support@representvote.com' },
              { l: 'Press kit', h: '#' },
              { l: 'Careers', h: '#' },
            ]}
          />
          <FooterCol
            label="Legal"
            items={[
              { l: 'Privacy', h: 'https://representportal.com/privacy' },
              { l: 'Terms', h: 'https://representportal.com/terms' },
              { l: 'Audit reports', h: '#' },
              { l: 'Security', h: '#' },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-bone/[0.06] pt-6 md:flex-row md:items-center md:justify-between">
          <span className="font-mono text-[10.5px] tracking-wide text-bone-faint">
            © 2026 REPRESENT VOTE INC. · TREATY 7 · CALGARY · CA
          </span>
          <span className="font-mono text-[10.5px] tracking-eyebrow text-bone-faint">
            ALL RESULTS SIGNED · ALL RECORDS PUBLIC
          </span>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({
  label,
  items,
}: {
  label: string;
  items: { l: string; h: string }[];
}) {
  return (
    <div>
      <div className="eyebrow mb-4">{label}</div>
      <ul className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it.l}>
            <a
              href={it.h}
              className="text-[13px] text-bone-muted transition-colors hover:text-bone"
            >
              {it.l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
