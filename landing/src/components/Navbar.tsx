import { User, Settings } from "lucide-react";

const links = [
  "Get Verified",
  "How It Works",
  "Use Cases",
  "For Institutions",
  "Pricing",
  "Contact",
];

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 md:px-10">
        {/* Left: logo mark + wordmark */}
        <a href="#hero" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/10">
            <img
              src="/logo.png"
              alt="Represent Vote"
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-[#111111]">
            Represent Vote
          </span>
        </a>

        {/* Center: nav links */}
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <a
              key={link}
              href="#"
              className="text-[13.5px] font-medium tracking-tight text-[rgba(0,0,0,0.62)] transition-colors hover:text-[#111111]"
            >
              {link}
            </a>
          ))}
        </nav>

        {/* Right: icon buttons */}
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Account"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/40 text-[#111111] backdrop-blur transition-all hover:border-black/25 hover:bg-white/70"
          >
            <User size={18} strokeWidth={1.8} />
          </button>
          <button
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/40 text-[#111111] backdrop-blur transition-all hover:border-black/25 hover:bg-white/70"
          >
            <Settings size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}
