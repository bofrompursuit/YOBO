const NAV_LINKS = [
  { label: "/apps", href: "https://linktr.ee/bomoldenhauer?utm_source=linktree_profile_share&ltsid=044edb07-7d48-4ec0-81ad-90e9200405d5" },
  { label: "/sites", href: "/sites" },
  { label: "/tools", href: "https://boportfoliov2.vercel.app/" },
];

const SOCIAL_LINKS = [
  { label: "linktree", href: "https://linktr.ee/bomoldenhauer?utm_source=linktree_profile_share&ltsid=044edb07-7d48-4ec0-81ad-90e9200405d5" },
  { label: "github", href: "https://github.com/bofrompursuit" },
];

function NavLink({ label, href }: { label: string; href: string }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group relative pointer-events-auto font-mono text-xs tracking-wider text-paper/70 transition-colors hover:text-[#00f0ff]"
    >
      {label}
      <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-[#00f0ff] transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </a>
  );
}

export function SiteFooter() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div
        className="flex flex-col gap-3 border-t px-5 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-4"
        style={{
          background: "rgba(0,0,0,0.2)",
          borderColor: "rgba(6,182,212,0.2)",
        }}
      >
        {/* Left: brand + status */}
        <div className="flex items-center gap-3">
          <span className="pointer-events-auto font-display text-sm font-semibold tracking-wide text-paper">
            Planet YO!BO!
          </span>
          <span className="hidden items-center gap-1.5 font-mono text-[10px] tracking-widest text-paper/50 sm:flex">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#00f0ff]"
              style={{
                boxShadow: "0 0 6px rgba(0,240,255,0.9), 0 0 12px rgba(0,240,255,0.6)",
                animation: "footer-pulse 2.4s ease-in-out infinite",
              }}
            />
            SYSTEM ACTIVE
          </span>
        </div>

        {/* Center: nav — hidden on the smallest screens to keep the bar compact */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.label} {...link} />
          ))}
        </nav>

        {/* Right: social + copyright */}
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="flex items-center gap-4">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto rounded border px-2 py-1 font-mono text-[10px] tracking-widest text-paper/60 transition-colors hover:border-[#00f0ff]/60 hover:text-[#00f0ff]"
                style={{ borderColor: "rgba(6,182,212,0.25)" }}
              >
                [{link.label}]
              </a>
            ))}
          </div>
          <span className="hidden font-mono text-[10px] text-paper/40 sm:inline">
            &copy; Bo Moldenhauer
          </span>
        </div>
      </div>
    </div>
  );
}
