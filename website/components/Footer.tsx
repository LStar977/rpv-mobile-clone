import Link from "next/link";
import Logo from "./Logo";

const links = [
  { label: "Platform", href: "#platform" },
  { label: "Solutions", href: "#solutions" },
  { label: "Resources", href: "#resources" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/15" />
      <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-10 px-8 py-12 md:flex-row md:items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <span className="text-[17px] font-semibold tracking-tight">
              Represent Vote
            </span>
          </div>
          <span className="hidden h-7 w-px bg-white/20 md:block" />
          <p className="text-[13px] text-white/70">
            Verified. Trusted. Together.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-10">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[14px] text-white/85 transition hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
