const NAV_LINKS = [
  { label: "/apps", href: "https://linktr.ee/bomoldenhauer?utm_source=linktree_profile_share&ltsid=044edb07-7d48-4ec0-81ad-90e9200405d5" },
  { label: "/sites", href: "https://boportfoliov2.vercel.app/" },
  { label: "/tools", href: "https://github.com/bofrompursuit" },
];

function NavLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative pointer-events-auto font-mono text-xs tracking-wider text-paper/70 transition-colors hover:text-[#00f0ff]"
      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
    >
      {label}
      <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-[#00f0ff] transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </a>
  );
}

export function SiteFooter() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div className="flex flex-col items-end gap-3 px-5 py-3 text-right sm:flex-row sm:items-center sm:justify-end sm:gap-6 sm:px-8 sm:py-4">
        <div className="flex items-center gap-3">
          <span
            className="pointer-events-auto font-display text-sm font-semibold tracking-wide text-paper"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
          >
            Planet YO!BO!
          </span>
          <span
            className="hidden items-center gap-1.5 font-mono text-[10px] tracking-widest text-paper/50 sm:flex"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
          >
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

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.label} {...link} />
          ))}
        </nav>

        <span
          className="hidden font-mono text-[10px] text-paper/40 sm:inline"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
        >
          &copy; Bo Moldenhauer
        </span>
      </div>
    </div>
  );
}
