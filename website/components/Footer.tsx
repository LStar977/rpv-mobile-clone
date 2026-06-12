import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-bg px-6 py-16 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <span className="font-serif text-base tracking-tight text-cream">
              Represent Vote
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-cream/50">
            A Canadian platform for verified citizen voting. Identity-checked,
            geo-gated, recorded on-chain.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm text-cream/60">
          <a href="https://apps.apple.com/ca/app/id6756912022" className="hover:text-cream">
            App Store
          </a>
          <a href="/privacy" className="hover:text-cream">Privacy</a>
          <a href="/terms" className="hover:text-cream">Terms</a>
          <a href="mailto:hello@representvote.com" className="hover:text-cream">
            Contact
          </a>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-5xl text-xs text-cream/30">
        © {new Date().getFullYear()} Represent Vote. Made in Canada.
      </div>
    </footer>
  );
}
