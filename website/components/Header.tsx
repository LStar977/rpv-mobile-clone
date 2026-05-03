import Link from "next/link";
import Logo from "./Logo";

const nav = [
  { label: "Platform", href: "#platform" },
  { label: "Solutions", href: "#solutions" },
  { label: "Resources", href: "#resources" },
  { label: "About", href: "#about" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">
            Represent Vote
          </span>
        </Link>

        <nav className="hidden items-center gap-12 md:flex">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[15px] text-white/85 transition hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="#demo"
          className="rounded-md border border-gold/70 px-5 py-2.5 text-sm text-gold transition hover:bg-gold hover:text-ink"
        >
          Request a Demo
        </Link>
      </div>
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
    </header>
  );
}
